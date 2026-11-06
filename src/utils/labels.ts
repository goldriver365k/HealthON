/**
 * 화면에 보이는 쉬운 한국어 이름표. 전문용어 대신 쉬운 말을 쓴다.
 * (수축기 → 위 숫자, 이완기 → 아래 숫자, 공복 → 아침 식사 전)
 */
import type { DoseSlot, FamilyLink, GlucoseTiming, Measurement, MeasurementKind, RemindBefore, ShareCategory } from '@/types/domain';
import type { IconName } from '@/theme';

export const kindLabel: Record<MeasurementKind, string> = {
  bp: '혈압',
  glucose: '혈당',
  weight: '체중',
};

export const kindIcon: Record<MeasurementKind, IconName> = {
  bp: 'bp',
  glucose: 'glucose',
  weight: 'weight',
};

export const glucoseTimingLabel: Record<GlucoseTiming, string> = {
  fasting: '아침 식사 전',
  after_meal: '식사 후',
  bedtime: '자기 전',
  other: '기타',
};

export const doseSlotLabel: Record<DoseSlot, string> = {
  morning: '아침',
  noon: '점심',
  evening: '저녁',
  bedtime: '자기 전',
  custom: '직접 정한 시간',
};

export const doseSlotDefaultTime: Record<Exclude<DoseSlot, 'custom'>, string> = {
  morning: '08:00',
  noon: '12:30',
  evening: '18:30',
  bedtime: '21:30',
};

export const remindBeforeLabel: Record<RemindBefore, string> = {
  none: '알림 안 함',
  day_before: '전날 알림',
  same_day: '당일 아침 알림',
};

export const shareCategoryLabel: Record<ShareCategory, string> = {
  bp: '혈압 기록',
  glucose: '혈당 기록',
  weight: '체중 기록',
  intakes: '약 드셨는지 여부',
  appointments: '병원 일정',
};

/** 가족에게 보여 줄 항목 고르기. 체중은 화면에서 뺐다 (2026-11-06) — 새로 고르면 체중은 공유되지 않음 */
export const shareCategories: ShareCategory[] = ['bp', 'glucose', 'intakes', 'appointments'];

/** 기록 값 한 줄 표시: "128 / 82", "105", "62.4" */
export function measurementValueText(m: Measurement): string {
  switch (m.kind) {
    case 'bp':
      return `${m.systolic} / ${m.diastolic}`;
    case 'glucose':
      return `${m.glucoseMgdl}`;
    case 'weight':
      return m.weightKg.toFixed(1);
  }
}

export const kindUnit: Record<MeasurementKind, string> = {
  bp: 'mmHg',
  glucose: 'mg/dL',
  weight: 'kg',
};

/** 스크린리더용 문장 */
export function measurementSpokenText(m: Measurement): string {
  switch (m.kind) {
    case 'bp':
      return `혈압 위 숫자 ${m.systolic}, 아래 숫자 ${m.diastolic}${m.pulse ? `, 맥박 ${m.pulse}` : ''}`;
    case 'glucose':
      return `혈당 ${m.glucoseMgdl}, ${glucoseTimingLabel[m.glucoseTiming]}`;
    case 'weight':
      return `체중 ${m.weightKg.toFixed(1)} 킬로그램`;
  }
}

/**
 * 받침에 맞는 조사 붙이기: eulReul('관절약') → '관절약을', eulReul('영양제') → '영양제를'
 * 한글이 아닌 글자로 끝나면 '을(를)'
 */
export function eulReul(word: string): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return `${word}을(를)`;
  return `${word}${code % 28 === 0 ? '를' : '을'}`;
}

/** 가족 연결 이름표: "김예솔 (딸)" 또는 서버 모드처럼 이름만 있을 때 "딸" */
export function familyLinkTitle(l: Pick<FamilyLink, 'personName' | 'relationLabel'>): string {
  return l.relationLabel ? `${l.personName} (${l.relationLabel})` : l.personName;
}
