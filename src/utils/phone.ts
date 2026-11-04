import { Linking } from 'react-native';

import { confirmAsync, notify } from './confirm';

/**
 * 전화 걸기. 반드시 확인창을 거친 뒤 휴대폰 전화 앱을 연다.
 * ⚠ 앱이 스스로 전화·신고하는 기능은 만들지 않는다 (건강 수치에 따른 자동 119 신고 금지).
 */
export async function callWithConfirm(name: string, phone: string): Promise<void> {
  const ok = await confirmAsync({
    // 번호(119)에는 '에', 사람에게는 '에게'
    title: `${name}${/^\d+$/.test(name) ? '에' : '에게'} 전화할까요?`,
    message: phone,
    confirmLabel: '전화 걸기',
  });
  if (!ok) return;
  const url = `tel:${phone.replace(/[^0-9+]/g, '')}`;
  try {
    await Linking.openURL(url);
  } catch {
    notify('전화를 걸 수 없어요', '이 기기에서는 전화 앱을 열 수 없어요. 휴대폰에서 직접 걸어 주세요.');
  }
}

/** 전화번호 형식 간단 확인 (숫자 9~11자리) */
export function checkPhone(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length === 0) return '전화번호를 적어 주세요';
  if (digits.length < 9 || digits.length > 11) return '전화번호를 다시 확인해 주세요';
  return null;
}
