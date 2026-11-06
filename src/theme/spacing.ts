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
  /** 카드 모서리 (조금 더 둥글게) */
  radiusCard: 18,
  icon: 26,
  iconLarge: 32,
  /** 화면 좌우 여백 */
  screenPadding: 20,
} as const;

/**
 * 그림자 (입체감). 애니메이션 없이 정적인 그림자만 쓴다.
 * iOS·안드로이드·웹 공통 boxShadow 문자열.
 */
export const shadows = {
  /** 카드: 바닥에서 살짝 떠 보이게 */
  card: '0px 2px 10px rgba(28, 36, 51, 0.08), 0px 1px 2px rgba(28, 36, 51, 0.06)',
  /** 주요 버튼: 누를 수 있는 것처럼 */
  button: '0px 3px 6px rgba(28, 36, 51, 0.18)',
  /** 맨 위 날짜 띠 */
  hero: '0px 4px 14px rgba(30, 100, 97, 0.28)',
  /** 하단 탭 막대 */
  tabBar: '0px -2px 10px rgba(28, 36, 51, 0.08)',
} as const;
