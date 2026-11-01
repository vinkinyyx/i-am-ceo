import { describe, it, expect, beforeAll } from 'vitest';
import rawEconomy from '../../assets/resources/config/economy.v1.json';
import { registerConfig } from '@core/config/configLoader';
import type { EconomyConfig } from '@core/config/EconomyConfig';
import { createInitialState } from '@core/domain/gameStateFactory';
import { createCompany } from '@core/application/CompanyService';
import { GameClock, msPerMonth } from '@core/simulation/GameClock';
import type { Employee, GameState } from '@core/domain/types';

let cfg: EconomyConfig;
beforeAll(() => {
  cfg = registerConfig(rawEconomy as never);
});

function runningCompany(seed = 555): GameState {
  const state = createInitialState(1000, seed);
  createCompany(
    state,
    { companyName: '时钟测试公司', industry: 'TRADE', ceoName: 'CEO', ceoTrait: 'BOLD' },
    { commandId: 'c', expectedRunId: state.runId },
  );
  const deptId = state.departments[0]!.deptId;
  const mk = (id: string): Employee => ({
    employeeId: id, name: id, avatarId: 'a', departmentId: deptId,
    skill: 60, potential: 60, teamwork: 50, personality: 'STEADY', salaryMonthlyYuan: 5000,
    hiredAtMonthIndex: 0, effectiveFromMonthIndex: 0, dismissedAtMonthIndex: null, status: 'ACTIVE',
  });
  state.employees = [mk('e1'), mk('e2')];
  state.phase = 'RUNNING';
  state.speed = 1;
  return state;
}

describe('M1-05 在线时钟', () => {
  it('G008: 1× 300000ms 恰好 12 月（1 年）', () => {
    const state = runningCompany(1);
    const clock = new GameClock();
    const r = clock.tick(state, cfg, 300_000);
    expect(r.monthsAdvanced).toBe(12);
    expect(r.yearsClosed).toEqual([1]);
    expect(state.gameYear).toBe(2);
    expect(state.gameMonth).toBe(1);
  });

  it('G008: 2× 150000ms 恰好 12 月', () => {
    const state = runningCompany(2);
    state.speed = 2;
    const r = new GameClock().tick(state, cfg, 150_000);
    expect(r.monthsAdvanced).toBe(12);
  });

  it('G008: 5× 60000ms 恰好 12 月', () => {
    const state = runningCompany(3);
    state.speed = 5;
    const r = new GameClock().tick(state, cfg, 60_000);
    expect(r.monthsAdvanced).toBe(12);
  });

  it('月阈值正确：1×=25000 2×=12500 5×=5000', () => {
    expect(msPerMonth(cfg, 1)).toBe(25_000);
    expect(msPerMonth(cfg, 2)).toBe(12_500);
    expect(msPerMonth(cfg, 5)).toBe(5_000);
  });

  it('暂停(speed=0)不累积任何月份', () => {
    const state = runningCompany(4);
    state.speed = 0;
    const before = { y: state.gameYear, m: state.gameMonth };
    const r = new GameClock().tick(state, cfg, 600_000);
    expect(r.monthsAdvanced).toBe(0);
    expect(state.gameYear).toBe(before.y);
    expect(state.gameMonth).toBe(before.m);
  });

  it('不足一月累积进度但不结算，下次补足', () => {
    const state = runningCompany(5);
    const clock = new GameClock();
    expect(clock.tick(state, cfg, 20_000).monthsAdvanced).toBe(0);
    expect(clock.tick(state, cfg, 5_000).monthsAdvanced).toBe(1);
  });

  it('非法倍速抛 INVALID_SPEED', () => {
    const state = runningCompany(6);
    expect(() => new GameClock().setSpeed(state, 3 as never)).toThrow(/INVALID_SPEED/);
  });

  it('切换倍速在同年内连续推进', () => {
    const state = runningCompany(7);
    const clock = new GameClock();
    state.speed = 1;
    clock.tick(state, cfg, 25_000); // 1 月
    expect(state.gameMonth).toBe(2);
    state.speed = 5;
    clock.tick(state, cfg, 5_000); // 再 1 月
    expect(state.gameMonth).toBe(3);
  });
});
