// R27：创建三步页纯逻辑（CEO 姓名校验/随机派生/创建提交意图/首聘展示/候选行）。
import { describe, it, expect } from 'vitest';
import {
  CEO_NAME_MAX,
  CreateSubmitGuard,
  candidateRows,
  ceoNameError,
  generateCeoName,
  initialHireView,
} from '../../assets/scripts/ui/createFlow.ts';
import { computePaneLayout, computeScrollBody } from '../../assets/scripts/ui/shellLayout.ts';
import { computeShellLayout } from '../../assets/scripts/ui/shellLayout.ts';

describe('R27 CEO 姓名校验（T02）', () => {
  it('空值/超长/控制符/标签/敏感词给出明确文案', () => {
    expect(ceoNameError('   ')).toBe('CEO 姓名不能为空');
    expect(ceoNameError('a'.repeat(CEO_NAME_MAX + 1))).toBe(`CEO 姓名最多 ${CEO_NAME_MAX} 个字`);
    expect(ceoNameError('\u0001张三')).toBe('姓名不能包含控制字符');
    expect(ceoNameError('<b>张三</b>')).toBe('姓名不能包含网页标签');
    expect(ceoNameError('腾讯三人组')).toBe('姓名包含不允许的词语，请换一个');
  });

  it('emoji 按 1 个字计：12 个通过、13 个拒绝', () => {
    expect(ceoNameError('😀'.repeat(CEO_NAME_MAX))).toBeNull();
    expect(ceoNameError('😀'.repeat(CEO_NAME_MAX + 1))).toBe(`CEO 姓名最多 ${CEO_NAME_MAX} 个字`);
  });

  it('合法中文姓名通过（去首尾空白）', () => {
    expect(ceoNameError('  林启航  ')).toBeNull();
  });
});

describe('R27 随机 CEO 姓名（T03）', () => {
  it('同一 seed+批次稳定可复现，且不触碰市场 RNG', () => {
    expect(generateCeoName('run_abc', 0)).toBe(generateCeoName('run_abc', 0));
    const names = new Set([0, 1, 2, 3, 4].map((n) => generateCeoName('run_abc', n)));
    expect(names.size).toBeGreaterThanOrEqual(3);
    for (const name of names) expect(ceoNameError(name)).toBeNull();
  });
});

describe('R27 创建提交意图（T06）', () => {
  it('连点只发一次：提交中再次 begin 被拒绝', () => {
    const guard = new CreateSubmitGuard();
    expect(guard.begin('c1')).toBe(true);
    expect(guard.begin('c1')).toBe(false);
    expect(guard.begin('c2')).toBe(false);
    expect(guard.attempts).toBe(1);
    expect(guard.busy).toBe(true);
  });

  it('明确失败复用同一 commandId 重试；成功后再点不再发命令', () => {
    const guard = new CreateSubmitGuard();
    guard.begin('c1');
    guard.fail();
    expect(guard.phase).toBe('IDLE');
    expect(guard.commandId).toBe('c1');
    expect(guard.begin('c1')).toBe(true);
    expect(guard.attempts).toBe(2);
    guard.succeed();
    expect(guard.done).toBe(true);
    expect(guard.begin('c1')).toBe(false);
  });

  it('run 已变化时 abort 结束本意图', () => {
    const guard = new CreateSubmitGuard();
    guard.begin('c1');
    guard.abort();
    expect(guard.done).toBe(true);
    expect(guard.begin('c1')).toBe(false);
  });
});

