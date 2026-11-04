/**
 * 색상 기준값. 화면 파일에서 색 코드를 직접 쓰지 말고 여기 값만 사용한다.
 * 글씨/배경 명암비: text·textSub는 배경(background, surface) 위에서 4.5:1 이상.
 * 상태는 색만으로 구분하지 않는다(항상 아이콘·글자를 함께 쓴다).
 */
export const colors = {
  background: '#FAF8F5', // 밝은 미색 배경
  surface: '#FFFFFF', // 카드 배경
  surfaceMuted: '#F2EFEA', // 눌림·비활성 배경
  border: '#D6D0C6',
  borderStrong: '#8A8378',

  text: '#1C2433', // 진한 남색 (본문)
  textSub: '#4A5160', // 보조 글씨
  textOnPrimary: '#FFFFFF',

  primary: '#1E6461', // 차분한 청록 (주요 버튼)
  primaryPressed: '#164B49',
  primarySoft: '#E2EFED', // 선택됨·완료 배경

  danger: '#A8261D', // 삭제·119
  dangerPressed: '#821C15',
  dangerSoft: '#FBEAE8',

  sampleBg: '#F3E7CF', // '예시' 배지
  sampleText: '#5E4511',

  tabInactive: '#4A5160',
  overlay: 'rgba(28, 36, 51, 0.5)', // 달력 등 큰 창 뒤 어둡게
} as const;

export type ColorName = keyof typeof colors;
