import type { IStorageBackend } from '../platform/ITapPlatform';
import { GameError, GameErrorCode } from '../domain/errors';
import type { GameState } from '../domain/types';
import { canonicalStringify } from './canonical';
import { encodeEnvelope, verifyEnvelope } from './SaveCodec';
import { migrateEnvelope } from './SaveMigration';
import { validateGameState } from './stateIntegrity';
import { utf8ByteLength } from './utf8';
import {
  SAVE_KEYS,
  type ResetTombstone,
  type PreparedRunReplacement,
  type SaveEnvelope,
  type SavePointer,
  type SaveTransactionJournal,
} from './SaveTypes';

export interface LoadedSave {
  envelope: SaveEnvelope;
  state: GameState;
  /** 本次加载是否经历了从损坏指针/槽位的恢复（用于提示 SAVE_CORRUPT 但可继续）。 */
  recovered: boolean;
  recoveryNote?: string;
}

export interface SaveCommitBase {
  runId: string;
  revision: number;
  resetGeneration: number;
}

/** R11：单槽读取四分法。UNAVAILABLE 与 CORRUPT 不可互换。 */
export type SlotStatus =
  | { kind: 'FOUND'; envelope: SaveEnvelope }
  | { kind: 'MISSING' }
  | { kind: 'CORRUPT'; reason: string }
  | { kind: 'UNAVAILABLE'; reason: string; cause?: unknown };

interface SlotCandidate {
  slot: 'a' | 'b';
  envelope: SaveEnvelope;
}

function unavailable(reason: string, cause?: unknown): GameError {
  return new GameError(GameErrorCode.SAVE_UNAVAILABLE, { reason, cause: String(cause ?? reason) });
}

