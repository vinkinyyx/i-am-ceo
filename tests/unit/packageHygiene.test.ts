import { describe, it, expect } from 'vitest';

/**
 * B16 / 审核前技术检查：
 * - 真机生产平台入口（PlatformFactory / TapPlatform）不引用 EditorMock；
 * - 纯领域/平台核心不依赖浏览器 window/document/localStorage（小游戏运行时无 BOM/DOM）；
 * - TapPlatform 不硬编码任何密钥/token 字面量。
 *
 * 说明：核心 tsconfig 不包含 node 类型，这里用 createRequire 取内置 fs，
 * 避免引入 @types/node 依赖（vitest 运行时为 Node，require 可用）。
 */
declare const require: ((id: string) => unknown) | undefined;
declare const __dirname: string;
type NodeFs = {
  readFileSync(path: string, enc: string): string;
  existsSync(path: string): boolean;
};
type NodePath = { resolve(...parts: string[]): string };
const fallbackRequire = (globalThis as unknown as { require?: (id: string) => unknown }).require;
const nodeRequire = (typeof require === 'function' ? require : fallbackRequire) as
  | ((id: string) => unknown)
  | undefined;
if (!nodeRequire) throw new Error('node require unavailable in test runtime');
const fs = nodeRequire('fs') as NodeFs;
const path = nodeRequire('path') as NodePath;
const ROOT = path.resolve(__dirname, '../../');
const read = (p: string): string => fs.readFileSync(path.resolve(ROOT, p), 'utf8');

describe('B16 生产包平台卫生', () => {
  it('PlatformFactory 生产入口不 import EditorMockPlatform', () => {
    const src = read('assets/scripts/platform/PlatformFactory.ts');
    // 只检测真实 import/require，不误伤注释里的说明文字
    expect(src).not.toMatch(/import[^;]*EditorMockPlatform/);
    expect(src).not.toMatch(/require\([^)]*EditorMockPlatform/);
  });

  it('TapPlatform 不引用 EditorMock / MemoryStorage', () => {
    const src = read('assets/core/platform/TapPlatform.ts');
    expect(src).not.toMatch(/EditorMockPlatform/);
    expect(src).not.toMatch(/MemoryStorage/);
  });

  it('TapPlatform 只通过 globalThis.tap 访问运行时，不直接用 window/document/localStorage', () => {
    const src = read('assets/core/platform/TapPlatform.ts');
    // 允许出现在注释/字符串中对 localStorage 的禁止说明？生产实现里不应有实际引用
    const codeLines = src
      .split('\n')
      .filter((l) => !l.trimStart().startsWith('*') && !l.trimStart().startsWith('//'));
    const code = codeLines.join('\n');
    expect(code).not.toMatch(/\bwindow\./);
    expect(code).not.toMatch(/\bdocument\./);
    expect(code).not.toMatch(/\blocalStorage\b/);
  });

  it('领域核心（domain/sim/application/persistence）不引用 window/document/localStorage', () => {
    const files = [
      'assets/core/application/GameFacade.ts',
      'assets/core/application/GameStore.ts',
      'assets/core/simulation/monthly.ts',
      'assets/core/simulation/advanceMonth.ts',
      'assets/core/persistence/SaveRepository.ts',
      'assets/core/persistence/stateIntegrity.ts',
    ];
    for (const f of files) {
      expect(fs.existsSync(path.resolve(ROOT, f)), f).toBe(true);
      const src = read(f);
      expect(src, f).not.toMatch(/\blocalStorage\b/);
      expect(src, f).not.toMatch(/\bdocument\./);
    }
  });

  it('TapPlatform / AuthService 中无硬编码 secret/token 字面量（仅错误码/键名）', () => {
    for (const f of ['assets/core/platform/TapPlatform.ts', 'assets/core/platform/AuthService.ts']) {
      const src = read(f);
      expect(src, f).not.toMatch(/secret\s*[:=]\s*['"][A-Za-z0-9]{8,}['"]/i);
      expect(src, f).not.toMatch(/(server_)?token\s*[:=]\s*['"][A-Za-z0-9]{12,}['"]/i);
    }
  });

  it('运行时配置样例不含真实密钥（占位为空/示例域名）', () => {
    const src = read('assets/resources/config/runtime.config.json');
    const cfg = JSON.parse(src) as { authEndpoint: string; privacyPolicyUrl: string };
    expect(cfg.authEndpoint).toBe('');
    expect(cfg.privacyPolicyUrl).toBe('');
  });
});
