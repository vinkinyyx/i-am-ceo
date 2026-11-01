import { game, screen, sys, view } from 'cc';
import type {
  ITapPlatform,
  LoginResult,
  NetworkState,
  PlatformHttpRequest,
  PlatformHttpResponse,
  Unsubscribe,
  WindowInfo,
} from '../../core/platform/ITapPlatform';
import { GameError, GameErrorCode } from '../../core/domain/errors';
import { CocosStorageAdapter } from './CocosStorageAdapter';

/**
 * Cocos 宿主平台实现（M0 阶段）。
 * 在编辑器与 web-mobile 预览下使用引擎 API；标记为 EDITOR 环境。
 * 真实 TapTap 构建（M0-10）将提供调用 tap.* 的 TapMiniGamePlatform，
 * 届时由构建/引导层选择，本类不直接依赖 tap 全局对象。
 */
export class CocosPlatform implements ITapPlatform {
  private readonly storageBackend: CocosStorageAdapter;

  constructor() {
    this.storageBackend = new CocosStorageAdapter();
  }

  getEnvironment(): 'EDITOR' {
    // M0：尚未接入 tap SDK，统一按 EDITOR（可本地游玩）。
    return 'EDITOR';
  }

  getWindowInfo(): WindowInfo {
    const size = view.getVisibleSize();
    return {
      width: size.width,
      height: size.height,
      pixelRatio: screen.devicePixelRatio,
    };
  }

  onShow(callback: () => void): Unsubscribe {
    game.on(game.EVENT_SHOW, callback);
    return () => game.off(game.EVENT_SHOW, callback);
  }

  onHide(callback: () => void): Unsubscribe {
    game.on(game.EVENT_HIDE, callback);
    return () => game.off(game.EVENT_HIDE, callback);
  }

  async login(): Promise<LoginResult> {
    // M0 编辑器/预览无真实登录
    return { mock: true };
  }

  async getNetworkState(): Promise<NetworkState> {
    return sys.isBrowser && navigator.onLine === false ? 'offline' : 'online';
  }

  get<T>(key: string): Promise<T | null> {
    return this.storageBackend.get<T>(key);
  }

  set<T>(key: string, data: T): Promise<void> {
    return this.storageBackend.set(key, data);
  }

  remove(key: string): Promise<void> {
    return this.storageBackend.remove(key);
  }

  /**
   * web/编辑器下的 HTTP（仅用于登录 code 交换的本地联调）。
   * 使用全局 fetch；无 fetch 环境（老 webview）时降级 XMLHttpRequest。
   */
  async request<T = unknown>(req: PlatformHttpRequest): Promise<PlatformHttpResponse<T>> {
    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timer = setTimeout(() => controller?.abort(), req.timeoutMs ?? 8000);
    try {
      if (typeof fetch === 'function') {
        const res = await fetch(req.url, {
          method: req.method ?? 'GET',
          headers: { 'Content-Type': 'application/json', ...(req.headers ?? {}) },
          body: req.data !== undefined ? JSON.stringify(req.data) : undefined,
          signal: controller?.signal,
        });
        const data = (await res.json().catch(() => null)) as T;
        return { statusCode: res.status, data };
      }
      return await this.xhrRequest<T>(req);
    } catch (err) {
      throw new GameError(GameErrorCode.PLATFORM_UNAVAILABLE, {
        api: 'request',
        cause: err instanceof Error ? err.message : String(err),
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private xhrRequest<T>(req: PlatformHttpRequest): Promise<PlatformHttpResponse<T>> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(req.method ?? 'GET', req.url);
      xhr.timeout = req.timeoutMs ?? 8000;
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onload = () => {
        try {
          resolve({ statusCode: xhr.status, data: JSON.parse(xhr.responseText) as T });
        } catch {
          resolve({ statusCode: xhr.status, data: null as unknown as T });
        }
      };
      xhr.onerror = () =>
        reject(new GameError(GameErrorCode.PLATFORM_UNAVAILABLE, { api: 'request', cause: 'xhr error' }));
      xhr.ontimeout = () =>
        reject(new GameError(GameErrorCode.PLATFORM_UNAVAILABLE, { api: 'request', cause: 'xhr timeout' }));
      xhr.send(req.data !== undefined ? JSON.stringify(req.data) : undefined);
    });
  }
}
