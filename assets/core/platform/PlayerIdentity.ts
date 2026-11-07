/**
 * R31/A24-05：玩家身份来源（窄接口）。
 *
 * 约束：
 * - 开发者 OAuth 只授权管理后台，不是玩家身份；
 * - tap.login 的一次性 code / sessionToken 不是跨设备稳定标识；
 * - 昵称、设备号、固定常量、每设备随机 ID 都不得冒充跨设备账号；
 * - 只有官方当前普通小游戏可验证的稳定账号作用域（或必要的可信服务端会话）才算 verified；
 * - 官方能力未确认时返回 unavailable，生产保持禁用，不猜测 API。
 */
export type PlayerScope = 'tap-minigame-account';

export interface VerifiedPlayerIdentity {
  kind: 'verified';
  /** 稳定账号作用域内的最小不透明标识（不含 Token/昵称）。 */
  profileId: string;
  scope: PlayerScope;
  appId: string;
  environment: 'test' | 'production';
  /** 解析时的账号代际，供迟到回调比对。 */
  epoch: number;
}

export type PlayerIdentityResult =
  | { kind: 'unavailable'; reason: string }
  | { kind: 'authenticating' }
  | VerifiedPlayerIdentity
  | { kind: 'changed'; fromProfileId: string | null; toProfileId: string };

export interface IPlayerIdentityProvider {
  readonly scope: PlayerScope;
  /** 只读解析；不写玩家经营档，不产生云/榜副作用。 */
  resolve(): Promise<PlayerIdentityResult>;
}

/**
 * B2：来自“服务端换票会话”的身份来源。
 *
 * 只有 AuthService 已拿到服务端签发的账号档案（profileId/appId/environment/scope）
 * 且会话未过期、作用域与本构建一致时，才返回 verified；否则一律 unavailable。
 * 不读取昵称、设备号、登录 code 或 sessionToken 作为身份。
 */
export interface AuthSessionSnapshot {
  kind: 'taptap' | 'mock';
  expiresAtMs: number;
  profile?: {
    profileId: string;
    appId: string;
    environment: 'test' | 'production';
    scope: string;
  };
}

export class SessionPlayerIdentityProvider implements IPlayerIdentityProvider {
  readonly scope: PlayerScope = 'tap-minigame-account';

  constructor(
    private readonly loadSession: () => Promise<AuthSessionSnapshot | null>,
    private readonly appId: string,
    private readonly environment: 'test' | 'production',
    private readonly now: () => number = () => Date.now(),
  ) {}

  async resolve(): Promise<PlayerIdentityResult> {
    const session = await this.loadSession().catch(() => null);
    if (!session) return { kind: 'unavailable', reason: 'no-platform-session' };
    if (session.kind !== 'taptap') return { kind: 'unavailable', reason: 'not-tap-runtime' };
    if (!session.profile) return { kind: 'unavailable', reason: 'session-without-stable-profile' };
    if (!(session.expiresAtMs > this.now())) return { kind: 'unavailable', reason: 'session-expired' };
    const profile = session.profile;
    if (profile.scope !== 'tap-minigame-account') return { kind: 'unavailable', reason: 'identity-scope-unsupported' };
    if (profile.appId !== this.appId || profile.environment !== this.environment) {
      return { kind: 'unavailable', reason: 'identity-scope-mismatch' };
    }
    return {
      kind: 'verified',
      profileId: profile.profileId,
      scope: 'tap-minigame-account',
      appId: this.appId,
      environment: this.environment,
      epoch: 0,
    };
  }
}

/**
 * 账号代际：同一 profileId 沿用；换号时递增并标记 changed，旧请求凭 epoch 被丢弃。
 */
export class PlayerIdentityState {
  private profile: VerifiedPlayerIdentity | null = null;
  private epoch = 0;

  constructor(readonly appId: string, readonly environment: 'test' | 'production') {}

  get current(): VerifiedPlayerIdentity | null { return this.profile; }
  get currentEpoch(): number { return this.epoch; }
  get profileId(): string | null { return this.profile?.profileId ?? null; }

  apply(result: PlayerIdentityResult): PlayerIdentityResult {
    if (result.kind !== 'verified') {
      if (result.kind === 'unavailable') {
        const hadVerifiedProfile = this.profile !== null;
        this.profile = null;
        if (hadVerifiedProfile) this.epoch += 1;
      }
      return result;
    }
    if (result.appId !== this.appId || result.environment !== this.environment) {
      const hadVerifiedProfile = this.profile !== null;
      this.profile = null;
      if (hadVerifiedProfile) this.epoch += 1;
      return { kind: 'unavailable', reason: 'identity-scope-mismatch' };
    }
    const previous = this.profile?.profileId ?? null;
    if (previous === result.profileId) return { ...result, epoch: this.epoch };
    this.epoch += 1;
    this.profile = { ...result, epoch: this.epoch };
    return previous === null ? this.profile : { kind: 'changed', fromProfileId: previous, toProfileId: result.profileId };
  }
}
