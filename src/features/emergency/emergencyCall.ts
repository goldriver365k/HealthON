/**
 * 긴급호출 실행: 위치 확인 → 등록된 긴급 연락처 모두에게 위치 문자(문자 앱에서 [보내기]) → 첫 번째 연락처에 전화.
 * - 사람이 버튼을 눌렀을 때만 실행 (자동 신고·자동 전송 없음 — 휴대폰이 허락하지 않음)
 * - 위치는 서버에 저장·전송하지 않고 문자에만 담는다 🔒
 * - ⚠ 위치·전화번호를 로그에 남기지 않는다
 */
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import { Linking } from 'react-native';

import type { EmergencyContact } from '@/types/domain';
import { notify } from '@/utils/confirm';
import { dialable, emergencyMessage, type EmergencyLocation } from './message';

const LOCATION_TIMEOUT_MS = 8000;

function timeout<T>(ms: number): Promise<T | null> {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}

/** 현재 위치 한 번 읽기. 허용 안 함·실패·시간 초과면 마지막 위치, 그것도 없으면 null */
export async function readLocation(): Promise<EmergencyLocation | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const pos =
      (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        timeout<Location.LocationObject>(LOCATION_TIMEOUT_MS),
      ])) ?? (await Location.getLastKnownPositionAsync());
    if (!pos) return null;
    const { latitude, longitude } = pos.coords;
    let address: string | undefined;
    try {
      const [a] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (a) {
        address = [a.region, a.city, a.district, a.street, a.streetNumber ?? a.name]
          .filter((x, i, arr): x is string => !!x && arr.indexOf(x) === i)
          .join(' ');
      }
    } catch {
      // 주소를 못 구해도 지도 링크는 보낸다
    }
    return { latitude, longitude, address: address || undefined };
  } catch {
    return null;
  }
}

export async function runEmergencyCall(displayName: string, contacts: EmergencyContact[]): Promise<void> {
  const sorted = [...contacts].sort((a, b) => a.priority - b.priority);
  const phones = sorted.map((c) => dialable(c.phone)).filter(Boolean);
  if (!phones.length) return;

  const loc = await readLocation();
  const body = emergencyMessage(displayName, loc);

  // 1) 위치 문자: 문자 앱이 받는 사람·내용이 채워진 채로 열림 → [보내기]
  try {
    if (await SMS.isAvailableAsync()) await SMS.sendSMSAsync(phones, body);
  } catch {
    // 문자를 못 열어도 전화는 건다
  }

  // 2) 첫 번째 연락처에 전화
  try {
    await Linking.openURL(`tel:${phones[0]}`);
  } catch {
    notify('전화를 걸 수 없어요', `이 기기에서는 전화 앱을 열 수 없어요. ${sorted[0].name}에게 직접 전화해 주세요.`);
  }
}
