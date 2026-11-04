/**
 * R16：正式包平台选择与能力边界。
 */
import { describe, it, expect } from 'vitest';
import { decidePlatform } from '@core/platform/platformSelection';

describe('R16-T01 发布构建缺 tap 能力→unavailable，不降级', () => {
  it('kind=taptap 且无运行时', () => {
    expect(decidePlatform({ buildKind: 'taptap', hasTapRuntime: false })).toEqual({
      kind: 'unavailable',
      reason: 'tap-runtime-missing-in-release-build',
    });
  });

  it('kind=taptap 且运行时齐全→taptap', () => {
    expect(decidePlatform({ buildKind: 'taptap', hasTapRuntime: true })).toEqual({
      kind: 'taptap',
    });
  });
});

describe('R16-T02/T03 编辑器/预览仍可用 CocosPlatform；可选能力不影响主决策', () => {
  it('editor 构建无 tap→editor', () => {
    expect(decidePlatform({ buildKind: 'editor', hasTapRuntime: false })).toEqual({
      kind: 'editor',
    });
  });

  it('editor 下即使存在 tap 也默认 editor，只有显式联调开关才选 taptap', () => {
    expect(decidePlatform({ buildKind: 'editor', hasTapRuntime: true })).toEqual({ kind: 'editor' });
    expect(
      decidePlatform({ buildKind: 'editor', hasTapRuntime: true, explicitTapDebug: true }),
    ).toEqual({ kind: 'taptap' });
  });
});
