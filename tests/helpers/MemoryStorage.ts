import type { IStorageBackend } from '../../assets/core/platform/ITapPlatform';
import { cloneJsonValue } from '../../assets/core/persistence/cloneGameState';

/**
 * 内存存储后端：用于编辑器 Mock 与单元/集成测试。
 * 可注入故障（failKeys / failWrites）以模拟写盘失败（B01/B02/SAVE_FAILED）。
 */
export class MemoryStorage implements IStorageBackend {
  private readonly data = new Map<string, unknown>();
  readonly writes: Array<{ key: string; size: number }> = [];

  /** 读取这些 key 时抛错（模拟损坏/IO 失败）。 */
  failReadKeys = new Set<string>();
  /** 写入这些 key 时抛错（模拟槽位写失败 / 空间不足）。 */
  failWriteKeys = new Set<string>();
  /** 读取时返回损坏 JSON 的 key（不反序列化，由上层校验 checksum）。 */
  corruptKeys = new Set<string>();

  async get<T>(key: string): Promise<T | null> {
    if (this.failReadKeys.has(key)) {
      throw new Error(`simulated read failure: ${key}`);
    }
    if (!this.data.has(key)) return null;
    const raw = this.data.get(key);
    if (this.corruptKeys.has(key)) {
      return '{__corrupt__' as unknown as T;
    }
    return raw as T;
  }

  async set<T>(key: string, data: T): Promise<void> {
    if (this.failWriteKeys.has(key)) {
      throw new Error(`simulated write failure: ${key}`);
    }
    // R05：不依赖宿主 structuredClone（MemoryStorage 同时用于编辑器与缺能力宿主验证）
    this.data.set(key, cloneJsonValue(data) as T);
    this.writes.push({ key, size: JSON.stringify(data).length });
  }

  async remove(key: string): Promise<void> {
    this.data.delete(key);
  }

  /** 测试辅助：直接窥视内部原始值。 */
  peekRaw(key: string): unknown {
    return this.data.has(key) ? this.data.get(key) : null;
  }

  /** 测试辅助：模拟持久化层“写了但内容损坏/回滚”的场景。 */
  overwriteRaw(key: string, value: unknown): void {
    this.data.set(key, value);
  }
}
