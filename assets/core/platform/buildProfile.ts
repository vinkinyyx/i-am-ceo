export type MiniGameTarget = 'taptap' | 'douyin' | 'wechat';

export interface BuildProfile {
  kind: string;
  releaseId: string;
  gameVersion: string;
}

/** The packaging entry injects __CEO_BUILD__ before the game starts. */
export function readBuildProfile(injected: unknown = (globalThis as { __CEO_BUILD__?: unknown }).__CEO_BUILD__): BuildProfile {
  if (injected === undefined) return { kind: 'editor', releaseId: 'dev', gameVersion: '0.0.0' };
  const profile = typeof injected === 'object' && injected !== null ? injected as Partial<BuildProfile> : {};
  return {
    kind: typeof profile.kind === 'string' && profile.kind ? profile.kind : 'invalid-build-profile',
    releaseId: typeof profile.releaseId === 'string' ? profile.releaseId : 'unknown',
    gameVersion: typeof profile.gameVersion === 'string' ? profile.gameVersion : '0.0.0',
  };
}
