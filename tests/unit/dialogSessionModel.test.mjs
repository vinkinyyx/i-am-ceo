// R31：弹窗会话模型（纯逻辑，不依赖 Cocos）。
import { describe, it, expect } from 'vitest';
import { DialogSessionModel, sameOwner } from '../../assets/scripts/ui/dialogSessionModel.ts';

const owner = (overrides = {}) => ({ runId: 'run-1', accountEpoch: 0, contextEpoch: 0, ...overrides });

describe('R31 弹窗登记', () => {
  it('同 semanticKey 只登记一次，不叠层', () => {
    const model = new DialogSessionModel();
    expect(model.register({ id: 'a', kind: 'detail', semanticKey: 'employee:1', owner: owner() })).not.toBeNull();
    expect(model.register({ id: 'b', kind: 'detail', semanticKey: 'employee:1', owner: owner() })).toBeNull();
    expect(model.openCount()).toBe(1);
    expect(model.top()?.id).toBe('a');
  });

  it('不同 semanticKey 可并存，top 为最后打开者', () => {
    const model = new DialogSessionModel();
    model.register({ id: 'a', kind: 'detail', semanticKey: 'employee:1', owner: owner() });
    model.register({ id: 'b', kind: 'confirm', semanticKey: 'layoff:1', owner: owner() });
    expect(model.openCount()).toBe(2);
    expect(model.top()?.id).toBe('b');
    expect(model.hasBlockingModal()).toBe(true);
    expect(model.hasDetail()).toBe(true);
  });

  it('notice 不算阻塞，confirm/detail 算', () => {
    const model = new DialogSessionModel();
    model.register({ id: 'n', kind: 'notice', semanticKey: 'offline:1', owner: owner() });
    expect(model.hasBlockingModal()).toBe(false);
    model.register({ id: 'c', kind: 'confirm', semanticKey: 'close:1', owner: owner() });
    expect(model.hasBlockingModal()).toBe(true);
  });
});

describe('R31 幂等注销与上下文失效', () => {
  it('重复注销只返回一次会话，栈回到基线', () => {
    const model = new DialogSessionModel();
    model.register({ id: 'a', kind: 'detail', semanticKey: 'employee:1', owner: owner() });
    expect(model.unregisterOnce('a', 'user-close')?.closeReason).toBe('user-close');
    expect(model.unregisterOnce('a', 'user-close')).toBeNull();
    expect(model.openCount()).toBe(0);
  });

  it('invalidateOwner 只清匹配上下文，旧代际回调不能留下窗口', () => {
    const model = new DialogSessionModel();
    model.register({ id: 'old', kind: 'confirm', semanticKey: 'close:1', owner: owner({ contextEpoch: 1 }) });
    model.register({ id: 'new', kind: 'confirm', semanticKey: 'close:2', owner: owner({ contextEpoch: 2 }) });
    const removed = model.invalidateOwner((o) => o.contextEpoch === 1, 'context-invalidated');
    expect(removed.map((s) => s.id)).toEqual(['old']);
    expect(model.openCount()).toBe(1);
    expect(model.top()?.id).toBe('new');
  });

  it('pruneInvalid 清理外毁节点，不模拟用户取消', () => {
    const model = new DialogSessionModel();
    model.register({ id: 'a', kind: 'notice', semanticKey: 'ad:1', owner: owner() });
    model.register({ id: 'b', kind: 'detail', semanticKey: 'employee:1', owner: owner() });
    const removed = model.pruneInvalid((s) => s.id === 'a', 'application-dispose');
    expect(removed).toHaveLength(1);
    expect(removed[0].closeReason).toBe('application-dispose');
    expect(model.openCount()).toBe(1);
  });

  it('clear 返回全部会话并清空栈', () => {
    const model = new DialogSessionModel();
    model.register({ id: 'a', kind: 'detail', semanticKey: 'employee:1', owner: owner() });
    model.register({ id: 'b', kind: 'notice', semanticKey: 'ad:1', owner: owner() });
    expect(model.clear('application-dispose')).toHaveLength(2);
    expect(model.openCount()).toBe(0);
    expect(model.top()).toBeNull();
  });

  it('sameOwner 同时比较 run、账号与上下文代际', () => {
    expect(sameOwner(owner(), owner())).toBe(true);
    expect(sameOwner(owner(), owner({ runId: 'run-2' }))).toBe(false);
    expect(sameOwner(owner(), owner({ accountEpoch: 1 }))).toBe(false);
    expect(sameOwner(owner(), owner({ contextEpoch: 1 }))).toBe(false);
  });
});
