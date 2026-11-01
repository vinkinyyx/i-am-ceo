/**
 * TapTap 平台抽象（设计文档 08.2）。
 * 真实实现调用 tap.* 接口；编辑器/测试使用 EditorMock。
 * 注意：抽象方法签名不是 tap SDK 签名，真实适配需以官方 SDK 为准做转换。
 * 禁止在领域/业务代码中直接访问 window/document/localStorage。
 */

export type PlatformKind = 'TAPTAP' | 'EDITOR';

export interface SafeArea {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface WindowInfo {
  width: number;
  height: number;
  pixelRatio?: number;
  safeArea?: SafeArea;
}

export type NetworkState = 'online' | 'offline' | 'unknown';

export interface LoginResult {
  /** 真实平台返回一次性 code；编辑器 Mock 返回 mock:true。 */
  code?: string;
  mock?: boolean;
}

/** 平台无关的 HTTP 请求结果（用于 code2Session 最小服务端交换）。 */
export interface PlatformHttpResponse<T = unknown> {
  statusCode: number;
  data: T;
}

export interface PlatformHttpRequest {
  url: string;
  method?: 'GET' | 'POST';
  data?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export type Unsubscribe = () => void;

export interface IStorageBackend {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, data: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface ITapPlatform extends IStorageBackend {
  getEnvironment(): PlatformKind;
  getWindowInfo(): WindowInfo;
  onShow(callback: () => void): Unsubscribe;
  onHide(callback: () => void): Unsubscribe;
  login(): Promise<LoginResult>;
  getNetworkState(): Promise<NetworkState>;
  /**
   * 发起 HTTPS 请求（真机走 tap.request；web/编辑器走 fetch/XHR）。
   * 仅用于与项目自有最小服务端交换登录 code，不采集/上传任何经营数据。
   */
  request<T = unknown>(req: PlatformHttpRequest): Promise<PlatformHttpResponse<T>>;
}
