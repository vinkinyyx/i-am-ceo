/**
 * R05：无 structuredClone 的状态深拷贝与异常后锁释放。
 */
import { describe, it, expect } from 'vitest';
import { cloneGameState, cloneJsonValue, CloneError } from '@core/persistence/cloneGameState';
import { GameStore } from '@core/application/GameStore';
import { createInitialState } from '@core/domain/gameStateFactory';
import { ScriptedStorage, withoutGlobalCapability } from '../helpers/faults';

describe('R05-T02 深拷贝嵌套结构互不引用', () => {
  it('数组/对象为新引用，修改副本不影响原档', () => {
    const state = createInitialState(1_700_000_000_000, 99);
    state.employees.push({
      id: 'e1',
      name: '张三',
      department: 'MAIN',
      role: 'STAFF',
      skill: 60,
      potential: 70,
      teamwork: 65,
      trait: 'BOLD',
      monthlySalaryYuan: 6000,
      hiredAtYear: 1,
      hiredAtMonth: 1,
      effectiveFromYear: 1,
      effectiveFromMonth: 1,
      status: 'ACTIVE',
    } as never);
    const copy = cloneGameState(state);
    expect(copy).toEqual(state);
    expect(copy).not.toBe(state);
    expect(copy.employees).not.toBe(state.employees);
    copy.employees.length = 0;
    copy.rngCounter = 123;
    expect(state.employees).toHaveLength(1);
    expect(state.rngCounter).toBe(0);
  });

  it('通用 JSON 克隆基本类型与嵌套', () => {
    const v = { a: 1, b: '中', c: [1, 2, { d: true }], e: null };
    expect(cloneJsonValue(v)).toEqual(v);
    expect(cloneJsonValue(v)).not.toBe(v);
  });
});

describe('R05-T04 非法数据显式失败，不静默改值', () => {
  it('NaN / Infinity 抛 CloneError', () => {
    expect(() => cloneJsonValue({ x: Number.NaN })).toThrow(CloneError);
    expect(() => cloneJsonValue({ x: Number.POSITIVE_INFINITY })).toThrow(CloneError);
  });

  it('undefined 字段值抛错（不静默丢字段）', () => {
    expect(() => cloneJsonValue({ a: 1, b: undefined })).toThrow(CloneError);
  });

  it('Date/Map/函数抛错', () => {
    expect(() => cloneJsonValue(new Date())).toThrow(CloneError);
    expect(() => cloneJsonValue(new Map())).toThrow(CloneError);
    expect(() => cloneJsonValue(() => 1)).toThrow(CloneError);
  });

  it('错误路径可诊断', () => {
    try {
      cloneJsonValue({ a: [{ b: Number.NaN }] });
      throw new Error('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(CloneError);
      expect((e as CloneError).path).toBe('a[0].b');
    }
  });
});

describe('R05-T01/T03 缺 structuredClone 时命令成功、快照抛错后可重试', () => {
  it('缺能力环境：连续两条写命令均成功并持久化，锁释放', async () => {
    await withoutGlobalCapability('structuredClone', async () => {
      const storage = new ScriptedStorage();
      const store = new GameStore(storage);
      const runId = store.current.runId;
      const r1 = await store.mutate((s) => {
        s.rngCounter = 1;
      }, runId);
      expect(r1.revision).toBe(1);
      const r2 = await store.mutate((s) => {
        s.rngCounter = 2;
      }, runId);
      expect(r2.revision).toBe(2);
      expect(store.current.rngCounter).toBe(2);
      // 确有真实落盘
      expect(storage.setCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('变更函数抛错后内存状态恢复，且下一条命令可执行', async () => {
    const store = new GameStore(new ScriptedStorage());
    const runId = store.current.runId;
    await store
      .mutate((s) => {
        s.rngCounter = 5;
        throw new Error('business validation failed');
      }, runId)
      .catch((e: unknown) => e);
    expect(store.current.rngCounter).toBe(0);
    const again = await store.mutate((s) => {
      s.rngCounter = 7;
    }, runId);
    expect(again.revision).toBe(1);
    expect(store.current.rngCounter).toBe(7);
  });

  it('RUN_CHANGED 时抛错并恢复快照，锁释放', async () => {
    const store = new GameStore(new ScriptedStorage());
    const wrongRunId = 'other-run';
    await expect(
      store.mutate((s) => {
        s.rngCounter = 9;
      }, wrongRunId),
    ).rejects.toThrow(/RUN_CHANGED/);
    expect(store.current.rngCounter).toBe(0);
    // 锁仍可用
    const ok = await store.mutate((s) => {
      s.rngCounter = 1;
    }, store.current.runId);
    expect(ok.revision).toBe(1);
  });
});
