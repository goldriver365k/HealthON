/** 간격·크기 기준 (dp) */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const sizes = {
  /** 주요 버튼 높이 (최소 52dp 기준보다 여유 있게) */
  buttonHeight: 56,
  /** 큰 버튼 (119 등) */
  buttonHeightLarge: 68,
  /** 입력창 높이 */
  inputHeight: 64,
  /** 버튼 사이 최소 간격 */
  buttonGap: 12,
  radius: 14,
  icon: 26,
  iconLarge: 32,
  /** 화면 좌우 여백 */
  screenPadding: 20,
} as const;
