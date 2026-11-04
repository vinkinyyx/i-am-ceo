/**
 * R16：平台选择决策（纯函数，宿主无关）。
 * 实际 Cocos/tap 对象的构造在 scripts/platform/PlatformFactory 完成；
 * 这里只输出决策，便于在 Node 单测中验证“正式包缺能力必须报错”。
 */

export type SelectionKind = 'taptap' | 'editor' | 'unavailable';

export interface SelectionInput {
  /** 构建期标识：发布包必须为 'taptap'。 */
  buildKind: 'taptap' | 'editor';
  /** 是否探测到方法齐全的 tap 运行时。 */
  hasTapRuntime: boolean;
  /** 编辑器下是否显式开启 tap 联调。 */
  explicitTapDebug?: boolean;
}

export interface SelectionDecision {
  kind: SelectionKind;
  reason?: string;
}

export function decidePlatform(input: SelectionInput): SelectionDecision {
  if (input.buildKind === 'taptap') {
    if (!input.hasTapRuntime) {
      return { kind: 'unavailable', reason: 'tap-runtime-missing-in-release-build' };
    }
    return { kind: 'taptap' };
  }
  if (input.hasTapRuntime && input.explicitTapDebug === true) return { kind: 'taptap' };
  return { kind: 'editor' };
}
