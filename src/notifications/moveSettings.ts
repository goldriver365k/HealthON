/**
 * 움직임 알림 설정 — 이 휴대폰에만 저장 (AsyncStorage). 건강 수치가 아니어서 서버에 두지 않는다.
 * 처음에는 꺼져 있다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { defaultMoveSettings, type MoveSettings } from './plan';

const KEY = 'oneul.moveSettings';
let current: MoveSettings = defaultMoveSettings;
let loaded = false;
const listeners = new Set<(s: MoveSettings) => void>();

async function load(): Promise<MoveSettings> {
  if (loaded) return current;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) current = { ...defaultMoveSettings, ...(JSON.parse(raw) as Partial<MoveSettings>) };
  } catch {
    // 읽지 못하면 기본값(꺼짐)
  }
  loaded = true;
  listeners.forEach((l) => l(current));
  return current;
}

export async function saveMoveSettings(next: MoveSettings): Promise<void> {
  current = next;
  loaded = true;
  listeners.forEach((l) => l(current));
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}

export function useMoveSettings(): MoveSettings {
  const [s, setS] = useState(current);
  useEffect(() => {
    listeners.add(setS);
    load().then(setS);
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}
