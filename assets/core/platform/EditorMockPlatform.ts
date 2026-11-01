import type {
  ITapPlatform,
  IStorageBackend,
  LoginResult,
  NetworkState,
  PlatformHttpRequest,
  PlatformHttpResponse,
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
  /** 测试注入的 HTTP 应答器；默认返回 503（模拟无服务端）。 */
  private httpHandler:
    | ((req: PlatformHttpRequest) => Promise<PlatformHttpResponse> | PlatformHttpResponse)
    | null = null;

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

  /** 测试：注入 HTTP 应答器（模拟最小服务端）。 */
  setHttpHandler(
    handler:
      | ((req: PlatformHttpRequest) => Promise<PlatformHttpResponse> | PlatformHttpResponse)
      | null,
  ): void {
    this.httpHandler = handler;
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

  async request<T = unknown>(req: PlatformHttpRequest): Promise<PlatformHttpResponse<T>> {
    if (this.httpHandler) {
      return (await this.httpHandler(req)) as PlatformHttpResponse<T>;
    }
    // 无注入应答器时模拟“服务端不可用”，不静默成功
    return { statusCode: 503, data: { code: 'TAPTAP_UPSTREAM_UNAVAILABLE' } as T };
  }
}
