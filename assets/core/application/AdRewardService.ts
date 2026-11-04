import type { AdRewardState, GameState } from '../domain/types';
import { GameErrorCode } from '../domain/errors';

const DAY_MS = 86_400_000;
const UTC8_MS = 8 * 60 * 60_000;
const MAX_REQUESTS_PER_DAY = 3;
const REQUEST_COOLDOWN_MS = 120_000;
const COUPON_TTL_DAYS = 7;
const empty = (): AdRewardState => ({ version: 2, maxObservedDayIndex: -1, requestsUsed: 0, lastRequestAtMs: null,
  localDay: '', promptsShown: 0, grantsUsed: 0, couponIds: [], completedSessionIds: [],
  activeSessionId: null, activeSessionStartedAtMs: null, activeRunId: null,
  activeSessionReservedDayIndex: null, grantDayIndexes: [], consumedCouponIds: [],
  couponCreatedAtMsById: {}, couponRunIdById: {} });
const validNow = (nowMs: number): boolean => Number.isSafeInteger(nowMs) && nowMs >= 0;
const dayIndex = (nowMs: number): number => Math.floor((nowMs + UTC8_MS) / DAY_MS);
const dayKey = (index: number): string => new Date(index * DAY_MS).toISOString().slice(0, 10);
/** Read normalization is pure: queries never write into the caller's old save. */
const stateOf = (s: GameState): AdRewardState => s.adRewards ?? empty();
function viewFor(s: GameState, nowMs: number): AdRewardState {
  const current = stateOf(s);
  if (!validNow(nowMs)) return current;
  const today = dayIndex(nowMs);
  const legacyIndex = current.localDay ? dayIndex(Date.parse(`${current.localDay}T00:00:00+08:00`)) : -1;
  const maxSeen = current.maxObservedDayIndex ?? (Number.isFinite(legacyIndex) ? legacyIndex : -1);
  if (today <= maxSeen) return { ...current, version: 2, maxObservedDayIndex: Math.max(maxSeen, today),
    grantsUsed: current.grantDayIndexes?.includes(today) ? 1 : current.grantsUsed };
  return { ...current, version: 2, maxObservedDayIndex: today, localDay: dayKey(today), promptsShown: 0,
    grantsUsed: current.grantDayIndexes?.includes(today) ? 1 : 0, requestsUsed: 0, lastRequestAtMs: null };
}

export function adQuotaForDay(s: GameState, nowMs: number): AdRewardState { return viewFor(s, nowMs); }

export function markAdPromptShown(s: GameState, nowMs: number): boolean {
  if (!validNow(nowMs)) return false;
  const current = viewFor(s, nowMs);
  if (current.promptsShown >= 1 || current.grantsUsed >= 1 || hasAvailableCoupon(s, current, nowMs)) return false;
  s.adRewards = { ...withLegacyCouponExpiry(current, nowMs), promptsShown: current.promptsShown + 1 };
  return true;
}

export function canRequestAdCoupon(s: GameState, nowMs: number): boolean {
  if (!validNow(nowMs) || s.phase !== 'RUNNING' || s.onboarding.initialHiresCompleted < 2) return false;
  const current = viewFor(s, nowMs);
  if (current.activeSessionId || current.grantsUsed >= 1 || hasAvailableCoupon(s, current, nowMs)) return false;
  if ((current.requestsUsed ?? 0) >= MAX_REQUESTS_PER_DAY) return false;
  return current.lastRequestAtMs == null || nowMs - current.lastRequestAtMs >= REQUEST_COOLDOWN_MS;
}

export function beginAdSession(s: GameState, sessionId: string, nowMs: number): boolean {
  if (!sessionId || !canRequestAdCoupon(s, nowMs)) return false;
  const current = viewFor(s, nowMs);
  s.adRewards = { ...withLegacyCouponExpiry(current, nowMs), requestsUsed: (current.requestsUsed ?? 0) + 1, lastRequestAtMs: nowMs,
    activeSessionId: sessionId, activeSessionStartedAtMs: nowMs, activeRunId: s.runId,
    activeSessionReservedDayIndex: dayIndex(nowMs) };
  return true;
}

export function cancelAdSession(s: GameState, sessionId: string, expectedRunId = s.runId): void {
  const current = stateOf(s);
  if (s.runId === expectedRunId && current.activeSessionId === sessionId && current.activeRunId === expectedRunId) {
    s.adRewards = { ...current, activeSessionId: null, activeSessionStartedAtMs: null, activeRunId: null, activeSessionReservedDayIndex: null };
  }
}

