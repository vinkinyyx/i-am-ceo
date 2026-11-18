/** 服务端下发的稳定账号档案（最小不透明标识，不含昵称/Token 原文）。 */
export interface AuthProfile {
  profileId: string;
  appId: string;
  environment: 'test' | 'production';
  scope: string;
  protocolVersion: 1;
}

/** 会话记录（存平台存储，独立于业务存档信封）。 */
export interface AuthSession {
  kind: 'taptap' | 'douyin' | 'wechat' | 'mock';
  /** 不透明短期会话令牌（真机由服务端签发；mock 为本地标记）。 */
  sessionToken: string;
  /** epoch 毫秒过期时间；0 表示不过期（mock）。 */
  expiresAtMs: number;
  /** 登录时网络状态，用于诊断。 */
  endpoint?: string;
  /** 服务端换票返回的稳定账号档案；旧版服务端无此字段时仅表示“已登录”。 */
  profile?: AuthProfile;
}

/**
 * DEV-01：权威身份刷新结果。
 * - verified：本次用新的平台登录 code 向平台/服务端重新确认过当前账号；
 * - unavailable：网络/认证暂时无法确认（无 verified、无账号切换副作用）；
 * - superseded：等待期间前台代际已变化，本次结果不得再被使用。
 */
export type IdentityRefreshResult =
  | { kind: 'verified'; session: AuthSession; requestGeneration: number }
  | { kind: 'unavailable'; reason: string; retryable: boolean }
  | { kind: 'superseded' };

/** 权威刷新原因（仅诊断归类，不记录任何敏感值）。 */
export type IdentityRefreshReason = 'foreground' | 'cloud' | 'leaderboard' | 'reward-reconcile';

export interface IPlatformAuth {
  setExpectedScope(appId: string, environment: 'test' | 'production'): void;
  ensureAuthenticated(): Promise<AuthSession>;
  hasValidSession(): Promise<boolean>;
  currentSession(): Promise<AuthSession | null>;
  refreshCurrentIdentity(input: {
    reason: IdentityRefreshReason;
    generation: number;
    stillCurrent: () => boolean;
  }): Promise<IdentityRefreshResult>;
}
