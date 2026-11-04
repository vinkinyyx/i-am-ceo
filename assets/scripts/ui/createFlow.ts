import type { IndustryId } from '../../core/domain/types';
import { validatePersonName } from '../../core/domain/validation';
import { moneyText } from './money';

/**
 * R27：创建三步页（S01 公司 / S02 CEO / S03 首聘）的纯逻辑。
 * 只负责文案、名称校验、随机姓名、提交意图与候选展示字段，不创建 Cocos 节点，
 * 便于 Node 直接单测；费用一律以领域层 previewHire 的结果传入，UI 不自行推算。
 */

export const CREATE_COPY = {
  stepCompany: '1/3 创建公司',
  stepCeo: '2/3 设定 CEO',
  stepHiring: '3/3 初始招聘',
  industryHint: '三种行业使用同一套经营规则；主营行业在本轮经营中不可更换。',
  companyNameHint: '候选名称只是建议，可换一批或自定义；名称创建后不可修改。',
  ceoNameHint: '可手填或随机，最多 12 个字；返回上一步不会丢失。',
  abilityHint: '初始总能力 150 点（各 50），之后按性格每年成长。',
  hireFeeHint: '招聘费 = 1 个月月薪，确认时立即支付；首聘当月到岗。',
} as const;

export const INDUSTRY_PRESENTATION: Record<IndustryId, { blurb: string }> = {
  TRADE: { blurb: '买卖差价、周转快，适合稳健起步' },
  SOFTWARE: { blurb: '产品复购、前期慢，成长潜力更高' },
  SERVICE: { blurb: '项目服务、客单高，订单波动更大' },
};

// ---------------------------------------------------------------- CEO 姓名

export const CEO_NAME_MAX = 12;

const NAME_ERROR_TEXT = {
  EMPTY: 'CEO 姓名不能为空',
  TOO_SHORT: 'CEO 姓名至少 1 个字',
  TOO_LONG: `CEO 姓名最多 ${CEO_NAME_MAX} 个字`,
  CONTROL_CHAR: '姓名不能包含控制字符',
  TAG: '姓名不能包含网页标签',
  FORBIDDEN_WORD: '姓名包含不允许的词语，请换一个',
} as const;

/** CEO 姓名错误文案（复用领域层既有校验，emoji 按 1 个字计）。 */
export function ceoNameError(raw: string): string | null {
  const result = validatePersonName(raw, CEO_NAME_MAX);
  return result.ok ? null : NAME_ERROR_TEXT[result.reason];
}

const SURNAMES = ['林', '陈', '赵', '王', '李', '周', '孙', '何', '吴', '郑'];
const GIVEN_NAMES = ['启航', '稳', '亲和', '远征', '思源', '明达', '一诺', '静宜', '致远', '知行'];

function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * 确定性的随机 CEO 姓名：由 runId + 批次号派生，不触碰市场/经营 RNG 流。
 * 同一 (seed, nonce) 永远得到同一个名字，便于复现与截图核对。
 */
export function generateCeoName(seed: string, nonce = 0): string {
  const h = hash32(`${seed}|ceo|${nonce}`);
  const surname = SURNAMES[h % SURNAMES.length] ?? SURNAMES[0]!;
  const given = GIVEN_NAMES[Math.floor(h / 7) % GIVEN_NAMES.length] ?? GIVEN_NAMES[0]!;
  return `${surname}${given}`;
}

// ---------------------------------------------------------------- 提交意图

/**
 * 创建公司提交守卫（T06：本轮只在 CEO 页“下一步”发出一次创建命令）。
 * - 第一次 begin 成功；提交中/已成功时再次 begin 一律拒绝（连点只一个意图）；
 * - 明确失败可 fail() 回到 IDLE，调用方复用同一 commandId 重试（幂等）；
 * - 成功后再 begin 不再放行，页面由 phase 切到首聘。
 */
export class CreateSubmitGuard {
  private state: 'IDLE' | 'SUBMITTING' | 'DONE' = 'IDLE';
  private id: string | null = null;
  private attemptsCount = 0;

