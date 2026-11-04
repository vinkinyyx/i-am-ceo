/** Result of an optional, user initiated rewarded video request. */
export type RewardedAdResult =
  | { kind: 'completed'; sessionId: string }
  | { kind: 'skipped' | 'unavailable' | 'failed'; reason?: string };

export interface IRewardedAdProvider {
  isAvailable(): boolean;
  show(sessionId: string): Promise<RewardedAdResult>;
  cancelActive?(): void;
  cancelLoading?(): void;
}
