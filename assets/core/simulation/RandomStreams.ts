import { Rng, deriveSeed } from './rng';

/**
 * 随机流命名空间（设计文档 03.7 / 05.3）。
 * 关键不变量：刷新公司名 / 打开界面 / 刷候选 不得改变市场趋势与年度事件序列。
 * 每条流由 (runSeed, 命名空间, 序号) 确定性派生，无需在状态里推进共享计数器。
 */
export type StreamName =
  | 'market' // 年度市场趋势/需求指数
  | 'event' // 年度事件（hash(seed,runId,year,'event')）
  | 'offer' // 招聘候选（OfferService 已按 dept+sequence 派生）
  | 'companyName' // 公司名刷新
  | 'personName' // 人名
  | 'bot'; // 本地模拟企业

export class RandomStreams {
  constructor(private readonly runSeed: number) {}

  /** 取某命名空间下指定序号的独立 RNG。 */
  stream(name: StreamName, sequence: number): Rng {
    return new Rng(deriveSeed(this.runSeed, name, sequence));
  }

  /** 年度市场 RNG（按游戏年，1 起始）。 */
  marketForYear(year: number): Rng {
    return this.stream('market', year);
  }

  /** 年度事件判定 RNG（按游戏年）。M3 使用，先固定接口。 */
  eventForYear(year: number): Rng {
    return new Rng(deriveSeed(this.runSeed, 'event', year));
  }

  /** 公司名刷新流（带刷新序号），与市场流完全隔离。 */
  companyNames(rollSequence: number): Rng {
    return this.stream('companyName', rollSequence);
  }
}

/** 便利：给定 runSeed 直接取流。 */
export function streamsFor(runSeed: number): RandomStreams {
  return new RandomStreams(runSeed);
}