  get phase(): 'IDLE' | 'SUBMITTING' | 'DONE' {
    return this.state;
  }

  get busy(): boolean {
    return this.state === 'SUBMITTING';
  }

  get done(): boolean {
    return this.state === 'DONE';
  }

  get attempts(): number {
    return this.attemptsCount;
  }

  get commandId(): string | null {
    return this.id;
  }

  begin(commandId: string): boolean {
    if (this.state !== 'IDLE' || commandId.length === 0) return false;
    this.id = commandId;
    this.state = 'SUBMITTING';
    this.attemptsCount += 1;
    return true;
  }

  /** 明确失败：回到可重试状态，commandId 保留。 */
  fail(): void {
    if (this.state === 'SUBMITTING') this.state = 'IDLE';
  }

  /** 成功：锁定本意图，后续点击不再发命令。 */
  succeed(): void {
    if (this.state === 'SUBMITTING') this.state = 'DONE';
  }

  /** 本轮已变化（RUN_CHANGED/RUN 已创建）：彻底结束本意图。 */
  abort(): void {
    this.state = 'DONE';
  }
}

// ---------------------------------------------------------------- 首聘展示

export interface InitialHireView {
  completed: number;
  required: number;
  done: boolean;
  remaining: number;
  progressLabel: string;
  hintLabel: string;
  continueLabel: string;
}

/** 首聘进度与底部继续按钮文案（仅 2/2 可继续）。 */
export function initialHireView(completedRaw: number, required = 2): InitialHireView {
  const requiredCount = Math.max(1, Math.floor(required));
  const completed = Number.isFinite(completedRaw)
    ? Math.max(0, Math.min(requiredCount, Math.floor(completedRaw)))
    : 0;
  const done = completed >= requiredCount;
  const remaining = requiredCount - completed;
  return {
    completed,
    required: requiredCount,
    done,
    remaining,
    progressLabel: `已录用 ${completed}/${requiredCount}`,
    hintLabel: done ? '首聘完成，可以进入公司' : `还需招聘 ${remaining} 人才能开始经营`,
    continueLabel: done ? '进入公司' : `还差 ${remaining} 人（已录用 ${completed}/${requiredCount}）`,
  };
}

export type CandidateArchetype = 'A' | 'B' | 'C';

const ARCHETYPE_LABELS: Record<CandidateArchetype, string> = {
  A: '即战力',
  B: '潜力股',
  C: '经济型',
};

export interface CandidateLike {
  candidateId: string;
  name: string;
  archetype: CandidateArchetype;
  skill: number;
  potential: number;
  teamwork: number;
  salaryMonthlyYuan: number;
}

export interface CandidateRows {
  nameLine: string;
  abilityLine: string;
  salaryLine: string;
  feeLine: string;
  hireLabel: string;
  hireEnabled: boolean;
}

/**
 * 候选卡逐行文案：姓名/属性/工资/招聘费分开显示，不再是挤在一起的小字。
 * feeYuan 必须来自领域层 previewHire；传 NaN 视为费用不可用并禁用录用。
 */
export function candidateRows(c: CandidateLike, feeYuan: number, affordable: boolean): CandidateRows {
  const archetype = ARCHETYPE_LABELS[c.archetype] ?? '候选';
  const feeValid = Number.isFinite(feeYuan) && feeYuan >= 0;
  const enabled = feeValid && affordable;
  return {
    nameLine: `${c.name}（${archetype}）`,
    abilityLine: `能力 ${c.skill} ｜ 潜力 ${c.potential} ｜ 协作 ${c.teamwork}`,
    salaryLine: `月薪 ${moneyText(c.salaryMonthlyYuan)}`,
    feeLine: feeValid ? `招聘费 ${moneyText(feeYuan)}（确认时支付）` : '招聘费暂不可用',
    hireLabel: !feeValid ? '费用不可用' : enabled ? `录用 · 支付 ${moneyText(feeYuan)}` : '当前现金不足',
    hireEnabled: enabled,
  };
}
