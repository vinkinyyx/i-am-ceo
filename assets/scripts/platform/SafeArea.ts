import type { ITapPlatform } from '../../core/platform/ITapPlatform';
import {
  computeSafeAreaTransform,
  type SafeAreaTransform,
} from '../../core/platform/safeArea';

export type { SafeAreaTransform };
export { computeSafeAreaTransform };

/**
 * 从平台取窗口信息并计算安全区变换；任何异常回落恒等变换（不阻断启动）。
 */
export function resolveSafeAreaTransform(platform: ITapPlatform): SafeAreaTransform {
  try {
    return computeSafeAreaTransform(platform.getWindowInfo());
  } catch {
    return { scale: 1, offsetX: 0, offsetY: 0, applied: false };
  }
}
