// ============================================================================
// 계정 완전 삭제 (Supabase Edge Function, Deno)
// 🔒 보안 검토 대상
// - 관리자 키(SUPABASE_SERVICE_ROLE_KEY)는 Supabase 서버 안의 환경변수로만 쓴다. 앱에는 절대 넣지 않는다.
// - 요청한 사람의 로그인 토큰을 확인한 뒤, "그 사람 자신"만 지운다 (다른 사람 id를 받지 않음).
// - auth.users 삭제 → DB의 on delete cascade로 모든 기록이 함께 지워진다.
// - 감사기록(audit_logs)은 보관기간 동안 남는다.
// 배포: supabase functions deploy delete-account
// ============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authHeader = req.headers.get('Authorization');
  if (!url || !anonKey || !serviceKey) return new Response('Server not configured', { status: 500, headers: cors });
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: cors });

  // 1) 요청한 사람이 누구인지 로그인 토큰으로 확인
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return new Response('Unauthorized', { status: 401, headers: cors });
  const userId = userData.user.id;

  // 2) 관리자 권한으로 감사기록 남기고 계정 삭제
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  await admin.from('audit_logs').insert({
    actor_id: userId,
    subject_id: userId,
    action: 'account_delete',
    target_table: 'auth.users',
    target_id: userId,
  });
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return new Response('Delete failed', { status: 500, headers: cors });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
