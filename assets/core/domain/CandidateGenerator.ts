import { Rng, deriveSeed } from '../simulation/rng';
import { newId } from './ids';
import { GIVEN_NAMES, SURNAMES } from './peopleNames';
import type { Candidate, EmployeePersonality } from './types';

/**
 * 候选人生成（设计文档 05.3）。
 * 对每个部门 Offer 用 hash(runSeed, deptId, offerSequence) 衍生独立 RNG；
 * 固定产出 3 名分别体现 A 即战力 / B 潜力股 / C 经济型的候选。
 * 刷新（offerSequence+1）后旧 Offer 全部失效，但不影响市场事件随机流。
 */

interface ArchetypeSpec {
  archetype: 'A' | 'B' | 'C';
  skill: [number, number];
  potential: [number, number];
  teamwork: [number, number];
  salary: [number, number];
}

const ARCHETYPES: readonly ArchetypeSpec[] = [
  { archetype: 'A', skill: [75, 90], potential: [45, 75], teamwork: [45, 85], salary: [6200, 8000] },
  { archetype: 'B', skill: [50, 70], potential: [80, 98], teamwork: [50, 90], salary: [5000, 7200] },
  { archetype: 'C', skill: [45, 72], potential: [50, 85], teamwork: [55, 90], salary: [4000, 5800] },
];

const PERSONALITIES: readonly EmployeePersonality[] = ['BOLD', 'STEADY', 'COLLABORATIVE'];
const AVATAR_COUNT = 8;

export interface OfferSeedInput {
  runSeed: number;
  deptId: string;
  offerSequence: number;
}

export function offerRngFor({ runSeed, deptId, offerSequence }: OfferSeedInput): Rng {
  return new Rng(deriveSeed(runSeed, `offer:${deptId}`, offerSequence));
}

export function generateCandidates(input: OfferSeedInput): Candidate[] {
  const rng = offerRngFor(input);
  return ARCHETYPES.map((spec, index) => {
    const skill = rng.nextInt(spec.skill[0]!, spec.skill[1]!);
    const potential = rng.nextInt(spec.potential[0]!, spec.potential[1]!);
    const teamwork = rng.nextInt(spec.teamwork[0]!, spec.teamwork[1]!);
    const salary = rng.nextInt(spec.salary[0]!, spec.salary[1]!);
    const personality = rng.pick(PERSONALITIES);
    const name = `${rng.pick(SURNAMES)}${rng.pick(GIVEN_NAMES)}`;
    return {
      candidateId: newId('cand', `${input.runSeed}:${input.deptId}:${input.offerSequence}`, index + 1),
      name,
      avatarId: `avatar_${String((rng.nextInt(0, AVATAR_COUNT - 1) % AVATAR_COUNT) + 1).padStart(2, '0')}`,
      skill,
      potential,
      teamwork,
      personality,
      salaryMonthlyYuan: salary,
      archetype: spec.archetype,
    };
  });
}

/** 招聘费 = 1 个月月薪（bps 10000），可被已生效 HR 折扣调整（M2）。M0 返回基线。 */
export function recruitmentFee(salaryMonthlyYuan: number, discountBps = 0): number {
  const factor = Math.max(0, 10_000 - discountBps);
  return Math.round((salaryMonthlyYuan * factor) / 10_000);
}