describe('R27 首聘进度（T04/T05）', () => {
  it('0/1 人不可继续，2 人才可继续', () => {
    const none = initialHireView(0);
    expect(none.done).toBe(false);
    expect(none.progressLabel).toBe('已录用 0/2');
    expect(none.continueLabel).toBe('还差 2 人（已录用 0/2）');

    const one = initialHireView(1);
    expect(one.done).toBe(false);
    expect(one.remaining).toBe(1);
    expect(one.hintLabel).toBe('还需招聘 1 人才能开始经营');

    const two = initialHireView(2);
    expect(two.done).toBe(true);
    expect(two.continueLabel).toBe('进入公司');
  });

  it('越界/异常值被夹紧，不会出现“已录用 3/2”', () => {
    expect(initialHireView(9).completed).toBe(2);
    expect(initialHireView(-1).completed).toBe(0);
    expect(initialHireView(Number.NaN).completed).toBe(0);
  });
});

describe('R27 候选卡逐行文案（T04）', () => {
  const candidate = {
    candidateId: 'c1',
    name: '陈明达',
    archetype: 'A',
    skill: 72,
    potential: 68,
    teamwork: 60,
    salaryMonthlyYuan: 5200,
  };

  it('姓名/属性/工资/招聘费分行，费用来自领域层传入值', () => {
    const rows = candidateRows(candidate, 5000, true);
    expect(rows.nameLine).toBe('陈明达（即战力）');
    expect(rows.abilityLine).toBe('能力 72 ｜ 潜力 68 ｜ 协作 60');
    expect(rows.salaryLine).toContain('月薪');
    expect(rows.feeLine).toContain('招聘费');
    expect(rows.hireLabel).toContain('5,000');
    expect(rows.hireEnabled).toBe(true);
  });

  it('费用不可用/余额不足时禁用录用，不猜费用', () => {
    expect(candidateRows(candidate, Number.NaN, true)).toMatchObject({
      feeLine: '招聘费暂不可用',
      hireEnabled: false,
    });
    expect(candidateRows(candidate, 5000, false)).toMatchObject({
      hireLabel: '当前现金不足',
      hireEnabled: false,
    });
  });
});

describe('R27 创建页几何（短屏底部按钮可达）', () => {
  it('375×812 带 64 页头 / 76 页脚：主体高与页脚行正确', () => {
    const shell = computeShellLayout({ width: 375, height: 812 });
    const pane = computePaneLayout(shell, { headerHeight: 64, footerHeight: 76 });
    expect(pane.bodyHeight).toBe(812 - 64 - 76);
    expect(pane.bodyTopY).toBe(342);
    expect(pane.bodyBottomY).toBe(-330);
    expect(pane.footerRowY + 25).toBeLessThanOrEqual(406);
    expect(pane.footerRowY - 25).toBeGreaterThanOrEqual(-406);
  });

  it('360×640 短屏：主体仍可滚动且底部按钮在屏内', () => {
    const shell = computeShellLayout({ width: 360, height: 640 });
    const pane = computePaneLayout(shell, { headerHeight: 64, footerHeight: 76 });
    const bottom = -shell.viewportHeight / 2;
    expect(pane.bodyHeight).toBeGreaterThan(400);
    expect(pane.footerRowY - 25).toBeGreaterThan(bottom);
    expect(pane.footerRowY + 25).toBeLessThan(shell.viewportHeight / 2);
  });

  it('内容未越界时按设计高 812 排版，authored 顶对齐可视顶', () => {
    const geo = computeScrollBody(672, -302);
    // 406 - (-302) + 8 = 716 < 设计高 812，取设计高保证所有 authored 节点在坐标内
    expect(geo.contentHeight).toBe(812);
    const bodyTop = 672 / 2;
    // authored 406 的子节点在内容坐标中的位置应等于内容顶边
    expect(geo.contentY + (406 + geo.shift)).toBe(bodyTop);
  });

  it('内容下探超过设计高时自动加高产生滚动', () => {
    const geo = computeScrollBody(672, -420);
    expect(geo.contentHeight).toBe(406 - -420 + 8);
    expect(geo.contentHeight).toBeGreaterThan(812);
    const bodyTop = 672 / 2;
    expect(geo.contentY + (406 + geo.shift)).toBe(bodyTop);
  });
});
