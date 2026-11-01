import type { IStorageBackend } from '../platform/ITapPlatform';
import { GameErrorCode } from '../domain/errors';
import type { GameState } from '../domain/types';
import { canonicalStringify } from './canonical';
import { encodeEnvelope, verifyEnvelope } from './SaveCodec';
import { migrateEnvelope } from './SaveMigration';
import { validateGameState } from './stateIntegrity';
import {
  SAVE_KEYS,
  type ResetTombstone,
  type SaveEnvelope,
  type SavePointer,
} from './SaveTypes';

export interface LoadedSave {
  envelope: SaveEnvelope;
  state: GameState;
  /** 本次加载是否经历了从损坏指针/槽位的恢复（用于提示 SAVE_CORRUPT 但可继续）。 */
  recovered: boolean;
  recoveryNote?: string;
}

interface SlotCandidate {
  slot: 'a' | 'b';
  envelope: SaveEnvelope;
}

/**
 * 双槽存档仓库（设计文档 02.4）。
 * commit：写非活动槽 → 回读校验 checksum → 写活动指针 → 成功才返回。
 * load：优先活动指针；指针损坏则在双槽中选未被墓碑禁止且校验通过的最高 revision。
 */
export class SaveRepository {
  private readonly storage: IStorageBackend;
  private readonly targetMaxBytes: number;

  constructor(storage: IStorageBackend, targetMaxBytes = 500_000) {
    this.storage = storage;
    this.targetMaxBytes = targetMaxBytes;
  }

  async commit(
    state: GameState,
    params: { revision: number; resetGeneration: number },
  ): Promise<SaveEnvelope> {
    if (state.runId.length === 0) throw new Error('runId required');
    const tombstone = await this.readTombstone();
    if (tombstone && tombstone.oldRunId === state.runId) {
      // 墓碑禁止旧 run 写回（设计文档 02.5：跨 run 迟到保存必须丢弃）
      throw new Error(GameErrorCode.RUN_CHANGED);
    }

    const pointer = await this.readPointer();
    const targetSlot: 'a' | 'b' = pointer?.slot === 'a' ? 'b' : 'a';
    const envelope = encodeEnvelope(state, {
      revision: params.revision,
      runId: state.runId,
      resetGeneration: params.resetGeneration,
    });

    // 存档大小预算（设计文档 02.3 / 08.3：目标 <500KB）
    const size = canonicalStringify(envelope).length;
    if (size > this.targetMaxBytes) {
      throw new Error(`${GameErrorCode.SAVE_FAILED}:save-too-large:${size}`);
    }

    // 1) 写非活动槽
    const slotKey = targetSlot === 'a' ? SAVE_KEYS.slotA : SAVE_KEYS.slotB;
    await this.storage.set(slotKey, envelope);

    // 2) 回读并校验 checksum（断电/IO 不一致检测）
    const readback = await this.storage.get<SaveEnvelope>(slotKey);
    if (!readback) {
      throw new Error(`${GameErrorCode.SAVE_FAILED}:readback-null`);
    }
    const verify = verifyEnvelope(readback);
    if (!verify.ok) {
      throw new Error(`${GameErrorCode.SAVE_FAILED}:${verify.reason}`);
    }

    // 3) 写活动指针
    const nextPointer: SavePointer = {
      slot: targetSlot,
      revision: params.revision,
      runId: state.runId,
      resetGeneration: params.resetGeneration,
    };
    await this.storage.set(SAVE_KEYS.active, nextPointer);

    return envelope;
  }

