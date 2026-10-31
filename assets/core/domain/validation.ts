import {
  COMPANY_NAME_MAX,
  COMPANY_NAME_MIN,
  FORBIDDEN_NAME_WORDS,
} from './companyNames';
import { CEO_TRAITS, INDUSTRIES, type CeoTrait, type IndustryId } from './types';

/**
 * 文本与名称校验（设计文档 05.1 / 08.5）。
 * - 去首尾空白、全角空格(U+3000)规范化
 * - 长度按可见字形计数（正确处理代理对/emoji）
 * - 禁止全空白/控制字符/敏感词；屏蔽富文本/脚本标签
 */
const FULLWIDTH_SPACE = '　';

export function normalizeName(raw: string): string {
  return raw.split(FULLWIDTH_SPACE).join(' ').trim();
}

/** 统计可见字形数（用 Array.from 正确处理代理对/emoji）。 */
export function visibleLength(text: string): number {
  return Array.from(text).length;
}

// 控制字符检测：C0(0x00-0x1F)、DEL(0x7F)、C1(0x80-0x9F)
function containsControlChar(text: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f || (code >= 0x80 && code <= 0x9f)) {
      return true;
    }
  }
  return false;
}
const TAG_RE = /<\s*\/?[a-zA-Z][^>]*>/;

export type NameValidation =
  | { ok: true; name: string }
  | {
      ok: false;
      reason: 'EMPTY' | 'TOO_SHORT' | 'TOO_LONG' | 'CONTROL_CHAR' | 'TAG' | 'FORBIDDEN_WORD';
    };

export function validateCompanyName(raw: string): NameValidation {
  const name = normalizeName(raw);
  if (name.length === 0) return { ok: false, reason: 'EMPTY' };
  if (containsControlChar(name)) return { ok: false, reason: 'CONTROL_CHAR' };
  if (TAG_RE.test(name)) return { ok: false, reason: 'TAG' };
  const len = visibleLength(name);
  if (len < COMPANY_NAME_MIN) return { ok: false, reason: 'TOO_SHORT' };
  if (len > COMPANY_NAME_MAX) return { ok: false, reason: 'TOO_LONG' };
  for (const word of FORBIDDEN_NAME_WORDS) {
    if (name.includes(word)) return { ok: false, reason: 'FORBIDDEN_WORD' };
  }
  return { ok: true, name };
}

/** CEO/员工人名：1~12 个可见字符，不允许标签与控制字符。 */
export function validatePersonName(raw: string, maxLen = 12): NameValidation {
  const name = normalizeName(raw);
  if (name.length === 0) return { ok: false, reason: 'EMPTY' };
  if (containsControlChar(name)) return { ok: false, reason: 'CONTROL_CHAR' };
  if (TAG_RE.test(name)) return { ok: false, reason: 'TAG' };
  const len = visibleLength(name);
  if (len < 1) return { ok: false, reason: 'TOO_SHORT' };
  if (len > maxLen) return { ok: false, reason: 'TOO_LONG' };
  for (const word of FORBIDDEN_NAME_WORDS) {
    if (name.includes(word)) return { ok: false, reason: 'FORBIDDEN_WORD' };
  }
  return { ok: true, name };
}

export function isValidIndustry(value: string): value is IndustryId {
  return (INDUSTRIES as readonly string[]).includes(value);
}

export function isValidCeoTrait(value: string): value is CeoTrait {
  return (CEO_TRAITS as readonly string[]).includes(value);
}

/** CEO 能力合法范围 [0,100] 整数。 */
export function isValidSkill(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 100;
}
