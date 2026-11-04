/**
 * 로그인·동의 상태.
 * 🔒 보안 검토 대상
 * - 체험 모드: 로그인 없이 '체험 사용자'로 동작, 동의 화면 없음(실제 건강정보를 다루지 않음)
 * - 서버 모드: 이메일 6자리 숫자코드 로그인 → 필수 동의 4개가 모두 유효해야 앱 사용 가능
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { ConsentRecord, ConsentType } from '@/types/domain';
import { CONSENT_VERSION, dataMode } from './config';
import { getSupabase } from './supabase/client';
import { toConsent } from './supabase/mappers';
import { UserFacingError } from './supabase/repository';

export const REQUIRED_CONSENTS: ConsentType[] = ['terms', 'privacy', 'sensitive_health', 'age_14'];

interface AuthValue {
  mode: typeof dataMode;
  initializing: boolean;
  userId: string | null;
  email: string | null;
  consents: ConsentRecord[];
  /** 필수 동의가 모두 유효한지 */
  hasAllConsents: boolean;
  requestCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  agree(types: ConsentType[]): Promise<void>;
  withdrawHealthConsent(): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

function authError(e: unknown, fallback: string): never {
  const msg = e instanceof Error ? e.message : String(e);
  if (/network|fetch/i.test(msg)) throw new UserFacingError('인터넷 연결을 확인한 뒤 다시 해 주세요.');
  if (/expired|invalid/i.test(msg)) throw new UserFacingError('숫자코드가 맞지 않거나 시간이 지났어요. 다시 받아 주세요.');
  if (/rate|too many|security purposes/i.test(msg)) throw new UserFacingError('잠시 뒤에 다시 해 주세요. (너무 자주 요청했어요)');
  throw new UserFacingError(fallback);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initializing, setInitializing] = useState(dataMode === 'cloud');
  const [userId, setUserId] = useState<string | null>(dataMode === 'demo' ? 'demo-user' : null);
  const [email, setEmail] = useState<string | null>(null);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);

  const loadConsents = useCallback(async () => {
    const { data, error } = await getSupabase().from('consents').select('*').is('withdrawn_at', null);
    if (error) authError(error, '동의 정보를 불러오지 못했어요.');
    setConsents((data ?? []).map(toConsent));
  }, []);

  useEffect(() => {
    if (dataMode !== 'cloud') return;
    const sb = getSupabase();
    let alive = true;
    sb.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      const user = data.session?.user ?? null;
      setUserId(user?.id ?? null);
      setEmail(user?.email ?? null);
      if (user) await loadConsents().catch(() => {});
      setInitializing(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setEmail(session?.user.email ?? null);
      if (!session) setConsents([]);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [loadConsents]);

  const value = useMemo<AuthValue>(() => {
    const active = new Set(consents.filter((c) => !c.withdrawnAt).map((c) => c.consentType));
    return {
      mode: dataMode,
      initializing,
      userId,
      email,
      consents,
      hasAllConsents: dataMode === 'demo' || REQUIRED_CONSENTS.every((t) => active.has(t)),

      async requestCode(addr) {
        // 처음이면 자동 가입. Supabase 메일 문구에 {{ .Token }}(6자리 숫자)가 들어 있어야 함
        const { error } = await getSupabase().auth.signInWithOtp({ email: addr, options: { shouldCreateUser: true } });
        if (error) authError(error, '숫자코드를 보내지 못했어요. 이메일 주소를 확인해 주세요.');
      },
      async verifyCode(addr, code) {
        const { data, error } = await getSupabase().auth.verifyOtp({ email: addr, token: code, type: 'email' });
        if (error || !data.session) authError(error ?? new Error('invalid'), '로그인하지 못했어요.');
        setUserId(data.session.user.id);
        setEmail(data.session.user.email ?? null);
        await loadConsents();
      },
      async agree(types) {
        const missing = types.filter((t) => !active.has(t));
        if (missing.length) {
          const { error } = await getSupabase()
            .from('consents')
            .insert(missing.map((t) => ({ consent_type: t, version: CONSENT_VERSION })));
          if (error) authError(error, '동의를 저장하지 못했어요.');
        }
        await loadConsents();
      },
      async withdrawHealthConsent() {
        const { error } = await getSupabase().rpc('withdraw_consent', { p_type: 'sensitive_health' });
        if (error) authError(error, '동의를 철회하지 못했어요.');
        await loadConsents();
      },
      async signOut() {
        if (dataMode !== 'cloud') return;
        await getSupabase().auth.signOut();
        setConsents([]);
      },
      async deleteAccount() {
        const { error } = await getSupabase().functions.invoke('delete-account', { method: 'POST' });
        if (error) authError(error, '계정을 삭제하지 못했어요. 잠시 뒤 다시 해 주세요.');
        await getSupabase().auth.signOut();
        setConsents([]);
      },
    };
  }, [consents, email, initializing, loadConsents, userId]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('AuthProvider 안에서만 사용할 수 있습니다');
  return ctx;
}
