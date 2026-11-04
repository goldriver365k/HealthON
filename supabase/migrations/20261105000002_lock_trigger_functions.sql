-- ============================================================================
-- 보안 점검(Supabase Security Advisor) 반영: 트리거 전용 함수를 API로 직접 부를 수 없게
-- 🔒 보안 검토 대상
-- - audit_row_change / audit_consent_change / handle_new_user 는 트리거로만 실행되어야 한다.
--   기본 권한 때문에 /rest/v1/rpc/... 로 호출 가능한 상태였음 (호출해도 오류가 나서 악용은 불가했지만 권한 자체를 회수).
-- - 트리거 실행에는 EXECUTE 권한이 필요 없으므로 감사기록·가입 처리는 그대로 동작한다.
-- - has_health_consent() 는 RLS 정책에서 쓰이므로 authenticated 권한을 유지한다 (의도된 설계).
-- ============================================================================
revoke execute on function public.audit_row_change() from public, anon, authenticated;
revoke execute on function public.audit_consent_change() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
