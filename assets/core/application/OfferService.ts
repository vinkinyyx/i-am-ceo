import { generateCandidates } from '../domain/CandidateGenerator';
import { GameErrorCode } from '../domain/errors';
import { newId } from '../domain/ids';
import type { CandidateOffer, GameState } from '../domain/types';

/**
 * Offer 管理（设计文档 12.2 getOffer/refreshOffer）。
 * - 每个部门仅保留当前一轮 Offer；刷新使旧 Offer 失效。
 * - Offer 生成使用独立可复现 RNG（offerSequence），不消耗市场事件流。
 */
function findDept(state: GameState, deptId: string) {
  const dept = state.departments.find((d) => d.deptId === deptId);
  if (!dept) throw new Error(GameErrorCode.DEPT_NOT_FOUND);
  return dept;
}

function currentSequence(state: GameState, deptId: string): number {
  return state.offers.filter((o) => o.deptId === deptId).length;
}

/** 获取或复用当前部门的 3 人 Offer（不刷新）。 */
export function getOffer(state: GameState, deptId: string): CandidateOffer {
  findDept(state, deptId);
  const existing = [...state.offers].reverse().find((o) => o.deptId === deptId);
  if (existing) return existing;
  return createOffer(state, deptId);
}

function createOffer(state: GameState, deptId: string): CandidateOffer {
  const sequence = currentSequence(state, deptId);
  const candidates = generateCandidates({
    runSeed: state.seed,
    deptId,
    offerSequence: sequence,
  });
  const offer: CandidateOffer = {
    offerId: newId('offer', `${state.runId}:${deptId}`, sequence),
    deptId,
    generatedForIndex: state.gameYear * 12 + state.gameMonth,
    expiresAtMonthIndex: Number.MAX_SAFE_INTEGER,
    offerSequence: sequence,
    candidates,
  };
  state.offers.push(offer);
  return offer;
}

/** 刷新：废弃当前 Offer 并生成新一轮。 */
export function refreshOffer(state: GameState, deptId: string): CandidateOffer {
  findDept(state, deptId);
  // 触发一轮新 sequence：通过先创建占位使计数 +1，再生成
  return createOffer(state, deptId);
}

export function findOffer(state: GameState, offerId: string): CandidateOffer | undefined {
  // 仅最新同部门 Offer 有效
  return [...state.offers].reverse().find((o) => o.offerId === offerId);
}

export function isOfferCurrent(state: GameState, offerId: string): boolean {
  const offer = state.offers.find((o) => o.offerId === offerId);
  if (!offer) return false;
  const latest = [...state.offers].reverse().find((o) => o.deptId === offer.deptId);
  return latest?.offerId === offerId;
}
