/**
 * 规范 JSON 序列化（设计文档 02.4）：
 * 对象 key 按字典序递归排序；数组保持顺序。
 * 保证 Node 与 TapTap 运行时对同一快照产生相同字符串与 CRC。
 */
function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      out[key] = sortValue(obj[key]);
    }
    return out;
  }
  return value;
}

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}
