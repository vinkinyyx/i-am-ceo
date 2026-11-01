import { newId } from '../domain/ids';
import type { GameState, JournalCategory, JournalEntry } from '../domain/types';
import {
  deptIdAtMonth as simDeptIdAtMonth,
  applyDueTransfers as simApplyDueTransfers,
} from '../simulation/departments';

export { simApplyDueTransfers as applyDueTransfers };

/**
 * 一次性费用分录与月份轴工具（应用层共享）。
 * 招聘费/裁员赔偿/建部费等在命令确认时立即扣现金，
 * 同时登记 pendingEntries，供所属月份月结计入损益（不重复扣现金）。
 */

/** 当前月份轴索引（创业第1年第1月 = 0）。 */
export function monthIndexOf(state: GameState): number {
  return (state.gameYear - 1) * 12 + (state.gameMonth - 1);
}

/** 员工在指定月份轴的实际归属部门（调岗下月生效），委托 simulation 层实现。 */
export function deptIdAtMonth(
  emp: { departmentId: string; pendingDepartmentId?: string; transferFromMonthIndex?: number | null },
  monthIndex: number,
): string {
  return simDeptIdAtMonth(emp, monthIndex);
}

function monthKey(state: GameState): string {
  return `${state.runId}:${state.gameYear}:${state.gameMonth}`;
}

/**
 * 登记一笔一次性损益分录。
 * @param amountYuan 带符号金额（费用为负、收入为正）
 * @param alreadyPaid 现金是否已在命令确认时支付（月结不再扣现金）
 */
export function addPendingEntry(
  state: GameState,
  category: JournalCategory,
  amountYuan: number,
  refId: string,
  alreadyPaid = true,
): JournalEntry {
  const entry: JournalEntry = {
    entryId: newId('je', `${state.runId}:${category}:${refId}`, state.pendingEntries.length + 1),
    monthKey: monthKey(state),
    category,
    amountYuan,
    isCash: true,
    alreadyPaid,
    refId,
  };
  state.pendingEntries.push(entry);
  return entry;
}
