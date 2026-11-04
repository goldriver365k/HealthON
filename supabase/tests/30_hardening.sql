-- 보안 점검 반영 확인: 트리거 전용 함수는 사용자가 실행할 수 없고, 트리거는 계속 동작
\set ON_ERROR_STOP on
set client_min_messages = warning;
\o /dev/null
select max(n) as start_n from tests.results \gset

select tests.ok(not has_function_privilege('anon', 'public.audit_row_change()', 'execute'), '로그인 안 한 사용자: 감사기록 트리거 함수 실행 불가');
select tests.ok(not has_function_privilege('authenticated', 'public.audit_row_change()', 'execute'), '로그인 사용자: 감사기록 트리거 함수 실행 불가');
select tests.ok(not has_function_privilege('authenticated', 'public.audit_consent_change()', 'execute'), '로그인 사용자: 동의 감사 트리거 함수 실행 불가');
select tests.ok(not has_function_privilege('anon', 'public.handle_new_user()', 'execute'), '로그인 안 한 사용자: 가입 트리거 함수 실행 불가');
select tests.ok(not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'), '로그인 사용자: 가입 트리거 함수 실행 불가');
select tests.ok(has_function_privilege('authenticated', 'public.has_health_consent()', 'execute'), 'RLS용 동의 확인 함수는 유지');

-- 트리거가 여전히 동작하는지 (새 사용자 가입 → 프로필 생성, 기록 저장 → 감사기록)
insert into auth.users (id, email) values ('ffffffff-0000-0000-0000-000000000006', 'f@example.test');
select tests.ok(exists (select 1 from public.profiles where id = 'ffffffff-0000-0000-0000-000000000006'), '가입 트리거 계속 동작');
set role authenticated;
select tests.login('ffffffff-0000-0000-0000-000000000006');
insert into public.consents (consent_type, version) values ('sensitive_health', 'v');
insert into public.health_measurements (kind, weight_kg, measured_at) values ('weight', 60, now());
select tests.ok((select count(*) from public.audit_logs where action in ('insert', 'consent_agree')) = 2, '감사기록 트리거 계속 동작');
reset role;

\o
select format('%s개 통과 / 전체 %s개', count(*) filter (where ok), count(*)) as "보안 점검 반영 시험"
  from tests.results where n > :start_n;
