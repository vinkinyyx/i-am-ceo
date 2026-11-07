#!/usr/bin/env node
'use strict';

/**
 * tap-auth 部署包构建器（零第三方依赖）。
 *
 * 输出：
 *   build/server/tap-auth-20261107/01/tap-auth.zip
 *   build/server/tap-auth-20261107/01/manifest.json
 *
 * ZIP 约定：条目为 Unix 正斜杠相对路径、无顶层目录、UTF-8 文件名标记、
 * deflate（不可压缩时退回 store），生成后用 tools/lib/read-zip.cjs 复核 CRC/大小。
 *
 * 已存在 zip 时默认拒绝覆盖；需要重建时追加 --force。
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'services', 'tap-auth');
const RELEASE_ID = 'tap-auth-20261107-01';
const OUT_DIR = path.join(ROOT, 'build', 'server', 'tap-auth-20261107', '01');
const ZIP_PATH = path.join(OUT_DIR, 'tap-auth.zip');
const MANIFEST_PATH = path.join(OUT_DIR, 'manifest.json');
const ENTRY_NAMES = ['handler.cjs', 'exchange.cjs', 'session.cjs', 'package.json', 'env.example'];
const FORCE = process.argv.includes('--force');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const time = ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | (Math.floor(date.getSeconds() / 2) & 31);
  const day = (((date.getFullYear() - 1980) & 127) << 9) | (((date.getMonth() + 1) & 15) << 5) | (date.getDate() & 31);
  return { time, day };
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function fail(message) {
  console.error(`BUILD_FAIL ${message}`);
  process.exit(1);
}

if (!fs.existsSync(SOURCE_DIR)) fail(`缺少源目录 ${SOURCE_DIR}`);
for (const name of ENTRY_NAMES) {
  if (!fs.existsSync(path.join(SOURCE_DIR, name))) fail(`缺少源文件 ${name}`);
}
if (fs.existsSync(ZIP_PATH) && !FORCE) {
  fail(`目标 zip 已存在，禁止原地覆盖（追加 --force 可重建）：${ZIP_PATH}`);
}

const files = ENTRY_NAMES.map((name) => {
  const data = fs.readFileSync(path.join(SOURCE_DIR, name));
  return { name, data, sizeBytes: data.length, sha256: sha256(data), crc32: crc32(data) };
});

const { time, day } = dosDateTime(new Date());
const chunks = [];
const centralRecords = [];
let offset = 0;

for (const file of files) {
  const deflated = zlib.deflateRawSync(file.data, { level: 9 });
  const useStore = deflated.length >= file.data.length;
  const payload = useStore ? file.data : deflated;
  const method = useStore ? 0 : 8;
  const nameBuffer = Buffer.from(file.name, 'utf8');

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0x0800, 6); // UTF-8 文件名
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(time, 10);
  local.writeUInt16LE(day, 12);
  local.writeUInt32LE(file.crc32, 14);
  local.writeUInt32LE(payload.length, 18);
  local.writeUInt32LE(file.sizeBytes, 22);
  local.writeUInt16LE(nameBuffer.length, 26);
  local.writeUInt16LE(0, 28);
  chunks.push(local, nameBuffer, payload);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4); // version made by
  central.writeUInt16LE(20, 6); // version needed
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt16LE(time, 12);
  central.writeUInt16LE(day, 14);
  central.writeUInt32LE(file.crc32, 16);
  central.writeUInt32LE(payload.length, 20);
  central.writeUInt32LE(file.sizeBytes, 24);
  central.writeUInt16LE(nameBuffer.length, 28);
  central.writeUInt16LE(0, 30); // extra
  central.writeUInt16LE(0, 32); // comment
  central.writeUInt16LE(0, 34); // disk start
  central.writeUInt16LE(0, 36); // internal attrs
  central.writeUInt32LE(0, 38); // external attrs
  central.writeUInt32LE(offset, 42);
  centralRecords.push(central, nameBuffer);

  file.method = method;
  file.compressedSizeBytes = payload.length;
  offset += local.length + nameBuffer.length + payload.length;
}

const centralDirectory = Buffer.concat(centralRecords);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4);
eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(files.length, 8);
eocd.writeUInt16LE(files.length, 10);
eocd.writeUInt32LE(centralDirectory.length, 12);
eocd.writeUInt32LE(offset, 16);
eocd.writeUInt16LE(0, 20);

const zipBuffer = Buffer.concat([...chunks, centralDirectory, eocd]);

// 自校验：用仓库既有读取器逐条验证路径、CRC 与解压大小。
const { readZipEntries } = require(path.join(ROOT, 'tools', 'lib', 'read-zip.cjs'));
let verified;
try {
  verified = readZipEntries(zipBuffer);
} catch (error) {
  fail(`zip 自校验失败：${error && error.message}`);
}
if (verified.length !== files.length) fail(`zip 条目数不符：${verified.length}`);
for (const file of files) {
  const entry = verified.find((item) => item.entryName === file.name);
  if (!entry) fail(`zip 缺少条目 ${file.name}`);
  if (entry.entryName.includes('\\') || entry.entryName.startsWith('/') || entry.entryName.includes('..')) {
    fail(`zip 条目路径非法 ${entry.entryName}`);
  }
  const data = entry.getData();
  if (sha256(data) !== file.sha256) fail(`zip 条目内容不一致 ${file.name}`);
}

const zipSha256 = sha256(zipBuffer);
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(ZIP_PATH, zipBuffer);

const manifest = {
  releaseId: RELEASE_ID,
  createdAt: new Date().toISOString(),
  nodeVersion: process.version,
  sourceDirectory: 'services/tap-auth',
  entryCount: files.length,
  files: files.map((file) => ({
    path: file.name,
    sizeBytes: file.sizeBytes,
    compressedSizeBytes: file.compressedSizeBytes,
    method: file.method === 8 ? 'deflate' : 'store',
    sha256: file.sha256,
    crc32: file.crc32.toString(16).padStart(8, '0'),
  })),
  zip: {
    path: 'tap-auth.zip',
    sizeBytes: zipBuffer.length,
    sha256: zipSha256,
    crc32: crc32(zipBuffer).toString(16).padStart(8, '0'),
  },
  crcVerified: true,
  verification: {
    entries: verified.length,
    allEntryCrcOk: true,
    allEntryPathsPosix: verified.every((item) => !item.entryName.includes('\\')),
    noTopLevelDirectory: verified.every((item) => !item.entryName.includes('/')),
  },
};
fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`BUILD_OK ${ZIP_PATH}`);
console.log(`ZIP_BYTES ${zipBuffer.length}`);
console.log(`ZIP_SHA256 ${zipSha256}`);
console.log(`MANIFEST ${MANIFEST_PATH}`);
