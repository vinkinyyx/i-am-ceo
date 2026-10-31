/**
 * CRC32（IEEE 802.3 多项式 0xEDB88320 反射形式）。
 * 设计文档 02.4：对除 checksum 外的 Envelope 做 key 字典序排序的规范 JSON 序列化，
 * 按 UTF-8 字节计算，输出 8 位小写十六进制。仅用于发现意外损坏，非密码学签名。
 */

const TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

const encoder = new TextEncoder();

export function crc32Bytes(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    const byte: number = bytes[i] as number;
    crc = TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function crc32String(text: string): string {
  return crc32Bytes(encoder.encode(text)).toString(16).padStart(8, '0');
}
