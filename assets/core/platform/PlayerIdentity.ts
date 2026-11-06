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
 * 普通 Tap 小游戏宿主：当前工程未取得官方文档确认的稳定账号标识能力。
 * 不调用任何猜测性 API；返回不可用，云备份/真实榜在生产保持禁用。
 */
export class TapPlayerIdentityProvider implements IPlayerIdentityProvider {
  readonly scope: PlayerScope = 'tap-minigame-account';

  async resolve(): Promise<PlayerIdentityResult> {
    return { kind: 'unavailable', reason: 'official-stable-account-id-unconfirmed' };
  }
}

/**
 * 账号代际：同一 profileId 沿用；换号时递增并标记 changed，旧请求凭 epoch 被丢弃。
 */
export class PlayerIdentityState {
  private profile: VerifiedPlayerIdentity | null = null;
  private epoch = 0;

  constructor(private readonly appId: string, private readonly environment: 'test' | 'production') {}

  get current(): VerifiedPlayerIdentity | null { return this.profile; }
  get currentEpoch(): number { return this.epoch; }
  get profileId(): string | null { return this.profile?.profileId ?? null; }

  apply(result: PlayerIdentityResult): PlayerIdentityResult {
    if (result.kind !== 'verified') {
      if (result.kind === 'unavailable') {
        this.profile = null;
        this.epoch += 1;
      }
      return result;
    }
    if (result.appId !== this.appId || result.environment !== this.environment) {
      return { kind: 'unavailable', reason: 'identity-scope-mismatch' };
    }
    const previous = this.profile?.profileId ?? null;
    if (previous === result.profileId) return { ...result, epoch: this.epoch };
    this.epoch += 1;
    this.profile = { ...result, epoch: this.epoch };
    return previous === null ? this.profile : { kind: 'changed', fromProfileId: previous, toProfileId: result.profileId };
  }
}
