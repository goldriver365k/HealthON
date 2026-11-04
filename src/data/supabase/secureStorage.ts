/**
 * 로그인 정보(세션) 암호화 저장소.
 * 🔒 보안 검토 대상
 * - 휴대폰 보안 저장소(SecureStore, 아이폰 Keychain / 안드로이드 Keystore)는 2KB까지만 저장 가능.
 * - 그래서 Supabase 공식 문서 방식대로 "암호화 키는 SecureStore, 암호화된 세션은 AsyncStorage"에 둔다.
 * - 공식 문서는 aes-js 등 패키지 2개를 더 쓰지만, 여기서는 Expo에 포함된 expo-crypto(AES-GCM)로 대신한다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const KEY_PREFIX = 'oneul.k.';
const DATA_PREFIX = 'oneul.d.';

// SecureStore 키 이름은 영문·숫자·._- 만 허용
const safe = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

/** UTF-8 문자열 ↔ 바이트 (Hermes 환경 차이를 피하려고 직접 변환) */
function utf8Encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}
function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    if (b < 0x80) out += String.fromCharCode(b);
    else if (b < 0xe0) out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i++] & 0x3f));
    else if (b < 0xf0) out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f));
    else {
      const cp = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
      const c = cp - 0x10000;
      out += String.fromCharCode(0xd800 + (c >> 10), 0xdc00 + (c & 0x3ff));
    }
  }
  return out;
}

export const largeSecureStorage = {
  async getItem(key: string): Promise<string | null> {
    const sealed = await AsyncStorage.getItem(DATA_PREFIX + key);
    const keyText = await SecureStore.getItemAsync(KEY_PREFIX + safe(key));
    if (!sealed || !keyText) return null;
    try {
      const aesKey = await AESEncryptionKey.import(keyText, 'base64');
      const data = AESSealedData.fromCombined(sealed);
      const bytes = (await aesDecryptAsync(data, aesKey)) as Uint8Array;
      return utf8Decode(bytes);
    } catch {
      // 복호화 실패(기기 변경 등) → 저장값 버리고 다시 로그인
      await this.removeItem(key);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    // 저장할 때마다 새 키 생성
    const aesKey = await AESEncryptionKey.generate();
    const sealed = await aesEncryptAsync(utf8Encode(value), aesKey);
    await SecureStore.setItemAsync(KEY_PREFIX + safe(key), await aesKey.encoded('base64'));
    await AsyncStorage.setItem(DATA_PREFIX + key, await sealed.combined('base64'));
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(DATA_PREFIX + key);
    await SecureStore.deleteItemAsync(KEY_PREFIX + safe(key));
  },
};
