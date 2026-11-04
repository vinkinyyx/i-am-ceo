import type { IRewardedAdProvider, RewardedAdResult } from '@core/platform/IRewardedAdProvider';

/** Tests only. Production code must never import this helper. */
export class FakeRewardedAdProvider implements IRewardedAdProvider {
  result: RewardedAdResult = { kind: 'completed', sessionId: '' };
  available = true;
  calls = 0;
  isAvailable(): boolean { return this.available; }
  async show(sessionId: string): Promise<RewardedAdResult> {
    this.calls++;
    return this.result.kind === 'completed' ? { ...this.result, sessionId } : this.result;
  }
}