/** Award only after explicit native isEnded=true; transaction caller persists this draft atomically. */
export function grantAdCoupon(s: GameState, sessionId: string, nowMs: number, expectedRunId = s.runId): boolean {
  if (!validNow(nowMs) || s.runId !== expectedRunId) return false;
  const current = withLegacyCouponExpiry(viewFor(s, nowMs), nowMs);
  if (!sessionId) return false;
  if (current.completedSessionIds.includes(sessionId)) return true;
  if (current.activeSessionId !== sessionId || current.activeRunId !== expectedRunId || current.grantsUsed >= 1 || hasAvailableCoupon(s, current, nowMs)) return false;
  const reservedDay = current.activeSessionReservedDayIndex ?? dayIndex(nowMs);
  const created = keepRecentEntries(current.couponCreatedAtMsById ?? {}, 31);
  const couponRuns = keepRecentEntries(current.couponRunIdById ?? {}, 31);
  created[sessionId] = nowMs;
  couponRuns[sessionId] = expectedRunId;
  const grantDays = [...new Set([...(current.grantDayIndexes ?? []), reservedDay])].slice(-32);
  s.adRewards = { ...current, grantsUsed: grantDays.includes(current.maxObservedDayIndex ?? dayIndex(nowMs)) ? 1 : 0, grantDayIndexes: grantDays,
    couponIds: [...current.couponIds, sessionId].slice(-1), completedSessionIds: [...current.completedSessionIds, sessionId].slice(-32),
    couponCreatedAtMsById: created, couponRunIdById: couponRuns,
    activeSessionId: null, activeSessionStartedAtMs: null, activeRunId: null, activeSessionReservedDayIndex: null };
  return true;
}

export function isAdCouponAvailable(s: GameState, couponId: string | undefined, nowMs = Date.now()): boolean {
  return !!couponId && validNow(nowMs) && hasAvailableCoupon(s, stateOf(s), nowMs, couponId);
}

export function consumeAdCoupon(s: GameState, couponId?: string, nowMs = Date.now(), expectedRunId = s.runId): boolean {
  if (!couponId || s.runId !== expectedRunId || !isAdCouponAvailable(s, couponId, nowMs)) throw new Error(GameErrorCode.ALREADY_USED);
  const current = stateOf(s);
  const created = { ...(current.couponCreatedAtMsById ?? {}) };
  const couponRuns = { ...(current.couponRunIdById ?? {}) };
  delete created[couponId]; delete couponRuns[couponId];
  s.adRewards = { ...current, couponIds: current.couponIds.filter((id) => id !== couponId),
    couponCreatedAtMsById: created, couponRunIdById: couponRuns,
    consumedCouponIds: [...new Set([...(current.consumedCouponIds ?? []), couponId])].slice(-128) };
  return true;
}

function hasAvailableCoupon(s: GameState, state: AdRewardState, nowMs: number, onlyId?: string): boolean {
  return state.couponIds.some((id) => {
    if (onlyId && id !== onlyId) return false;
    const owner = state.couponRunIdById?.[id];
    if (owner && owner !== s.runId) return false;
    const created = state.couponCreatedAtMsById?.[id];
    // Legacy v1 coupons remain attached to their current run during migration;
    // their first transactional write records a stable creation timestamp.
    const effectiveCreated = created ?? (state.localDay ? Date.parse(`${state.localDay}T00:00:00+08:00`) : NaN);
    if (!Number.isFinite(effectiveCreated)) return true; // preserve legacy rights when their date is unknowable
    return Number.isSafeInteger(effectiveCreated) && dayIndex(nowMs) < dayIndex(effectiveCreated) + COUPON_TTL_DAYS;
  });
}

function withLegacyCouponExpiry(state: AdRewardState, nowMs: number): AdRewardState {
  const created = { ...(state.couponCreatedAtMsById ?? {}) };
  let changed = false;
  for (const id of state.couponIds) {
    if (created[id] !== undefined) continue;
    const legacyDay = state.localDay ? Date.parse(`${state.localDay}T00:00:00+08:00`) : nowMs;
    created[id] = Number.isFinite(legacyDay) ? legacyDay : nowMs;
    changed = true;
  }
  return changed ? { ...state, couponCreatedAtMsById: created } : state;
}

function keepRecentEntries<T>(record: Record<string, T>, max: number): Record<string, T> {
  return Object.fromEntries(Object.entries(record).slice(-max));
}
