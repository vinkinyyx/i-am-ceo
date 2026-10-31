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
}
