/**
 * R04：纯 TS UTF-8 编码与 CRC32 宿主兼容。
 * - 与宿主 TextEncoder 逐字节一致性（ASCII/中文/emoji/组合字符/空串/孤立代理）；
 * - CRC32 已知向量；旧真实信封 checksum 不随实现替换而变化（由既有存档测试覆盖）；
 * - 缺 TextEncoder 时核心仍可导入并编码。
 */
import { describe, it, expect } from 'vitest';
import { encodeUtf8, utf8ByteLength } from '@core/persistence/utf8';
import { crc32String, crc32Bytes } from '@core/persistence/crc32';
import { withoutGlobalCapability } from '../helpers/faults';
import { createFreshLoader } from '../helpers/freshModule';

const SAMPLES = [
  '',
  'a',
  'The quick brown fox',
  '中文公司名',
  '《我是CEO》',
  '😀🎉', // 4 字节 emoji（代理对）
  'e\u0301', // e + 组合重音 U+0301
  '￥123,456.78',
  'a\uD83D', // 孤立高代理
  '\uDE00b', // 孤立低代理
  '\uD83D\uDE00', // 完整代理对 = 😀
  '混合 ASCII 与 emoji 🚀 结尾',
];

describe('R04-T01 UTF-8 与标准 TextEncoder 逐字节一致', () => {
  for (const text of SAMPLES) {
    it(`样本 ${JSON.stringify(text.slice(0, 12))}`, () => {
      const reference = new TextEncoder().encode(text);
      const actual = encodeUtf8(text);
      expect(Array.from(actual)).toEqual(Array.from(reference));
      expect(utf8ByteLength(text)).toBe(reference.length);
      expect(actual.length).toBe(reference.length);
    });
  }

  it('孤立高/低代理均输出替换字符 EF BF BD（与 TextEncoder fatal=false 一致）', () => {
    expect(Array.from(encodeUtf8('\uD800'))).toEqual([0xef, 0xbf, 0xbd]);
    expect(Array.from(encodeUtf8('\uDFFF'))).toEqual([0xef, 0xbf, 0xbd]);
    expect(Array.from(encodeUtf8('x\uD800y'))).toEqual([
      0x78, 0xef, 0xbf, 0xbd, 0x79,
    ]);
  });
});

describe('R04-T02 CRC32 已知向量与稳定性', () => {
  it('空串 CRC32 = 00000000', () => {
    expect(crc32String('')).toBe('00000000');
  });

  it('"123456789" CRC32 = cbf43926（IEEE 校验向量）', () => {
    expect(crc32String('123456789')).toBe('cbf43926');
  });

  it('中文/envelope 风格 JSON 多次计算稳定且 8 位小写', () => {
    const text = JSON.stringify({ checksum: '', revision: 7, runId: 'run-中-1', payload: { cash: 300000 } });
    const a = crc32String(text);
    const b = crc32String(text);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  it('crc32Bytes 直接对字节计算与字符串路径一致', () => {
    const bytes = encodeUtf8('我是CEO');
    const hex = crc32Bytes(bytes).toString(16).padStart(8, '0');
    expect(hex).toBe(crc32String('我是CEO'));
  });
});

describe('R04-T03 缺 TextEncoder 宿主', () => {
  it('全新加载 crc32 模块不依赖 TextEncoder，结果与当前实现相同', async () => {
    await withoutGlobalCapability('TextEncoder', async () => {
      const fresh = createFreshLoader().load<{ crc32String: (s: string) => string }>('persistence/crc32');
      for (const text of ['', '中文ABC😀', '《我是CEO》孤立代理\uD800']) {
        expect(fresh.crc32String(text)).toBe(crc32String(text));
      }
    });
  });
});

describe('R04-T04 存档预算按真实 UTF-8 字节', () => {
  it('中文字符按 3 字节、emoji 按 4 字节计量', () => {
    expect(utf8ByteLength('中')).toBe(3);
    expect(utf8ByteLength('😀')).toBe(4);
    expect(utf8ByteLength('a中😀')).toBe(1 + 3 + 4);
  });
});
