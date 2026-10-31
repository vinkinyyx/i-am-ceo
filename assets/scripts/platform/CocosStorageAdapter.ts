import { sys } from 'cc';
import type { IStorageBackend } from '../../core/platform/ITapPlatform';

/**
 * Cocos 运行时存储后端。
 * - Web/编辑器预览：sys.localStorage（仅在该宿主可用）。
 * - TapTap 小游戏：正式包应替换为 tap.setStorage 适配（M0-10 接入官方扩展）。
 * 领域层只依赖 IStorageBackend，不直接访问任何全局对象。
 */
export class CocosStorageAdapter implements IStorageBackend {
  private readonly storage: Storage;

  constructor() {
    const s = sys.localStorage;
    if (!s) {
      throw new Error('localStorage unavailable on this runtime');
    }
    this.storage = s;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = this.storage.getItem(key);
    if (raw === null || raw === undefined || raw === '') return null;
    return JSON.parse(raw) as T;
  }

  async set<T>(key: string, data: T): Promise<void> {
    this.storage.setItem(key, JSON.stringify(data));
  }

  async remove(key: string): Promise<void> {
    this.storage.removeItem(key);
  }
}
