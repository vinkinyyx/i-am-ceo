/**
 * R02 夹具：在受控全局环境下“全新加载”一个核心 TS 模块。
 * vitest 对 assets/core 使用 ESM 单例缓存，无法模拟模块顶层
 * `new TextEncoder()` 在宿主缺能力时的首次执行；这里用 TS 转译 +
 * Function 构造在当前上下文中加载，相对 import 解析到 TS 源
 * （同一模块树使用独立缓存），从而精确复现“模块导入期即失败”的 REL-02 类问题。
 *
 * 仅测试使用，不依赖 @types/node（通过间接动态 require 获取 fs/path/typescript）。
 */
// 本文件必须与 node 内置模块交互，而工程 tsconfig 不带 @types/node，局部放宽类型
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const require: (spec: string) => any;
declare const __dirname: string;

const nodeRequire: (spec: string) => any =
  typeof require === 'function' ? require : ((globalThis as any).require as typeof require);

const fs = nodeRequire('fs') as {
  existsSync(p: string): boolean;
  statSync(p: string): { isFile(): boolean };
  readFileSync(p: string, enc: string): string;
};
const nodePath = nodeRequire('path') as { resolve(...parts: string[]): string; dirname(p: string): string; join(...parts: string[]): string };
const ts = nodeRequire('typescript') as {
  transpileModule(input: string, opts: unknown): { outputText: string };
  ModuleKind: { CommonJS: number };
  ScriptTarget: { ES2020: number };
};

// vitest 以 CJS 转译运行测试，__dirname 可用；兜底使用 process.cwd
const here: string =
  typeof __dirname === 'string'
    ? __dirname
    : nodePath.join(((globalThis as any).process?.cwd?.() as string) ?? '', 'tests/helpers');
const projectRoot = nodePath.resolve(here, '../../');

export interface FreshModuleLoader {
  load<T = Record<string, unknown>>(relativeFromCore: string): T;
}

export function createFreshLoader(): FreshModuleLoader {
  const cache = new Map<string, Record<string, unknown>>();

  function resolveTs(spec: string, fromFile: string): string | null {
    const base = nodePath.resolve(nodePath.dirname(fromFile), spec);
    for (const candidate of [`${base}.ts`, base, nodePath.join(base, 'index.ts')]) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
    return null;
  }

  function loadFile(file: string): Record<string, unknown> {
    if (cache.has(file)) return cache.get(file)!;
    const exports: Record<string, unknown> = {};
    const moduleObj = { exports };
    cache.set(file, exports);

    const source = fs.readFileSync(file, 'utf8');
    const code = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
      },
      fileName: file,
    }).outputText;

    const localRequire = (spec: string): unknown => {
      if (spec.startsWith('.') || spec.startsWith('/')) {
        const resolved = resolveTs(spec, file);
        if (resolved) return loadFile(resolved);
        return nodeRequire(spec);
      }
      if (spec.startsWith('@core/')) {
        const resolved = nodePath.join(projectRoot, 'assets/core', `${spec.slice('@core/'.length)}.ts`);
        if (fs.existsSync(resolved)) return loadFile(resolved);
      }
      return nodeRequire(spec);
    };

    const factory = new Function(
      'require',
      'module',
      'exports',
      '__filename',
      '__dirname',
      `${code}\n//# sourceURL=${file}`,
    ) as (
      req: (spec: string) => unknown,
      mod: { exports: unknown },
      exp: Record<string, unknown>,
      filename: string,
      dirname: string,
    ) => void;
    factory(localRequire, moduleObj, exports, file, nodePath.dirname(file));
    cache.set(file, moduleObj.exports as Record<string, unknown>);
    return moduleObj.exports as Record<string, unknown>;
  }

  return {
    load<T>(relativeFromCore: string): T {
      const file = nodePath.join(projectRoot, 'assets/core', `${relativeFromCore}.ts`);
      return loadFile(file) as T;
    },
  };
}
