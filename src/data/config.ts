/**
 * 데이터 연결 설정.
 * - .env 파일(또는 EAS 환경변수)에 아래 두 값이 있으면 '서버 모드'(로그인 + Supabase 저장)
 * - 없으면 '체험 모드'(1단계와 같은 예시 데이터, 저장 안 됨)
 *
 * 🔒 여기에는 공개용 키(anon / publishable)만 넣는다.
 *    관리자 키(service_role)는 앱에 절대 넣지 않는다.
 */
/** .env 값의 흔한 실수 정리: 앞뒤 빈칸·따옴표, 주소 끝의 '/rest/v1/'·'/' */
const clean = (v: string | undefined) => (v ?? '').trim().replace(/^["']|["']$/g, '').trim();

export const supabaseUrl = clean(process.env.EXPO_PUBLIC_SUPABASE_URL).replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
export const supabaseAnonKey = clean(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

export type DataMode = 'demo' | 'cloud';

export const dataMode: DataMode = supabaseUrl && supabaseAnonKey ? 'cloud' : 'demo';

/** 동의 문구 버전. 문구를 바꾸면 버전을 올려 다시 동의를 받는다. */
export const CONSENT_VERSION = 'draft-2026-11';
