import type { ITapPlatform } from '../../core/platform/ITapPlatform';
import { resolveTapRuntime, TapPlatform } from '../../core/platform/TapPlatform';
import { decidePlatform } from '../../core/platform/platformSelection';
import { GameError, GameErrorCode } from '../../core/domain/errors';
import { CocosPlatform } from './CocosPlatform';
import { readBuildProfile } from './buildProfile';

export type PlatformSelection =
  | { kind: 'taptap'; platform: ITapPlatform }
  | { kind: 'editor'; platform: ITapPlatform }
  | { kind: 'unavailable'; reason: string };

/**
 * 平台选择（R16 / 设计 §9.2）：
 * - 构建标识 kind=taptap：必须探测到 tap 运行时且必需能力齐全，否则 PLATFORM_UNAVAILABLE，
 *   绝不降级 EDITOR、绝不返回 mock 会话；
 * - 可选能力（getNetworkType/request 等）单独缺失只降级该能力（unknown/本地玩法）；
 * - 编辑器/web 预览：CocosPlatform（EDITOR）。
 *
 * 纪律：EditorMockPlatform 仅供测试引用，生产入口不 import Mock。
 */
export function selectPlatform(): PlatformSelection {
  const profile = readBuildProfile();
  const tap = resolveTapRuntime();
  const decision = decidePlatform({
    buildKind: profile.kind,
    hasTapRuntime: tap !== null,
    explicitTapDebug: isExplicitTapDebug(),
  });
  if (decision.kind === 'unavailable') {
    return { kind: 'unavailable', reason: decision.reason ?? 'platform-unavailable' };
  }
  if (decision.kind === 'taptap' && tap) {
    return { kind: 'taptap', platform: new TapPlatform(tap) };
  }
  return { kind: 'editor', platform: new CocosPlatform() };
}

export function createPlatform(): ITapPlatform {
  const selected = selectPlatform();
  if (selected.kind === 'unavailable') {
    throw new GameError(GameErrorCode.PLATFORM_UNAVAILABLE, { reason: selected.reason });
  }
  return selected.platform;
}

/** 编辑器显式联调开关（全局），默认 false。 */
function isExplicitTapDebug(): boolean {
  try {
    const g = globalThis as { __CEO_TAP_DEBUG__?: boolean };
    return g.__CEO_TAP_DEBUG__ === true;
  } catch {
    return false;
  }
}
