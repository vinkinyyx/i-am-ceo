import type { ITapPlatform } from '../../core/platform/ITapPlatform';
import { resolveTapRuntime, TapPlatform } from '../../core/platform/TapPlatform';
import { CocosPlatform } from './CocosPlatform';

/**
 * 平台选择（设计文档 08.2）：
 * - 真机 TapTap 小游戏运行时（globalThis.tap 存在且方法齐全）→ TapPlatform；
 * - 其余（Cocos 编辑器 / web-mobile 预览）→ CocosPlatform（EDITOR 环境）。
 *
 * 纪律：EditorMockPlatform 仅供单元/集成测试引用，本生产入口不 import Mock，
 * 保证 Mock 不会被打进正式 TapTap 包。
 */
export function createPlatform(): ITapPlatform {
  const tap = resolveTapRuntime();
  if (tap) {
    return new TapPlatform(tap);
  }
  return new CocosPlatform();
}
