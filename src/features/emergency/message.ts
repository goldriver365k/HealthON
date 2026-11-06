/**
 * 긴급호출 문자 내용 (순수 함수 — 단위 테스트 대상).
 * ⚠ 건강 수치·판정을 넣지 않는다. 사람이 버튼을 눌렀을 때만 쓰인다 (자동 신고 없음).
 */
export interface EmergencyLocation {
  latitude: number;
  longitude: number;
  /** 사람이 읽는 주소 (못 구하면 없음) */
  address?: string;
}

/** 카카오맵 위치 링크 (휴대폰에서 누르면 지도가 열림) */
export function mapLink(loc: EmergencyLocation): string {
  return `https://map.kakao.com/link/map/현재위치,${loc.latitude.toFixed(6)},${loc.longitude.toFixed(6)}`;
}

export function emergencyMessage(name: string, loc: EmergencyLocation | null, now: Date = new Date()): string {
  const who = name.trim() ? `${name.trim()}님이` : '오늘건강 사용자가';
  const time = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const lines = [`[오늘건강 긴급호출] ${who} 도움을 요청했어요. (${time})`];
  if (loc) {
    if (loc.address) lines.push(`현재 위치: ${loc.address}`);
    lines.push(`지도: ${mapLink(loc)}`);
  } else {
    lines.push('위치는 확인하지 못했어요. 전화로 확인해 주세요.');
  }
  return lines.join('\n');
}

/** 전화번호에서 숫자와 + 만 남김 */
export function dialable(phone: string): string {
  return phone.replace(/[^0-9+]/g, '');
}
