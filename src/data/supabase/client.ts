/**
 * Supabase 연결 (서버 모드에서만 사용).
 * 🔒 공개용 키만 사용. 접근 제한은 서버의 RLS(supabase/migrations)가 최종 판단한다.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { dataMode, supabaseAnonKey, supabaseUrl } from '../config';
import { largeSecureStorage } from './secureStorage';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (dataMode !== 'cloud') throw new Error('Supabase가 설정되지 않았습니다 (체험 모드)');
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // 웹 미리보기에서는 브라우저 기본 저장소 사용 (개발 확인용)
        storage: Platform.OS === 'web' ? undefined : largeSecureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    // 앱이 화면에 있을 때만 로그인 토큰 자동 갱신 (Supabase 권장 방식)
    if (Platform.OS !== 'web') {
      AppState.addEventListener('change', (state) => {
        if (state === 'active') client?.auth.startAutoRefresh();
        else client?.auth.stopAutoRefresh();
      });
    }
  }
  return client;
}
