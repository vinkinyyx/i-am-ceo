import { describe, it, expect, beforeAll } from 'vitest';
import rawEconomy from '../../assets/resources/config/economy.v1.json';
import { registerConfig } from '@core/config/configLoader';
import type { EconomyConfig } from '@core/config/EconomyConfig';
import { monthlyCapacity, collaborationCoeffBps, ceoManagementCoeffBps } from '@core/simulation/capacity';
import { annualDemand, monthlyPotentialOrder } from '@core/simulation/market';
import type { Ceo, Department, Employee } from '@core/domain/types';

let cfg: EconomyConfig;
const ceo: Ceo = { name: 'C', trait: 'BOLD', businessSkill: 50, managementSkill: 50, financeSkill: 50 };
const businessDept: Department = {
  deptId: 'dp-biz', type: 'BUSINESS', enabled: true, staffingMode: 'AUTO',
  targetCount: 2, createdMonthIndex: 0, setupPaid: true,
};

function emp(id: string, skill: number, teamwork: number, effective = 0): Employee {
  return {
    employeeId: id, name: id, avatarId: 'a', departmentId: 'dp-biz',
    skill, potential: 60, teamwork, personality: 'STEADY', salaryMonthlyYuan: 5000,
    hiredAtMonthIndex: 0, effectiveFromMonthIndex: effective, dismissedAtMonthIndex: null, status: 'ACTIVE',
  };
}

beforeAll(() => {
  cfg = registerConfig(rawEconomy as never);
});

describe('M1-03 产能', () => {
  it('首年 2 名 skill60/team50 员工 → 月产能 66666.67 取整、年产能合计 800000', () => {
    const team = [emp('e1', 60, 50), emp('e2', 60, 50)];
    let total = 0;
    for (let m = 0; m < 12; m++) {
      const r = monthlyCapacity(cfg, 'TRADE', {
        businessEmployees: team, ceo, departments: [businessDept], businessCapacityInvestmentYuan: 0,
      }, m);
      total += r.monthlyCapacityYuan;
    }
    // 单人年 40 万，2 人 80 万；月 = 400000/12 = 33333.33/人
    expect(total).toBe(800_000);
  });

  it('协作/CEO 系数在基准点为 10000', () => {
    expect(collaborationCoeffBps(cfg, [emp('a', 60, 50), emp('b', 60, 50)])).toBe(10_000);
    expect(ceoManagementCoeffBps(cfg, ceo)).toBe(10_000);
  });

  it('未生效员工（次月入职）首月不计入产能', () => {
    const team = [emp('e1', 60, 50, 0), emp('e2', 60, 50, 1)];
    const m0 = monthlyCapacity(cfg, 'TRADE', {
      businessEmployees: team, ceo, departments: [businessDept], businessCapacityInvestmentYuan: 0,
    }, 0);
    expect(m0.headcount).toBe(1);
    expect(m0.monthlyCapacityYuan).toBe(33333);
  });

  it('高协作提升、低协作下降，且被钳制', () => {
    const high = collaborationCoeffBps(cfg, [emp('a', 60, 90), emp('b', 60, 90)]);
    const low = collaborationCoeffBps(cfg, [emp('a', 60, 0), emp('b', 60, 0)]);
    expect(high).toBeGreaterThan(10_000);
    expect(low).toBeLessThan(10_000);
  });
});

describe('M1-02/03 需求与订单', () => {
  it('首年贸易需求 720000，月潜在订单 60000', () => {
    expect(annualDemand(cfg, 'TRADE', 1).annualDemandYuan).toBe(720_000);
    expect(monthlyPotentialOrder(cfg, 'TRADE', 1, 1, 10_000)).toBe(60_000);
  });
  it('第2年需求按 10% 复利', () => {
    expect(annualDemand(cfg, 'TRADE', 2).annualDemandYuan).toBe(792_000);
    expect(annualDemand(cfg, 'TRADE', 3).annualDemandYuan).toBe(871_200);
  });
  it('三行业首年需求正确', () => {
    expect(annualDemand(cfg, 'SOFTWARE', 1).annualDemandYuan).toBe(400_000);
    expect(annualDemand(cfg, 'SERVICE', 1).annualDemandYuan).toBe(450_000);
  });
});
