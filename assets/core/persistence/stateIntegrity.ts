import type { GameState, Employee } from '../domain/types';

/**
 * 业务级存档完整性校验（B14）。
 *
 * checksum 只能发现字节损坏，无法识别“结构完整但语义非法”的奇异存档
 * （例如：RUNNING 但没有公司、活动员工数为 0、员工不属于任何部门、
 * 现金为 NaN/负数越界、重复 runId 等）。装载恢复时必须拒绝此类存档，
 * 提示损坏而不是带着非法状态继续跑。
 *
 * 返回 null = 通过；否则返回可诊断原因（不展示给玩家细节，仅日志/上报）。
 */
export type IntegrityReason =
  | 'not-an-object'
  | 'bad-run-id'
  | 'bad-phase'
  | 'company-mismatch'
  | 'ceo-mismatch'
  | 'no-business-department'
  | 'active-employee-without-dept'
  | 'duplicate-employee-id'
  | 'non-array-collections'
  | 'non-finite-cash'
  | 'negative-cash'
  | 'cash-overflow'
  | 'bad-time';

export interface IntegrityCheck {
  ok: boolean;
  reason?: IntegrityReason;
}

const VALID_PHASES = new Set([
  'CREATING',
  'HIRING_INITIAL',
  'TUTORIAL_DASHBOARD',
  'RUNNING',
  'DISTRESS',
  'RESETTING',
]);

const MAX_MONEY = 100_000_000_000; // cfg.player.maxMoneyYuan

export function validateGameState(state: unknown): IntegrityCheck {
  const fail = (reason: IntegrityReason): IntegrityCheck => ({ ok: false, reason });

  if (state === null || typeof state !== 'object') return fail('not-an-object');
  const s = state as Partial<GameState>;

  if (typeof s.runId !== 'string' || s.runId.length === 0) return fail('bad-run-id');
  if (typeof s.phase !== 'string' || !VALID_PHASES.has(s.phase)) return fail('bad-phase');

  // 集合字段必须是数组
  if (
    !Array.isArray(s.employees) ||
    !Array.isArray(s.departments) ||
    !Array.isArray(s.monthlyLedgersRolling) ||
    !Array.isArray(s.annualReports) ||
    !Array.isArray(s.pendingEntries) ||
    !Array.isArray(s.offers)
  ) {
    return fail('non-array-collections');
  }

  // 已建档（非 CREATING）必须有公司与 CEO
  const hasCompany = s.phase !== 'CREATING';
  if (hasCompany) {
    if (!s.company || typeof s.company.cashYuan !== 'number') return fail('company-mismatch');
    if (!s.ceo || typeof s.ceo.businessSkill !== 'number') return fail('ceo-mismatch');
  }
  if (s.company) {
    const cash = s.company.cashYuan;
    if (typeof cash !== 'number' || !Number.isFinite(cash)) return fail('non-finite-cash');
    if (cash < 0) return fail('negative-cash');
    if (cash > MAX_MONEY) return fail('cash-overflow');
  }

  // 时间轴必须自洽
  if (
    typeof s.gameYear !== 'number' ||
    typeof s.gameMonth !== 'number' ||
    s.gameYear < 1 ||
    s.gameMonth < 1 ||
    s.gameMonth > 12
  ) {
    return fail('bad-time');
  }

  // 部门集合必须含主营业务部（已建档后）
  if (hasCompany) {
    const hasBiz = (s.departments as GameState['departments']).some((d) => d.type === 'BUSINESS');
    if (!hasBiz) return fail('no-business-department');
  }

  // 员工引用完整性：员工部门必须存在；employeeId 唯一
  const deptIds = new Set((s.departments as GameState['departments']).map((d) => d.deptId));
  const seenEmp = new Set<string>();
  for (const emp of s.employees as Employee[]) {
    if (seenEmp.has(emp.employeeId)) return fail('duplicate-employee-id');
    seenEmp.add(emp.employeeId);
    // 已生效的在职/待裁员工必须归属一个存在的部门
    if (
      (emp.status === 'ACTIVE' || emp.status === 'PENDING_DISMISSAL') &&
      !deptIds.has(emp.departmentId)
    ) {
      return fail('active-employee-without-dept');
    }
  }

  return { ok: true };
}
