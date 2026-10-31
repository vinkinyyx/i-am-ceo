import type { Rng } from '../simulation/rng';
import {
  COMPANY_NAME_ENDINGS,
  COMPANY_NAME_PREFIXES,
  INDUSTRY_SUFFIXES,
} from './companyNames';
import { GIVEN_NAMES, SURNAMES } from './peopleNames';
import type { IndustryId } from './types';

/**
 * 名称生成器（设计文档 05.1）。
 * 使用调用方提供的独立 RNG 流：刷新公司名不消耗市场事件随机序列。
 */
export class NameGenerator {
  constructor(private readonly rng: Rng) {}

  /** 生成 count 个互不相同的趣味公司名。 */
  rollCompanyNames(industry: IndustryId, count = 3): string[] {
    const suffixes = INDUSTRY_SUFFIXES[industry] ?? [];
    // 注意：不使用 new Set + 展开（Babel 降级为 [].concat(set) 会把整个 Set 当单元素）
    const results: string[] = [];
    let guard = 0;
    while (results.length < count && guard < count * 80) {
      guard += 1;
      const prefix = this.rng.pick(COMPANY_NAME_PREFIXES);
      const suffix = this.rng.pick(suffixes);
      const ending = this.rng.pick(COMPANY_NAME_ENDINGS);
      const full = `${prefix}${suffix}${ending}`;
      const name = Array.from(full).length <= 20 ? full : `${prefix}${suffix}`;
      if (!results.includes(name)) results.push(name);
    }
    return results;
  }

  /** 随机中文人名。 */
  rollPersonName(): string {
    return `${this.rng.pick(SURNAMES)}${this.rng.pick(GIVEN_NAMES)}`;
  }
}
