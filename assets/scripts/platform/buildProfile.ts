/**
 * R16：构建期平台标识（§15.4 R16）。
 *
 * 由转换/补丁流水线在最终包注入 globalThis.__CEO_BUILD__：
 *   { kind: 'taptap' | 'editor', releaseId, gameVersion }
 * 编辑器/本地预览未注入时为 null，按 editor 处理。
 * 纪律：只有 kind='taptap' 的包才允许创建真机平台；缺必需能力必须显式
 * PLATFORM_UNAVAILABLE，绝不静默返回 mock 会话。
 */
export type BuildKind = 'taptap' | 'editor';

export interface BuildProfile {
  kind: BuildKind;
  releaseId: string;
  gameVersion: string;
}

declare const globalThis: {
  __CEO_BUILD__?: Partial<BuildProfile>;
};

export function readBuildProfile(): BuildProfile {
  const injected = typeof globalThis !== 'undefined' ? globalThis.__CEO_BUILD__ : undefined;
  if (injected && injected.kind === 'taptap') {
    return {
      kind: 'taptap',
      releaseId: injected.releaseId ?? 'unknown',
      gameVersion: injected.gameVersion ?? '0.0.0',
    };
  }
  return { kind: 'editor', releaseId: injected?.releaseId ?? 'dev', gameVersion: injected?.gameVersion ?? '0.0.0' };
}

