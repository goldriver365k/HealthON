-- 만보기(daily_steps) 보안 시험: 내 걸음은 나만, 동의 없으면 저장 불가, 가족 함수로 노출 안 됨
\set ON_ERROR_STOP on
set client_min_messages = warning;
\o /dev/null
select max(n) as start_n from tests.results \gset

insert into auth.users (id, email) values
  ('dddddddd-0000-0000-0000-00000000000a', 'steps-a@example.test'),
  ('dddddddd-0000-0000-0000-00000000000b', 'steps-b@example.test');

set role authenticated;

-- 동의 없으면 저장 불가
select tests.login('dddddddd-0000-0000-0000-00000000000a');
select tests.fails($$insert into public.daily_steps (step_date, steps) values ('2026-11-01', 3000)$$, '동의 전: 걸음 저장 불가');

-- 동의 후 저장·같은 날 덮어쓰기(upsert)
insert into public.consents (consent_type, version) values ('sensitive_health', 'v');
insert into public.daily_steps (step_date, steps) values ('2026-11-01', 3000);
insert into public.daily_steps (step_date, steps) values ('2026-11-01', 4200)
  on conflict (user_id, step_date) do update set steps = excluded.steps;
select tests.ok((select steps from public.daily_steps where step_date = '2026-11-01') = 4200, '같은 날은 한 줄로 덮어쓰기');
select tests.fails($$insert into public.daily_steps (step_date, steps) values ('2026-11-02', -5)$$, '음수 걸음 저장 불가');
select tests.fails($$insert into public.daily_steps (user_id, step_date, steps) values ('dddddddd-0000-0000-0000-00000000000b', '2026-11-02', 10)$$, '다른 사람 이름으로 저장 불가');
select tests.ok((select count(*) from public.audit_logs where target_table = 'daily_steps') >= 2, '걸음 저장도 감사기록 남음');

-- B는 A의 걸음을 볼 수도, 고칠 수도, 지울 수도 없음
select tests.login('dddddddd-0000-0000-0000-00000000000b');
select tests.ok((select count(*) from public.daily_steps) = 0, 'B는 A의 걸음을 못 봄');
select tests.ok(tests.affected($$update public.daily_steps set steps = 1$$) = 0, 'B는 A의 걸음을 못 고침');
select tests.ok(tests.affected($$delete from public.daily_steps$$) = 0, 'B는 A의 걸음을 못 지움');

-- A는 자기 기록을 지울 수 있음
select tests.login('dddddddd-0000-0000-0000-00000000000a');
select tests.ok(tests.affected($$delete from public.daily_steps where step_date = '2026-11-01'$$) = 1, 'A는 자기 걸음을 지울 수 있음');
reset role;

-- 로그인 안 한 사용자는 표에 접근 불가
select tests.ok(not has_table_privilege('anon', 'public.daily_steps', 'select'), '로그인 안 한 사용자: 걸음 조회 권한 없음');

-- 가족 공유 서버 함수들은 이 표를 읽지 않음
select tests.ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosrc ilike '%daily_steps%'
), '어떤 서버 함수도 걸음 표를 읽지 않음 (가족 공유 제외)');

\o
select format('%s개 통과 / 전체 %s개', count(*) filter (where ok), count(*)) as "만보기 보안 시험"
  from tests.results where n > :start_n;
