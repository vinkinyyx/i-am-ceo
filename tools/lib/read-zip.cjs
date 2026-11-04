// R21：最小 zip 读取器（仅用于发布校验，不新增第三方依赖）。
// 支持 ZIP 条目（method 0=STORE / 8=DEFLATE），输出 UTF-8 文本。
// 返回 [{ entryName, getData() }]。
const fs = require('fs');
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function findEndOfCentralDirectory(buf) {
  // EOCD 签名 0x06054b50，从尾部向前找
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  return -1;
}

function readZipEntries(buf) {
  const eocd = findEndOfCentralDirectory(buf);
  if (eocd < 0) throw new Error('zip EOCD not found');
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const cdEntries = buf.readUInt16LE(eocd + 10);
  const entries = [];
  let p = cdOffset;
  for (let n = 0; n < cdEntries; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
    const method = buf.readUInt16LE(p + 10);
    const expectedCrc = buf.readUInt32LE(p + 16);
    const compressedSize = buf.readUInt32LE(p + 20);
    const uncompressedSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localHeaderOffset = buf.readUInt32LE(p + 42);
    const entryName = buf.slice(p + 46, p + 46 + nameLen).toString('utf8');

    const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    if (buf.readUInt32LE(localHeaderOffset) !== 0x04034b50) throw new Error(`bad local header: ${entryName}`);
    const raw = buf.slice(dataStart, dataStart + compressedSize);
    if (raw.length !== compressedSize) throw new Error(`truncated entry: ${entryName}`);
    const data = method === 0 ? raw : zlib.inflateRawSync(raw);
    if (data.length !== uncompressedSize) throw new Error(`entry size mismatch: ${entryName}`);
    if (crc32(data) !== expectedCrc) throw new Error(`entry CRC mismatch: ${entryName}`);

    entries.push({
      entryName,
      method,
      getData: () => data,
      getText: () => data.toString('utf8'),
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readZipFile(file) {
  return readZipEntries(fs.readFileSync(file));
}

module.exports = { readZipEntries, readZipFile };
