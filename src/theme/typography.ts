/**
 * 글씨 크기 기준 (pt). 앱 안 글씨 배율(settings.fontScale)과
 * 휴대폰 글씨 확대 설정이 함께 적용된다.
 * - 본문 19, 보조 최소 17, 중요한 숫자 40
 * - 서체: Pretendard (보통·굵게 두 가지만, 얇은 굵기 쓰지 않음). 무료 서체(OFL), assets/fonts
 */
export const fontSize = {
  caption: 17,
  body: 19,
  label: 20,
  heading: 22,
  title: 26,
  date: 28,
  number: 40,
} as const;

export type TextVariant = keyof typeof fontSize;

/** 줄 간격 = 글씨 크기 × 1.5 (한글 가독성) */
export const lineHeightRatio = 1.5;

/** 서체 이름 (src/app/_layout.tsx에서 불러옴) */
export const fontFamily = {
  regular: 'Pretendard-Regular',
  bold: 'Pretendard-Bold',
} as const;

/**
 * 휴대폰 글씨 확대 최대 배율. 이보다 크면 레이아웃이 깨질 수 있어 제한한다.
 * 실제 기기 확인 후 조정.
 */
export const maxFontSizeMultiplier = 1.6;

/** 앱 안 글씨 크기 3단계 */
export const fontScaleOptions = [
  { value: 1, label: '크게' },
  { value: 1.15, label: '더 크게' },
  { value: 1.3, label: '아주 크게' },
] as const;

export type FontScale = (typeof fontScaleOptions)[number]['value'];
