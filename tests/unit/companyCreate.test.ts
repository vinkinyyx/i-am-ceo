import { describe, it, expect } from 'vitest';
import { createInitialState } from '@core/domain/gameStateFactory';
import { createCompany } from '@core/application/CompanyService';
import { validateCompanyName, validatePersonName } from '@core/domain/validation';
import { NameGenerator } from '@core/domain/NameGenerator';
import { Rng } from '@core/simulation/rng';

describe('名称校验', () => {
  it('接受合法公司名并规范化全角空格', () => {
    const r = validateCompanyName('　一条咸鱼好物集　');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.name).toBe('一条咸鱼好物集');
  });

  it('拒绝空白/超长/标签/敏感词', () => {
    expect(validateCompanyName('   ').ok).toBe(false);
    expect(validateCompanyName('a'.repeat(21)).ok).toBe(false);
    expect(validateCompanyName('<img src=x>').ok).toBe(false);
    expect(validateCompanyName('腾讯官方商城').ok).toBe(false);
    expect(validatePersonName('').ok).toBe(false);
    expect(validatePersonName('a'.repeat(13)).ok).toBe(false);
  });

  it('随机公司名三选一且行业相关、可复现', () => {
    const g1 = new NameGenerator(new Rng(99));
    const g2 = new NameGenerator(new Rng(99));
    const names1 = g1.rollCompanyNames('TRADE', 3);
    const names2 = g2.rollCompanyNames('TRADE', 3);
    expect(names1).toEqual(names2);
    expect(new Set(names1).size).toBe(3);
    expect(names1.every((n) => n.length >= 2 && Array.from(n).length <= 20)).toBe(true);
    // 软件行业后缀与贸易不同
    const software = new NameGenerator(new Rng(99)).rollCompanyNames('SOFTWARE', 3);
    expect(software).not.toEqual(names1);
  });
});

describe('createCompany（A01/12.3）', () => {
  it('创建公司：注入30万一次、CEO全50、主营部存在、进入首聘且暂停', () => {
    const state = createInitialState(1000, 42);
    const result = createCompany(
      state,
      { companyName: '明天上市吗云货架有限公司', industry: 'TRADE', ceoName: '林启航', ceoTrait: 'BOLD' },
      { commandId: 'cmd-1', expectedRunId: state.runId },
    );
    expect(result.cashYuan).toBe(300_000);
    expect(state.company?.cashYuan).toBe(300_000);
    expect(state.company?.paidInCapitalYuan).toBe(300_000);
    expect(state.initializedCapital).toBe(true);
    expect(state.ceo).toMatchObject({ businessSkill: 50, managementSkill: 50, financeSkill: 50 });
    expect(state.departments.filter((d) => d.type === 'BUSINESS')).toHaveLength(1);
    expect(state.phase).toBe('HIRING_INITIAL');
    expect(state.speed).toBe(0);
  });

  it('同一 commandId 重试幂等，不再注资', () => {
    const state = createInitialState(1000, 43);
    const first = createCompany(
      state,
      { companyName: '测试公司', industry: 'SOFTWARE', ceoName: '陈稳', ceoTrait: 'STEADY' },
      { commandId: 'cmd-x', expectedRunId: state.runId },
    );
    const second = createCompany(
      state,
      { companyName: '测试公司', industry: 'SOFTWARE', ceoName: '陈稳', ceoTrait: 'STEADY' },
      { commandId: 'cmd-x', expectedRunId: state.runId },
    );
    expect(second.cashYuan).toBe(300_000);
    expect(second.companyId).toBe(first.companyId);
    expect(state.executedCommandIds.filter((id) => id === 'cmd-x')).toHaveLength(1);
  });

  it('同 run 换 commandId 重复创建被 NOT_READY 拒绝', () => {
    const state = createInitialState(1000, 44);
    createCompany(
      state,
      { companyName: '甲公司', industry: 'SERVICE', ceoName: '赵亲和', ceoTrait: 'PEOPLE' },
      { commandId: 'c1', expectedRunId: state.runId },
    );
    expect(() =>
      createCompany(
        state,
        { companyName: '乙公司', industry: 'SERVICE', ceoName: '王二', ceoTrait: 'PEOPLE' },
        { commandId: 'c2', expectedRunId: state.runId },
      ),
    ).toThrow(/NOT_READY/);
    expect(state.company?.name).toBe('甲公司');
  });

  it('旧 run 迟到命令被 RUN_CHANGED 拒绝', () => {
    const state = createInitialState(1000, 45);
    expect(() =>
      createCompany(
        state,
        { companyName: '旧公司', industry: 'TRADE', ceoName: '旧人', ceoTrait: 'BOLD' },
        { commandId: 'c9', expectedRunId: 'run_ghost' },
      ),
    ).toThrow(/RUN_CHANGED/);
    expect(state.company).toBeNull();
  });

  it('非法行业/性格/名称被拒绝且不改变状态', () => {
    const state = createInitialState(1000, 46);
    expect(() =>
      createCompany(
        state,
        { companyName: '好公司', industry: 'XXX' as never, ceoName: '张三', ceoTrait: 'BOLD' },
        { commandId: 'c', expectedRunId: state.runId },
      ),
    ).toThrow(/INVALID_INDUSTRY/);
    expect(() =>
      createCompany(
        state,
        { companyName: '好公司', industry: 'TRADE', ceoName: '张三', ceoTrait: 'X' as never },
        { commandId: 'c', expectedRunId: state.runId },
      ),
    ).toThrow(/INVALID_TRAIT/);
    expect(state.initializedCapital).toBe(false);
    expect(state.phase).toBe('CREATING');
  });
});
