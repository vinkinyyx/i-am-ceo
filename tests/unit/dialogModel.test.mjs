// R25：弹窗通用件纯逻辑（确认状态机/几何/输入校验），不依赖 Cocos，可在 Node 直测。
import { describe, it, expect } from 'vitest';
import {
  ConfirmGuard,
  DIALOG_METRICS,
  basicInputError,
  computeDialogGeometry,
  computeInputCardY,
  dialogInputLength,
} from '../../assets/scripts/ui/dialogModel.ts';

describe('R25 确认状态机（T03/T04）', () => {
  it('T03 快速连点只发一个意图：第二次 begin 被拒绝', () => {
    const g = new ConfirmGuard();
    expect(g.begin()).toBe(true);
    expect(g.begin()).toBe(false);
    expect(g.begin()).toBe(false);
    expect(g.attempts).toBe(1);
    expect(g.phase).toBe('SUBMITTING');
  });

  it('T04 提交中不能关闭，也不能再次提交', () => {
    const g = new ConfirmGuard();
    g.begin();
    expect(g.canClose).toBe(false);
    expect(g.close()).toBe(false);
    expect(g.begin()).toBe(false);
    expect(g.phase).toBe('SUBMITTING');
  });

  it('结果未知保持锁定（不能关掉弹窗再点一次）', () => {
    const g = new ConfirmGuard();
    g.begin();
    g.markUncertain();
    expect(g.phase).toBe('UNCERTAIN');
    expect(g.busy).toBe(true);
    expect(g.canClose).toBe(false);
    expect(g.canConfirm).toBe(false);
    expect(g.begin()).toBe(false);
    expect(g.close()).toBe(false);
  });

  it('明确失败后允许同意图重试，也允许取消', () => {
    const g = new ConfirmGuard();
    g.begin();
    g.fail();
    expect(g.phase).toBe('FAILED');
    expect(g.canClose).toBe(true);
    expect(g.begin()).toBe(true);
    expect(g.attempts).toBe(2);
    g.fail();
    expect(g.close()).toBe(true);
    expect(g.phase).toBe('CLOSED');
  });

  it('成功提交从 SUBMITTING 直接关闭；关闭后任何操作都无效', () => {
    const g = new ConfirmGuard();
    g.begin();
    expect(g.succeed()).toBe(true);
    expect(g.phase).toBe('CLOSED');
    expect(g.begin()).toBe(false);
    expect(g.succeed()).toBe(false);
    expect(g.close()).toBe(false);
    g.fail();
    expect(g.phase).toBe('CLOSED');
  });

  it('空闲状态可直接关闭（纯展示弹窗）', () => {
    const g = new ConfirmGuard();
    expect(g.close()).toBe(true);
    expect(g.phase).toBe('CLOSED');
  });
});

describe('R25 弹窗几何（T01 小屏长内容）', () => {
  it('812 屏：长内容按可视区上限压缩并标记需滚动', () => {
    const geo = computeDialogGeometry({ viewportHeight: 812, desiredBodyHeight: 900 });
    expect(geo.clamped).toBe(true);
    expect(geo.bodyHeight).toBe(
      812 - DIALOG_METRICS.margin * 2 - DIALOG_METRICS.titleHeight - DIALOG_METRICS.footerHeight,
    );
    expect(geo.cardHeight).toBeLessThanOrEqual(812 - DIALOG_METRICS.margin * 2);
  });

  it('640 短屏：卡片不超出屏幕，标题与底部仍固定可见', () => {
    const geo = computeDialogGeometry({ viewportHeight: 640, desiredBodyHeight: 500 });
    expect(geo.clamped).toBe(true);
    expect(geo.cardHeight).toBe(640 - DIALOG_METRICS.margin * 2);
    expect(geo.bodyHeight).toBe(
      640 - DIALOG_METRICS.margin * 2 - DIALOG_METRICS.titleHeight - DIALOG_METRICS.footerHeight,
    );
    expect(geo.bodyHeight).toBeGreaterThanOrEqual(DIALOG_METRICS.minBodyHeight);
  });

  it('短内容不压缩（确认弹窗按需收缩）', () => {
    const geo = computeDialogGeometry({ viewportHeight: 812, desiredBodyHeight: 120 });
    expect(geo.clamped).toBe(false);
    expect(geo.bodyHeight).toBe(120);
    expect(geo.cardHeight).toBe(DIALOG_METRICS.titleHeight + 120 + DIALOG_METRICS.footerHeight);
  });

  it('极端矮屏正文收敛到下限，输出为有限值', () => {
    const geo = computeDialogGeometry({ viewportHeight: 260, desiredBodyHeight: 400 });
    expect(geo.bodyHeight).toBe(DIALOG_METRICS.minBodyHeight);
    expect(Number.isFinite(geo.cardHeight)).toBe(true);
  });
});

describe('R25 输入框键盘避让（T05）', () => {
  it('812 屏输入卡片整体位于上半区（键盘弹出不遮挡输入与按钮）', () => {
    const cardHeight = 256;
    const y = computeInputCardY(812, cardHeight);
    expect(y).toBe(812 / 4);
    expect(y + cardHeight / 2).toBeLessThan(812 / 2);
    expect(y - cardHeight / 2).toBeGreaterThan(-812 / 2);
  });

  it('640 短屏不越过屏幕顶部', () => {
    const cardHeight = 256;
    const y = computeInputCardY(640, cardHeight);
    expect(y + cardHeight / 2).toBeLessThanOrEqual(640 / 2 - 24);
  });
});

describe('R25 输入校验', () => {
  it('空值与纯空白不可提交', () => {
    expect(basicInputError('', { minLength: 2, maxLength: 20 })).toBe('内容不能为空');
    expect(basicInputError('   ', { minLength: 2, maxLength: 20 })).toBe('内容不能为空');
  });

  it('过短/过长按可见字数给出原因', () => {
    expect(basicInputError('甲', { minLength: 2, maxLength: 20 })).toBe('至少 2 个字');
    const long = '甲'.repeat(21);
    expect(basicInputError(long, { minLength: 2, maxLength: 20 })).toBe('最多 20 个字');
  });

  it('emoji/代理对按 1 个可见字形计数', () => {
    expect(dialogInputLength('👍🏽')).toBe(2);
    expect(basicInputError('👍🏽', { minLength: 2, maxLength: 20 })).toBeNull();
    expect(basicInputError('😀'.repeat(21), { minLength: 1, maxLength: 20 })).toBe('最多 20 个字');
  });

  it('合法输入返回 null', () => {
    expect(basicInputError('向上生长科技', { minLength: 2, maxLength: 20 })).toBeNull();
  });
});