  async load(): Promise<LoadedSave | null> {
    const tombstone = await this.readTombstone();
    const pointer = await this.readPointer();

    // 优先活动指针槽
    if (pointer) {
      const key = pointer.slot === 'a' ? SAVE_KEYS.slotA : SAVE_KEYS.slotB;
      const envelope = await this.tryReadSlot(key);
      if (
        envelope &&
        envelope.runId === pointer.runId &&
        !(tombstone && tombstone.oldRunId === envelope.runId)
      ) {
        return this.finalize(envelope, false);
      }
    }

    // 指针损坏/失配：枚举双槽找最高 revision 的有效档
    const candidates: SlotCandidate[] = [];
    const a = await this.tryReadSlot(SAVE_KEYS.slotA);
    const b = await this.tryReadSlot(SAVE_KEYS.slotB);
    if (a) candidates.push({ slot: 'a', envelope: a });
    if (b) candidates.push({ slot: 'b', envelope: b });

    const usable = candidates
      .filter((c) => !(tombstone && tombstone.oldRunId === c.envelope.runId))
      .sort((x, y) => y.envelope.revision - x.envelope.revision);

    const best = usable[0];
    if (!best) {
      // 存在墓碑且所有槽位都是被禁旧 run：这是正常重开后的状态，按无档处理
      if (tombstone && (a || b)) {
        return null;
      }
      if (pointer || a || b) {
        // 曾经有档但全部不可用：明确返回损坏信号，不静默新建公司
        throw new Error(GameErrorCode.SAVE_CORRUPT);
      }
      return null;
    }

    // 恢复后修复活动指针，避免下次再次走枚举路径
    const repairedPointer: SavePointer = {
      slot: best.slot,
      revision: best.envelope.revision,
      runId: best.envelope.runId,
      resetGeneration: best.envelope.resetGeneration ?? 0,
    };
    await this.storage.set(SAVE_KEYS.active, repairedPointer);

    return this.finalize(best.envelope, true, pointer ? 'pointer-mismatch' : 'pointer-missing');
  }

  /** 写入关闭公司墓碑（设计文档 02.5）。 */
  async writeTombstone(tombstone: ResetTombstone): Promise<void> {
    await this.storage.set(SAVE_KEYS.tombstone, tombstone);
  }

  async readTombstone(): Promise<ResetTombstone | null> {
    return this.storage.get<ResetTombstone>(SAVE_KEYS.tombstone);
  }

  /** 清除旧 run 的双槽数据（墓碑保留，防止复活）。 */
  async clearRunSlots(oldRunId: string): Promise<void> {
    for (const key of [SAVE_KEYS.slotA, SAVE_KEYS.slotB]) {
      const envelope = await this.tryReadSlot(key);
      if (envelope && envelope.runId === oldRunId) {
        await this.storage.remove(key);
      }
    }
  }

  async clearPointer(): Promise<void> {
    await this.storage.remove(SAVE_KEYS.active);
  }

  private async readPointer(): Promise<SavePointer | null> {
    return this.storage.get<SavePointer>(SAVE_KEYS.active);
  }

  private async tryReadSlot(key: string): Promise<SaveEnvelope | null> {
    try {
      const raw = await this.storage.get<SaveEnvelope>(key);
      if (!raw) return null;
      const verify = verifyEnvelope(raw);
      if (!verify.ok) return null;
      // 业务级完整性（B14）：checksum 通过但状态非法的槽位按不可用处理，
      // 使 load 能回退到另一槽而非带奇异状态启动。
      const migrated = migrateEnvelope(raw, 1);
      const integrity = validateGameState(migrated.payload);
      if (!integrity.ok) return null;
      return raw;
    } catch {
      return null;
    }
  }

  private finalize(envelope: SaveEnvelope, recovered: boolean, recoveryNote?: string): LoadedSave {
    const migrated = migrateEnvelope(envelope, 1);
    // 业务级完整性校验（B14）：checksum 通过但状态语义非法时拒绝恢复，
    // 不在此处静默新建公司——交给 load 的双槽枚举/损坏分支处理。
    const check = validateGameState(migrated.payload);
    if (!check.ok) {
      throw new Error(`${GameErrorCode.SAVE_CORRUPT}:${check.reason ?? 'invalid-state'}`);
    }
    return { envelope: migrated, state: migrated.payload, recovered, recoveryNote };
  }
}
