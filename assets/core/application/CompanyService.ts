import type { Rng } from '../simulation/rng';
import { GameErrorCode } from '../domain/errors';
import {
  INITIAL_CAPITAL_YUAN,
  ensureRunId,
  hasCommand,
  recordCommand,
} from './MutationContext';
import {
  isIndustry,
  isCeoTrait,
  validateCompanyName,
  validatePersonName,
} from './validators';
import { newId } from '../domain/ids';
import type { Ceo, Company, CeoTrait, GameState, IndustryId } from '../domain/types';

export interface CreateCompanyInput {
  companyName: string;
  industry: IndustryId;
  ceoName: string;
  ceoTrait: CeoTrait;
}

export interface CreateCompanyResult {
  companyId: string;
  runId: string;
  cashYuan: number;
}

/**
 * 创建公司（设计文档 12.3）。
 * 前置：phase=CREATING、无现存公司、行业/名称合法、未注资。
 * 执行：建公司+BUSINESS 主营部（无员工）、CEO 全 50、唯一一次注入 30 万；
 *       phase=HIRING_INITIAL、speed=0（首聘前时钟不启动）。
 * 幂等：同一 commandId 重试返回已创建公司；同 run 换新 commandId 再建 → NOT_READY。
 */
export function createCompany(
  state: GameState,
  input: CreateCompanyInput,
  ctx: { commandId: string; expectedRunId: string },
): CreateCompanyResult {
  ensureRunId(state, ctx.expectedRunId);

  // 幂等重放
  if (hasCommand(state, ctx.commandId)) {
    if (state.company) {
      return {
        companyId: state.company.companyId,
        runId: state.runId,
        cashYuan: state.company.cashYuan,
      };
    }
  }

  if (state.phase !== 'CREATING' || state.company !== null || state.initializedCapital) {
    throw new Error(GameErrorCode.NOT_READY);
  }

  const nameCheck = validateCompanyName(input.companyName);
  if (!nameCheck.ok) throw new Error(GameErrorCode.INVALID_NAME);
  const ceoNameCheck = validatePersonName(input.ceoName);
  if (!ceoNameCheck.ok) throw new Error(GameErrorCode.INVALID_NAME);
  if (!isIndustry(input.industry)) throw new Error(GameErrorCode.INVALID_INDUSTRY);
  if (!isCeoTrait(input.ceoTrait)) throw new Error(GameErrorCode.INVALID_TRAIT);

  const companyId = newId('co', state.runId, 0);
  const company: Company = {
    companyId,
    name: nameCheck.name,
    industry: input.industry,
    foundedYear: state.gameYear,
    cashYuan: INITIAL_CAPITAL_YUAN,
    initialCapitalYuan: INITIAL_CAPITAL_YUAN,
    paidInCapitalYuan: INITIAL_CAPITAL_YUAN,
    businessAssetBookYuan: 0,
    businessCapacityInvestmentYuan: 0,
    businessCapacityBonusBps: 0,
    marketDemandIndexBps: 10_000,
  };

  const ceo: Ceo = {
    name: ceoNameCheck.name,
    trait: input.ceoTrait,
    businessSkill: 50,
    managementSkill: 50,
    financeSkill: 50,
  };

  // 主营部自动存在（创建即有、AUTO 但首聘完成前不触发自动招聘）
  state.departments = [
    {
      deptId: newId('dp', `${state.runId}:BUSINESS`, 0),
      type: 'BUSINESS',
      enabled: true,
      staffingMode: 'AUTO',
      targetCount: 0,
      createdMonthIndex: 0,
      setupPaid: true,
    },
  ];

  state.company = company;
  state.ceo = ceo;
  state.initializedCapital = true;
  // 第1经营年开盘现金 = 唯一注资额（年报 cashOpen 口径，设计 12.9）
  state.yearOpenCashYuan = { 1: INITIAL_CAPITAL_YUAN };
  state.phase = 'HIRING_INITIAL';
  state.speed = 0;
  state.onboarding.stepId = 'TUT-03';
  state.onboarding.lastKnownStep = 'TUT-03';
  recordCommand(state, ctx.commandId);

  return { companyId, runId: state.runId, cashYuan: company.cashYuan };
}

/** 随机 CEO 姓名（便捷工具，非财务 RNG 流）。 */
export function rollCeoName(rng: Rng): string {
  const surnames = ['林', '陈', '赵', '王', '李', '周', '孙', '何'];
  const given = ['启航', '稳', '亲和', '远征', '思源', '明达', '一诺', '静宜'];
  return `${rng.pick(surnames)}${rng.pick(given)}`;
}
