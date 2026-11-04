/**
 * 입력 실수 방지용 검사.
 * ⚠ 이 범위는 "숫자를 잘못 눌렀는지" 확인하는 용도이며 건강 상태 판정 기준이 아니다.
 *   (DB 설계안의 check 제약과 같은 값)
 */
import { eulReul } from './labels';

export const inputRanges = {
  systolic: { min: 50, max: 260 },
  diastolic: { min: 30, max: 160 },
  pulse: { min: 30, max: 220 },
  glucose: { min: 20, max: 600 },
  weight: { min: 20, max: 250 },
} as const;

export type RangeName = keyof typeof inputRanges;

export const RECHECK_MESSAGE = '숫자를 다시 확인해 주세요';

export type ParseResult = { ok: true; value: number } | { ok: false; message: string };

/** 정수 입력 검사 */
export function parseIntInRange(raw: string, range: RangeName, required = true): ParseResult | null {
  const text = raw.trim();
  if (text === '') {
    return required ? { ok: false, message: '숫자를 입력해 주세요' } : null;
  }
  if (!/^\d+$/.test(text)) return { ok: false, message: RECHECK_MESSAGE };
  const value = Number(text);
  const { min, max } = inputRanges[range];
  if (value < min || value > max) return { ok: false, message: RECHECK_MESSAGE };
  return { ok: true, value };
}

/** 소수점 한 자리까지 허용 (체중) */
export function parseDecimalInRange(raw: string, range: RangeName): ParseResult {
  const text = raw.trim().replace(',', '.');
  if (text === '') return { ok: false, message: '숫자를 입력해 주세요' };
  if (!/^\d+(\.\d)?$/.test(text)) return { ok: false, message: '소수점 아래는 한 자리까지 적어 주세요' };
  const value = Number(text);
  const { min, max } = inputRanges[range];
  if (value < min || value > max) return { ok: false, message: RECHECK_MESSAGE };
  return { ok: true, value };
}

/** 글자 입력 검사 (이름 등) */
export function checkText(raw: string, label: string, maxLength: number): string | null {
  const text = raw.trim();
  if (text === '') return `${eulReul(label)} 적어 주세요`;
  if (text.length > maxLength) return `${maxLength}자까지 적을 수 있어요`;
  return null;
}
