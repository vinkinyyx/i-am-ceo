/**
 * 纯 TypeScript UTF-8 编码器（R04 / REL-02）。
 * 不依赖宿主 TextEncoder / DOM / 平台 SDK，可在缺能力的小游戏运行时工作。
 *
 * 语义与 WHATWG TextEncoder（fatal=false，默认 replacement 模式）对齐：
 * - 码点 U+0000–U+FFFF 按 1–3 字节编码；
 * - 代理对（高代理 U+D800–U+DBFF + 低代理 U+DC00–U+DFFF）合并为码点后 4 字节；
 * - 孤立高/低代理按 Unicode 替换字符 U+FFFD（EF BF BD）输出；
 * - 返回长度等于字节数的新 Uint8Array。
 *
 * 该实现只用于 checksum 与存档字节计量；不得改变 canonical 序列化内容。
 */
const REPLACEMENT = 0xfffd;

/** 返回字符在 UTF-16 索引 i 处的 Unicode 码点；孤立代理返回 U+FFFD。 */
function codePointAt(text: string, i: number): { code: number; next: number } {
  const unit = text.charCodeAt(i);
  if (unit >= 0xd800 && unit <= 0xdbff) {
    const low = i + 1 < text.length ? text.charCodeAt(i + 1) : NaN;
    if (low >= 0xdc00 && low <= 0xdfff) {
      const code = 0x10000 + ((unit - 0xd800) << 10) + (low - 0xdc00);
      return { code, next: i + 2 };
    }
    return { code: REPLACEMENT, next: i + 1 };
  }
  if (unit >= 0xdc00 && unit <= 0xdfff) {
    return { code: REPLACEMENT, next: i + 1 };
  }
  return { code: unit, next: i + 1 };
}

function byteLengthFor(code: number): 1 | 2 | 3 | 4 {
  if (code < 0x80) return 1;
  if (code < 0x800) return 2;
  if (code < 0x10000) return 3;
  return 4;
}

function writeCodePoint(out: number[] | Uint8Array, offset: number, code: number): number {
  if (code < 0x80) {
    out[offset] = code;
    return 1;
  }
  if (code < 0x800) {
    out[offset] = 0xc0 | (code >>> 6);
    out[offset + 1] = 0x80 | (code & 0x3f);
    return 2;
  }
  if (code < 0x10000) {
    out[offset] = 0xe0 | (code >>> 12);
    out[offset + 1] = 0x80 | ((code >>> 6) & 0x3f);
    out[offset + 2] = 0x80 | (code & 0x3f);
    return 3;
  }
  out[offset] = 0xf0 | (code >>> 18);
  out[offset + 1] = 0x80 | ((code >>> 12) & 0x3f);
  out[offset + 2] = 0x80 | ((code >>> 6) & 0x3f);
  out[offset + 3] = 0x80 | (code & 0x3f);
  return 4;
}

export function utf8ByteLength(text: string): number {
  let total = 0;
  for (let i = 0; i < text.length; ) {
    const { code, next } = codePointAt(text, i);
    total += byteLengthFor(code);
    i = next;
  }
  return total;
}

export function encodeUtf8(text: string): Uint8Array {
  const bytes = new Uint8Array(utf8ByteLength(text));
  let offset = 0;
  for (let i = 0; i < text.length; ) {
    const { code, next } = codePointAt(text, i);
    offset += writeCodePoint(bytes, offset, code);
    i = next;
  }
  return bytes;
}
