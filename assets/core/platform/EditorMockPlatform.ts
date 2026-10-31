import type {
  ITapPlatform,
  IStorageBackend,
  LoginResult,
  NetworkState,
  Unsubscribe,
  WindowInfo,
} from './ITapPlatform';
import { MemoryStorage } from './MemoryStorage';

/**
 * 编辑器/测试用平台 Mock（设计文档 08.2）。
 * 关键纪律：本类及其引用严禁被打进正式 TapTap 包生产入口；
 * 真实包使用 TapMiniGamePlatform。
 */
export class EditorMockPlatform implements ITapPlatform {
  private readonly storage: IStorageBackend;
  private readonly showListeners = new Set<() => void>();
  private readonly hideListeners = new Set<() => void>();
  private network: NetworkState = 'online';
  private windowInfo: WindowInfo;

  constructor(storage?: IStorageBackend, windowInfo?: WindowInfo) {
    this.storage = storage ?? new MemoryStorage();
    this.windowInfo = windowInfo ?? {
      // 设计基准 375x812 竖屏逻辑像素
      width: 375,
      height: 812,
      pixelRatio: 2,
      safeArea: { top: 44, bottom: 34, left: 0, right: 0 },
    };
  }

  getEnvironment(): 'EDITOR' {
    return 'EDITOR';
  }

  getWindowInfo(): WindowInfo {
    return this.windowInfo;
  }

  setWindowInfo(info: WindowInfo): void {
    this.windowInfo = info;
  }

  onShow(callback: () => void): Unsubscribe {
    this.showListeners.add(callback);
    return () => this.showListeners.delete(callback);
  }

  onHide(callback: () => void): Unsubscribe {
    this.hideListeners.add(callback);
    return () => this.hideListeners.delete(callback);
  }

  /** 测试/模拟：触发回到前台。 */
  emitShow(): void {
    for (const cb of this.showListeners) cb();
  }

  /** 测试/模拟：触发进入后台。 */
  emitHide(): void {
    for (const cb of this.hideListeners) cb();
  }

  async login(): Promise<LoginResult> {
    return { mock: true };
  }

  async getNetworkState(): Promise<NetworkState> {
    return this.network;
  }

  setNetworkState(state: NetworkState): void {
    this.network = state;
  }

  get<T>(key: string): Promise<T | null> {
    return this.storage.get<T>(key);
  }

  set<T>(key: string, data: T): Promise<void> {
    return this.storage.set(key, data);
  }

  remove(key: string): Promise<void> {
    return this.storage.remove(key);
  }
}
