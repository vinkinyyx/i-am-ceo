/**
 * R02 发布整改故障回归入口。
 * 这些用例把 §14.3 已复现缺陷（REL-02/03/04）固化为有判定的回归：
 * - 修复任务（R04/R05/R10…）完成前，对应用例期望“旧缺陷行为”，用于证明夹具稳定可复现；
 * - 对应修复落地时，把 DEFECT 标记翻转为 FIXED 并改断言安全行为（用例注释保留缺陷编号）。
 * 不使用固定 sleep：hang 用 Promise.race + 受控标记判定。
 */
import { describe, it, expect } from 'vitest';
import { TapPlatform } from '@core/platform/TapPlatform';
import { GameStore } from '@core/application/GameStore';
import { GameError, GameErrorCode } from '@core/domain/errors';
import { crc32String } from '@core/persistence/crc32';
import {
  ScriptedStorage,
  ScriptedTapRuntime,
  withoutGlobalCapability,
} from '../helpers/faults';
import { createFreshLoader } from '../helpers/freshModule';

// 修复进度开关：某 R 任务完成后置 true，同一用例断言切换为安全行为。
const FIX = {
  R04: true, // REL-02 已修复：纯 TS UTF-8，无 TextEncoder 依赖
  R05: true, // REL-03 已修复：cloneGameState + 快照纳入 try/finally
  R10: true, // REL-04 已修复：get 超时/IO reject SAVE_UNAVAILABLE，仅 missing 返回 null
} as const;

describe('R02 夹具自身行为', () => {
  it('ScriptedStorage 默认 null=已确认不存在，与故障 reject 可区分', async () => {
    const s = new ScriptedStorage();
    await expect(s.get('absent')).resolves.toBeNull();
    s.onGet('ceo/save/a', { kind: 'reject', reason: 'timeout' });
    await expect(s.get('ceo/save/a')).rejects.toThrow(/timeout/);
    // 脚本耗尽后恢复正常，测试间互不残留
    await expect(s.get('absent')).resolves.toBeNull();
  });

  it('hang 永不 settle（用 race 判定，不靠 sleep）', async () => {
    const s = new ScriptedStorage();
    s.onGet('k', { kind: 'hang' });
    let settled = false;
    void s.get('k').then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
  });
});

describe('REL-02｜R04：crc32 在无 TextEncoder 宿主仍可工作', () => {
  it('缺 TextEncoder 时：旧实现模块导入期即失败；修复后输出标准 UTF-8 CRC32', async () => {
    await withoutGlobalCapability('TextEncoder', async () => {
      const loadCrc = (): { crc32String: (s: string) => string } =>
        createFreshLoader().load('persistence/crc32');
      if (!FIX.R04) {
        // 旧缺陷：模块顶层 const encoder = new TextEncoder()，缺能力环境导入即抛
        expect(() => loadCrc()).toThrow(/TextEncoder/);
        return;
      }
      const fresh = loadCrc();
      expect(() => fresh.crc32String('中文ABC😀')).not.toThrow();
      // 与标准编码器参考值一致（参考值在能力恢复后计算）
      expect(fresh.crc32String('中文ABC😀')).toBe(crc32String('中文ABC😀'));
    });
  });
});

describe('REL-03｜R05：structuredClone 缺失时命令与锁', () => {
  it('缺 structuredClone 时首条写命令：旧实现抛错；修复后成功且锁释放', async () => {
    await withoutGlobalCapability('structuredClone', async () => {
      const store = new GameStore(new ScriptedStorage());
      const runId = store.current.runId;
      const first = store.mutate((s) => {
        s.rngCounter = 1;
      }, runId);
      if (!FIX.R05) {
        await expect(first).rejects.toThrow();
        // 旧实现快照在 try 外获取，锁行为也要在修复后验证“可重试”
        const second = store.mutate((s) => {
          s.rngCounter = 2;
        }, runId);
        // 旧实现 finally 会放锁，但第一次命令已失败——记录这一现状
        await second.catch(() => undefined);
        return;
      }
      await expect(first).resolves.toBeDefined();
      // 快照抛错后第二个有效命令仍可执行（锁已释放）
      await expect(
        store.mutate((s) => {
          s.rngCounter = 2;
        }, runId),
      ).resolves.toBeDefined();
    });
  });
});

describe('REL-04｜R10：TapPlatform.get 超时不得读作 key 不存在', () => {
  it('getStorage 不回调时：旧实现 resolve(null)；修复后 reject SAVE_UNAVAILABLE(timeout)', async () => {
    const tap = new ScriptedTapRuntime();
    tap.script('getStorage', { type: 'silent' });
    const platform = new TapPlatform(tap, { opTimeoutMs: 10, loginCallbackTimeoutMs: 10 });
    const result = await platform
      .get('ceo/save/active')
      .then((v) => ({ kind: 'resolved' as const, value: v }))
      .catch((e: unknown) => ({ kind: 'rejected' as const, error: e }));
    if (!FIX.R10) {
      expect(result.kind).toBe('resolved');
      if (result.kind === 'resolved') expect(result.value).toBeNull();
      return;
    }
    expect(result.kind).toBe('rejected');
    if (result.kind === 'rejected') {
      const ge = result.error as { code?: string; details?: Record<string, unknown> };
      expect(ge.code).toBe(GameErrorCode.SAVE_UNAVAILABLE);
      expect(ge.details?.reason).toBe('timeout');
    }
  });

  it('明确 data not found 仍读作 null（missing 语义保持）', async () => {
    const tap = new ScriptedTapRuntime();
    const platform = new TapPlatform(tap);
    await expect(platform.get('ceo/save/active')).resolves.toBeNull();
  });

  it('R10-T02：fail→success 乱序双回调只 settle 一次（fail 生效，不再写入误判）', async () => {
    const tap = new ScriptedTapRuntime();
    tap.script('getStorage', { type: 'fail-then-success' });
    const platform = new TapPlatform(tap);
    // 无数据：fail(data not found 之外的暂态错误) 先到即定论——脚本给的是 transient io
    const err = await platform.get('ceo/save/active').catch((e: unknown) => e);
    expect((err as GameError).code).toBe(GameErrorCode.SAVE_UNAVAILABLE);
  });
});