/**
 * 双槽存档仓库（设计文档 §3.4 / §14.5 / §15.3.1）。
 * commit：写非活动槽 → 回读校验 checksum → 写活动指针 → 成功才返回。
 * load：严格按“已提交事实”决定，读失败不代表无档，暂不可读绝不回退为新建。
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
    params: { revision: number; resetGeneration: number; expectedBase: SaveCommitBase | null; operationId?: string; ownerScope?: string },
  ): Promise<SaveEnvelope> {
    if (state.runId.length === 0) throw new Error('runId required');
    const tombstone = await this.readTombstone();
    if (tombstone && tombstone.oldRunId === state.runId) {
      // 墓碑禁止旧 run 写回（设计文档 §3.5：跨 run 迟到保存必须丢弃）
      throw new Error(GameErrorCode.RUN_CHANGED);
    }

    // 存在未完成 journal：先 reconcile，不允许在不确定状态上覆盖
    const openJournal = await this.readJournal();
    if (openJournal) {
      const reconciled = await this.reconcileJournal(openJournal);
      if (reconciled === 'undecidable') {
        throw new GameError(GameErrorCode.SAVE_UNAVAILABLE, { reason: 'open-transaction' });
      }
    }

    const pointer = await this.readPointer();
    this.assertExpectedBase(pointer, params.expectedBase);
    if (params.expectedBase && params.revision !== params.expectedBase.revision + 1) {
      throw new GameError(GameErrorCode.REVISION_CONFLICT, {
        expectedRevision: params.expectedBase.revision + 1,
        actualRevision: params.revision,
      });
    }
    const targetSlot: 'a' | 'b' = pointer?.slot === 'a' ? 'b' : 'a';
    const envelope = encodeEnvelope(state, {
      revision: params.revision,
      runId: state.runId,
      resetGeneration: params.resetGeneration,
    });

    // 存档大小预算：按真实 UTF-8 字节（R11-T05），不再以 UTF-16 长度近似
    const size = utf8ByteLength(canonicalStringify(envelope));
    if (size > this.targetMaxBytes) {
      throw new Error(`${GameErrorCode.SAVE_FAILED}:save-too-large:${size}`);
    }

    const targetPointer: SavePointer = {
      slot: targetSlot,
      revision: params.revision,
      runId: state.runId,
      resetGeneration: params.resetGeneration,
    };
    const slotKey = targetSlot === 'a' ? SAVE_KEYS.slotA : SAVE_KEYS.slotB;

    // R12 §15.3.2：journal → 写目标槽+回读校验 → 写指针+回读确认 → 清 journal
    const journal: SaveTransactionJournal = {
      protocolVersion: 1,
      transactionId: `tx-${state.runId}-${params.revision}-${params.resetGeneration}`,
      kind: 'commit',
      operationId: params.operationId ?? `commit:${state.runId}:${params.revision}`,
      ownerScope: params.ownerScope ?? 'local',
      basePointer: pointer ?? null,
      targetPointer,
      targetChecksum: envelope.checksum,
      createdAtMs: Date.now(),
    };
    await this.storage.set(SAVE_KEYS.transaction, journal);
    // journal 自身写入结果未知时回读核对；读不回不得开始覆盖槽位
    const journalBack = await this.storage.get<SaveTransactionJournal>(SAVE_KEYS.transaction);
    if (!journalBack || journalBack.transactionId !== journal.transactionId) {
      throw new GameError(GameErrorCode.SAVE_UNAVAILABLE, { reason: 'journal-not-confirmed' });
    }

    // 1) 写非活动槽（旧已提交档仍由 base 指针指向，不会被半写覆盖成“当前档”）
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
    if (readback.checksum !== envelope.checksum || !this.matchesPointer(readback, targetPointer)) {
      throw new Error(`${GameErrorCode.SAVE_FAILED}:readback-mismatch`);
    }

    // 3) 写活动指针并回读确认（回调失败但实际写入时，靠 journal 在下次装载识别）
    await this.storage.set(SAVE_KEYS.active, targetPointer);
    const pointerBack = await this.storage.get<SavePointer>(SAVE_KEYS.active);
    if (!pointerBack || !this.pointerEqual(pointerBack, targetPointer)) {
      // 结果未知：保留 journal，交下次 reconcile，禁止重放收费命令
      throw new GameError(GameErrorCode.SAVE_UNAVAILABLE, { reason: 'pointer-unconfirmed' });
    }

    // 4) 提交完成，清理 journal（清理失败不影响正确性：装载识别目标已提交后幂等清理）
    await this.storage.remove(SAVE_KEYS.transaction).catch(() => undefined);

    return envelope;
  }

  /**
   * R14：关闭公司事务的新 run 提交。与 commit 相同的 journal/槽位/指针协议，
   * journal.kind='replace-run'，并记录 baseRunId 供恢复识别；新 run 总是写入
   * 墓碑代际，目标槽选择不依赖旧指针（旧 run 指针即将失效）。
   */
  async commitReplaceRun(
    state: GameState,
    params: {
      revision: number;
      resetGeneration: number;
      baseRunId: string;
      expectedBase: SaveCommitBase | null;
      nowMs: number;
      operationId?: string;
      ownerScope?: string;
    },
  ): Promise<SaveEnvelope> {
    if (state.runId.length === 0) throw new Error('runId required');
    if (state.runId === params.baseRunId) throw new Error('new run must differ from tombstoned run');

    const pointer = await this.readPointer();
    this.assertExpectedBase(pointer, params.expectedBase);
    if (params.expectedBase && params.expectedBase.runId !== params.baseRunId) {
      throw new GameError(GameErrorCode.REVISION_CONFLICT, { reason: 'replace-base-run-mismatch' });
    }
    // 重开新 run：固定写槽 A（墓碑保证旧 run 槽位不会被加载，稍后 clearRunSlots）
    const targetSlot: 'a' | 'b' = 'a';
    const envelope = encodeEnvelope(state, {
      revision: params.revision,
      runId: state.runId,
      resetGeneration: params.resetGeneration,
    });
    const size = utf8ByteLength(canonicalStringify(envelope));
    if (size > this.targetMaxBytes) {
      throw new Error(`${GameErrorCode.SAVE_FAILED}:save-too-large:${size}`);
    }

    const targetPointer: SavePointer = {
      slot: targetSlot,
      revision: params.revision,
      runId: state.runId,
      resetGeneration: params.resetGeneration,
    };
    const journal: SaveTransactionJournal = {
      protocolVersion: 1,
      transactionId: `replace-${state.runId}-${params.resetGeneration}`,
      kind: 'replace-run',
      operationId: params.operationId ?? `replace-run:${params.baseRunId}:${params.resetGeneration}`,
      ownerScope: params.ownerScope ?? 'local',
      basePointer: pointer ?? null,
      targetPointer,
      targetChecksum: envelope.checksum,
      createdAtMs: params.nowMs,
    };
    await this.storage.set(SAVE_KEYS.transaction, journal);
    const journalBack = await this.storage.get<SaveTransactionJournal>(SAVE_KEYS.transaction);
    if (!journalBack || journalBack.transactionId !== journal.transactionId) {
      throw new GameError(GameErrorCode.SAVE_UNAVAILABLE, { reason: 'journal-not-confirmed' });
    }

    await this.storage.set(SAVE_KEYS.slotA, envelope);
    const readback = await this.storage.get<SaveEnvelope>(SAVE_KEYS.slotA);
    if (!readback || !this.matchesPointer(readback, targetPointer) || readback.checksum !== envelope.checksum) {
      throw new Error(`${GameErrorCode.SAVE_FAILED}:readback-mismatch`);
    }

    await this.storage.set(SAVE_KEYS.active, targetPointer);
    const pointerBack = await this.storage.get<SavePointer>(SAVE_KEYS.active);
    if (!pointerBack || !this.pointerEqual(pointerBack, targetPointer)) {
      throw new GameError(GameErrorCode.SAVE_UNAVAILABLE, { reason: 'pointer-unconfirmed' });
    }
    await this.storage.remove(SAVE_KEYS.transaction).catch(() => undefined);
    return envelope;
  }

  async prepareRunReplacement(
    state: GameState,
    params: { operationId: string; ownerScope: string; baseRunId: string; baseRevision: number;
      baseResetGeneration: number; targetResetGeneration: number; preparedAtMs: number },
  ): Promise<{ intent: PreparedRunReplacement; envelope: SaveEnvelope }> {
    const pointer = await this.readPointer();
    this.assertExpectedBase(pointer, params.baseRevision === 0 ? null : {
      runId: params.baseRunId, revision: params.baseRevision, resetGeneration: params.baseResetGeneration,
    });
    const envelope = encodeEnvelope(state, { revision: 1, runId: state.runId, resetGeneration: params.targetResetGeneration });
    if (utf8ByteLength(canonicalStringify(envelope)) > this.targetMaxBytes) {
      throw new Error(`${GameErrorCode.SAVE_FAILED}:save-too-large`);
    }
    const intent: PreparedRunReplacement = {
      protocolVersion: 1, operationId: params.operationId, ownerScope: params.ownerScope,
      baseRunId: params.baseRunId, baseRevision: params.baseRevision, baseResetGeneration: params.baseResetGeneration,
      targetRunId: state.runId, targetRevision: 1, targetResetGeneration: params.targetResetGeneration,
      targetChecksum: envelope.checksum, preparedAtMs: params.preparedAtMs,
    };
    await this.storage.set(SAVE_KEYS.replaceStaging, envelope);
    const staged = await this.storage.get<SaveEnvelope>(SAVE_KEYS.replaceStaging);
    if (!staged || !verifyEnvelope(staged).ok || staged.checksum !== envelope.checksum) {
      throw new GameError(GameErrorCode.SAVE_UNAVAILABLE, { reason: 'replace-staging-not-confirmed' });
    }
    await this.storage.set(SAVE_KEYS.replaceIntent, intent);
    const intentBack = await this.storage.get<PreparedRunReplacement>(SAVE_KEYS.replaceIntent);
    if (!intentBack || canonicalStringify(intentBack) !== canonicalStringify(intent)) {
      throw new GameError(GameErrorCode.SAVE_UNAVAILABLE, { reason: 'replace-intent-not-confirmed' });
    }
    return { intent, envelope };
  }

  async clearPreparedRunReplacement(): Promise<void> {
    await this.storage.remove(SAVE_KEYS.replaceIntent);
    await this.storage.remove(SAVE_KEYS.replaceStaging);
  }

  async commitPreparedRunReplacement(intent: PreparedRunReplacement, envelope: SaveEnvelope): Promise<SaveEnvelope> {
    if (!verifyEnvelope(envelope).ok || envelope.checksum !== intent.targetChecksum
      || envelope.runId !== intent.targetRunId || envelope.revision !== intent.targetRevision
      || envelope.resetGeneration !== intent.targetResetGeneration) {
      throw new GameError(GameErrorCode.SAVE_CORRUPT, { reason: 'replace-staging-mismatch' });
    }
    const result = await this.commitReplaceRun(envelope.payload, {
      revision: intent.targetRevision, resetGeneration: intent.targetResetGeneration,
      baseRunId: intent.baseRunId,
      expectedBase: intent.baseRevision === 0 ? null : {
        runId: intent.baseRunId, revision: intent.baseRevision, resetGeneration: intent.baseResetGeneration,
      },
      nowMs: intent.preparedAtMs,
      operationId: intent.operationId,
      ownerScope: intent.ownerScope,
    });
    if (result.checksum !== intent.targetChecksum) throw new GameError(GameErrorCode.SAVE_CORRUPT, { reason: 'replace-commit-target-mismatch' });
    return result;
  }

  /**
   * 启动装载。返回 null 仅当“相关键均明确不存在，且无墓碑/事务歧义”=可安全新建。
   * 暂不可读（UNAVAILABLE）一律抛 SAVE_UNAVAILABLE，由启动层显示重试，绝不静默新建。
   */
  async load(): Promise<LoadedSave | null> {
    await this.recoverPreparedRunReplacement();
    // 未完成事务优先（R12）：有 journal 时不允许盲选最高 revision
    const journal = await this.readJournal();
    if (journal) {
      return this.loadWithJournal(journal);
    }
    return this.loadCore();
  }

  private async recoverPreparedRunReplacement(): Promise<void> {
    let intent: PreparedRunReplacement | null;
    try { intent = await this.storage.get<PreparedRunReplacement>(SAVE_KEYS.replaceIntent); }
    catch (err) { throw unavailable('replace-intent-read', err); }
    if (!intent) {
      await this.storage.remove(SAVE_KEYS.replaceStaging).catch(() => undefined);
      return;
    }
    let staged: SaveEnvelope | null;
    try { staged = await this.storage.get<SaveEnvelope>(SAVE_KEYS.replaceStaging); }
    catch (err) { throw unavailable('replace-staging-read', err); }
    const tombstone = await this.readTombstone();
    const crossedCommitPoint = tombstone?.oldRunId === intent.baseRunId
      && tombstone.newResetGeneration === intent.targetResetGeneration;
    if (!crossedCommitPoint) {
      await this.clearPreparedRunReplacement().catch(() => undefined);
      return;
    }
    if (!staged || !verifyEnvelope(staged).ok || staged.checksum !== intent.targetChecksum
      || staged.runId !== intent.targetRunId || staged.resetGeneration !== intent.targetResetGeneration) {
      throw new GameError(GameErrorCode.SAVE_UNAVAILABLE, { reason: 'tombstoned-replacement-target-unavailable' });
    }
    const journal = await this.readJournal();
    if (journal) {
      if (journal.kind === 'replace-run' && journal.targetPointer.runId === intent.targetRunId
        && intent.baseRevision === 0 && !await this.storage.get<SavePointer>(SAVE_KEYS.active)) {
        await this.storage.remove(SAVE_KEYS.transaction);
      } else {
      const outcome = await this.reconcileJournal(journal);
      if (outcome === 'undecidable') throw new GameError(GameErrorCode.SAVE_UNAVAILABLE, { reason: 'replacement-journal-undecidable' });
      if (outcome === 'committed' && journal.targetPointer.runId !== intent.targetRunId) {
        throw new GameError(GameErrorCode.SAVE_CORRUPT, { reason: 'replacement-journal-target-mismatch' });
      }
      }
    }
    const pointer = await this.readPointer();
    if (pointer?.runId !== intent.targetRunId || pointer.revision !== intent.targetRevision
      || pointer.resetGeneration !== intent.targetResetGeneration) {
      await this.commitPreparedRunReplacement(intent, staged);
    }
    await this.clearPreparedRunReplacement().catch(() => undefined);
  }

  private async loadCore(): Promise<LoadedSave | null> {
    const tombstoneRead = await this.inspectKey<ResetTombstone>(SAVE_KEYS.tombstone);
    const pointerRead = await this.inspectKey<SavePointer>(SAVE_KEYS.active);
    const tombstone = tombstoneRead.kind === 'FOUND' ? tombstoneRead.value : null;

    // 指针暂不可读：不能当无指针枚举，必须阻断
    if (pointerRead.kind === 'UNAVAILABLE') {
      throw unavailable(`pointer:${pointerRead.reason}`);
    }
    if (tombstoneRead.kind === 'UNAVAILABLE') {
      throw unavailable(`tombstone:${tombstoneRead.reason}`);
    }

    const pointer = pointerRead.kind === 'FOUND' ? pointerRead.value : null;

    // 优先活动指针槽：完整元组 (slot,runId,revision,resetGeneration) + checksum 匹配
    if (pointer) {
      const key = pointer.slot === 'a' ? SAVE_KEYS.slotA : SAVE_KEYS.slotB;
      const pointed = await this.inspectSlot(key);
      if (pointed.kind === 'UNAVAILABLE') {
        // 被选择槽暂不可读：不允许枚举另一槽后覆盖（R11-T03）
        throw unavailable(`pointed-slot:${pointed.reason}`);
      }
      if (pointed.kind === 'FOUND' && this.matchesPointer(pointed.envelope, pointer)
        && !(tombstone && tombstone.oldRunId === pointed.envelope.runId)
        && this.generationAccepted(pointed.envelope, tombstone)) {
        return this.finalize(pointed.envelope, false);
      }
      // CORRUPT/MISSING/元组不匹配：进入枚举恢复路径（下面处理）
    }

    // 枚举双槽
    const slotA = await this.inspectSlot(SAVE_KEYS.slotA);
    const slotB = await this.inspectSlot(SAVE_KEYS.slotB);

    // 任一槽暂不可读且可能存在已提交档：阻断，不用另一槽覆盖
    if (slotA.kind === 'UNAVAILABLE' || slotB.kind === 'UNAVAILABLE') {
      const u = slotA.kind === 'UNAVAILABLE' ? slotA : (slotB as Extract<SlotStatus, { kind: 'UNAVAILABLE' }>);
      throw unavailable(`slot:${u.reason}`);
    }

    const candidates: SlotCandidate[] = [];
    let corruptCount = 0;
    if (slotA.kind === 'FOUND') candidates.push({ slot: 'a', envelope: slotA.envelope });
    else if (slotA.kind === 'CORRUPT') corruptCount += 1;
    if (slotB.kind === 'FOUND') candidates.push({ slot: 'b', envelope: slotB.envelope });
    else if (slotB.kind === 'CORRUPT') corruptCount += 1;

    const usable = candidates
      .filter((c) => !(tombstone && tombstone.oldRunId === c.envelope.runId))
      // 不允许加载比墓碑代际更旧的残留档（墓碑代际优先于 revision）
      .filter((c) => this.generationAccepted(c.envelope, tombstone))
      .sort((x, y) => y.envelope.revision - x.envelope.revision);

    const evidenceExists =
      pointerRead.kind === 'FOUND' ||
      pointerRead.kind === 'CORRUPT' ||
      slotA.kind !== 'MISSING' ||
      slotB.kind !== 'MISSING';

    const best = usable[0];
    if (!best) {
      const allFoundAreDeadRun =
        candidates.length === 0 ||
        candidates.every((c) => tombstone?.oldRunId === c.envelope.runId);
      // 墓碑存在、槽位为空或全部属于被关闭旧 run（且无损坏槽）：重开后正常空态→可新建
      if (tombstone && allFoundAreDeadRun && corruptCount === 0) return null;
      if (!evidenceExists) return null; // 全 missing 才是真正的新游戏
      // 有档证据但全部损坏/代际不可信：明确损坏，不自动清空
      throw new GameError(GameErrorCode.SAVE_CORRUPT);
    }

    // 恢复：修复活动指针（元数据修复成功后才开放可写）
    const repairedPointer: SavePointer = {
      slot: best.slot,
      revision: best.envelope.revision,
      runId: best.envelope.runId,
      resetGeneration: best.envelope.resetGeneration ?? 0,
    };
    await this.storage.set(SAVE_KEYS.active, repairedPointer);

    return this.finalize(best.envelope, true, pointer ? 'pointer-mismatch' : 'pointer-missing');
  }

  /** 有未完成 journal 时的装载决策（R12）。 */
  private async loadWithJournal(journal: SaveTransactionJournal): Promise<LoadedSave | null> {
    const outcome = await this.reconcileJournal(journal);
    if (outcome === 'undecidable') throw unavailable('journal-undecidable');
    // reconcile 后 journal 已被解析；重新走标准装载
    return this.loadWithoutJournal();
  }

  /**
   * R12：核对未完成事务。
   * - committed：目标槽与目标指针/checksum 一致；必要时补切指针，然后清 journal。
   * - retained：目标未提交但 base 完好，事务未发生，保留 base 并清 journal。
   * - undecidable：目标/指针状态不明，冻结写入等待重试，禁止盲选最高 revision。
   */
  async reconcileJournal(
    journal: SaveTransactionJournal,
  ): Promise<'committed' | 'retained' | 'undecidable'> {
    const targetKey = journal.targetPointer.slot === 'a' ? SAVE_KEYS.slotA : SAVE_KEYS.slotB;
    const target = await this.inspectSlot(targetKey);
    if (target.kind === 'UNAVAILABLE') return 'undecidable';

    const targetCommitted =
      target.kind === 'FOUND' &&
      target.envelope.checksum === journal.targetChecksum &&
      this.matchesPointer(target.envelope, journal.targetPointer);

    const currentPointer = await this.readPointer();

    if (targetCommitted) {
      if (!currentPointer || !this.pointerEqual(currentPointer, journal.targetPointer)) {
        await this.storage.set(SAVE_KEYS.active, { ...journal.targetPointer });
        const back = await this.storage.get<SavePointer>(SAVE_KEYS.active);
        if (!back || !this.pointerEqual(back, journal.targetPointer)) return 'undecidable';
      }
      await this.storage.remove(SAVE_KEYS.transaction).catch(() => undefined);
      return 'committed';
    }

    // 目标未提交：核对 base 仍是事务前的已提交档
    if (!journal.basePointer) {
      // 无 base 且目标未确认：可能首次提交中断，无旧档可丢，但状态不明→阻断
      return 'undecidable';
    }
    const baseKey = journal.basePointer.slot === 'a' ? SAVE_KEYS.slotA : SAVE_KEYS.slotB;
    const base = await this.inspectSlot(baseKey);
    if (base.kind === 'UNAVAILABLE') return 'undecidable';
    if (
      currentPointer &&
      this.pointerEqual(currentPointer, journal.basePointer) &&
      base.kind === 'FOUND' &&
      this.matchesPointer(base.envelope, journal.basePointer)
    ) {
      await this.storage.remove(SAVE_KEYS.transaction).catch(() => undefined);
      return 'retained';
    }
    return 'undecidable';
  }

  private async loadWithoutJournal(): Promise<LoadedSave | null> {
    return this.loadCore();
  }

  /** 写入关闭公司墓碑（设计文档 §3.5）。 */
  async writeTombstone(tombstone: ResetTombstone): Promise<void> {
    await this.storage.set(SAVE_KEYS.tombstone, tombstone);
  }

  async readTombstone(): Promise<ResetTombstone | null> {
    return this.storage.get<ResetTombstone>(SAVE_KEYS.tombstone);
  }

  /** R12：有界事务日志键（只存元数据，不存业务状态）。 */
  async writeJournal(journal: SaveTransactionJournal): Promise<void> {
    await this.storage.set(SAVE_KEYS.transaction, journal);
  }

  async readJournal(): Promise<SaveTransactionJournal | null> {
    try {
      return await this.storage.get<SaveTransactionJournal>(SAVE_KEYS.transaction);
    } catch (err) {
      if (err instanceof GameError) throw err;
      throw unavailable('journal-read', err);
    }
  }

  async clearJournal(): Promise<void> {
    await this.storage.remove(SAVE_KEYS.transaction);
  }

  /** 清除旧 run 的双槽数据（墓碑保留，防止复活）。 */
  async clearRunSlots(oldRunId: string): Promise<void> {
    for (const key of [SAVE_KEYS.slotA, SAVE_KEYS.slotB]) {
      const slot = await this.inspectSlot(key);
      if (slot.kind === 'FOUND' && slot.envelope.runId === oldRunId) {
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

  /** 读取单个已知信封槽位，返回四分法状态（R11）。 */
  async inspectSlot(slotKey: string): Promise<SlotStatus> {
    let raw: SaveEnvelope | null;
    try {
      raw = await this.storage.get<SaveEnvelope>(slotKey);
    } catch (err) {
      return { kind: 'UNAVAILABLE', reason: 'read-error', cause: err };
    }
    if (raw === null) return { kind: 'MISSING' };
    const verify = verifyEnvelope(raw);
    if (!verify.ok) return { kind: 'CORRUPT', reason: verify.reason };
    const migrated = migrateEnvelope(raw, 1);
    const integrity = validateGameState(migrated.payload);
    if (!integrity.ok) return { kind: 'CORRUPT', reason: integrity.reason ?? 'invalid-state' };
    return { kind: 'FOUND', envelope: raw };
  }

  /** 读取指针/墓碑等元数据键：FOUND/MISSING/CORRUPT/UNAVAILABLE。 */
  private async inspectKey<T extends object>(key: string): Promise<
    | { kind: 'FOUND'; value: T }
    | { kind: 'MISSING' }
    | { kind: 'CORRUPT'; reason: string }
    | { kind: 'UNAVAILABLE'; reason: string; cause?: unknown }
  > {
    let value: T | null;
    try {
      value = await this.storage.get<T>(key);
    } catch (err) {
      return { kind: 'UNAVAILABLE', reason: 'read-error', cause: err };
    }
    if (value === null) return { kind: 'MISSING' };
    if (typeof value !== 'object') return { kind: 'CORRUPT', reason: 'metadata-not-object' };
    return { kind: 'FOUND', value };
  }

  private matchesPointer(envelope: SaveEnvelope, pointer: SavePointer): boolean {
    return (
      envelope.runId === pointer.runId &&
      envelope.revision === pointer.revision &&
      (envelope.resetGeneration ?? 0) === (pointer.resetGeneration ?? 0)
    );
  }

  private pointerEqual(a: SavePointer, b: SavePointer): boolean {
    return (
      a.slot === b.slot &&
      a.runId === b.runId &&
      a.revision === b.revision &&
      (a.resetGeneration ?? 0) === (b.resetGeneration ?? 0)
    );
  }

  private assertExpectedBase(pointer: SavePointer | null, expected: SaveCommitBase | null): void {
    const matches = expected === null
      ? pointer === null
      : pointer !== null && pointer.runId === expected.runId
        && pointer.revision === expected.revision
        && (pointer.resetGeneration ?? 0) === expected.resetGeneration;
    if (!matches) {
      throw new GameError(GameErrorCode.REVISION_CONFLICT, {
        expectedBase: expected,
        actualBase: pointer ? {
          runId: pointer.runId,
          revision: pointer.revision,
          resetGeneration: pointer.resetGeneration ?? 0,
        } : null,
      });
    }
  }

  /** 信封代际不得早于墓碑代际（墓碑后的旧 run 残留禁止恢复）。 */
  private generationAccepted(envelope: SaveEnvelope, tombstone: ResetTombstone | null): boolean {
    if (!tombstone) return true;
    if (envelope.runId === tombstone.oldRunId) return false;
    return (envelope.resetGeneration ?? 0) >= tombstone.newResetGeneration - 1;
  }

  private async finalize(envelope: SaveEnvelope, recovered: boolean, recoveryNote?: string): Promise<LoadedSave> {
    const migrated = migrateEnvelope(envelope, 1);
    const check = validateGameState(migrated.payload);
    if (!check.ok) {
      throw new GameError(GameErrorCode.SAVE_CORRUPT, { reason: check.reason ?? 'invalid-state' });
    }
    return { envelope: migrated, state: migrated.payload, recovered, recoveryNote };
  }
}
