-- ============================================================================
-- 2단계 보안 시험: "내 기록은 나만", 동의 없으면 저장 불가, 감사기록 보호
-- 실행: scripts/test-db.sh  (로컬 PostgreSQL 필요)
-- 실패하면 오류로 멈춘다 (ON_ERROR_STOP)
-- ============================================================================
\set ON_ERROR_STOP on
set client_min_messages = warning;
\o /dev/null

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

-- 시험 도구 ------------------------------------------------------------------
create table tests.results (n serial, label text, ok boolean);
grant all on tests.results to authenticated, anon;
grant usage on sequence tests.results_n_seq to authenticated, anon;

create function tests.ok(p_cond boolean, p_label text) returns void language plpgsql as $$
begin
  insert into tests.results (label, ok) values (p_label, coalesce(p_cond, false));
  if not coalesce(p_cond, false) then raise exception 'FAIL: %', p_label; end if;
end $$;

-- 실행하면 반드시 오류가 나야 하는 SQL
create function tests.fails(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    insert into tests.results (label, ok) values (p_label, true);
    return;
  end;
  insert into tests.results (label, ok) values (p_label, false);
  raise exception 'FAIL (오류가 나야 함): %', p_label;
end $$;

-- 영향 받은 행 수
create function tests.affected(p_sql text) returns bigint language plpgsql as $$
declare v bigint;
begin
  execute p_sql;
  get diagnostics v = row_count;
  return v;
end $$;
grant execute on all functions in schema tests to authenticated, anon;

create function tests.login(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, false);
$$;
grant execute on function tests.login(uuid) to authenticated, anon;

-- 시험 사용자 A, B (관리자 권한으로 생성) ----------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@example.test');

select tests.ok((select count(*) from public.profiles) = 2, '가입 시 프로필 자동 생성');
select tests.ok((select count(*) from public.notification_settings) = 2, '가입 시 알림 설정 자동 생성');

-- ── 사용자 A ─────────────────────────────────────────────────────────────
set role authenticated;
select tests.login('aaaaaaaa-0000-0000-0000-000000000001');

select tests.fails($$insert into public.health_measurements (kind, systolic, diastolic, measured_at)
                     values ('bp', 128, 82, now())$$,
                   '건강정보 동의 전에는 혈압 저장 불가');

insert into public.consents (consent_type, version) values
  ('terms', 'test-v1'), ('privacy', 'test-v1'), ('sensitive_health', 'test-v1'), ('age_14', 'test-v1');
select tests.ok(public.has_health_consent(), '동의 후 has_health_consent = true');

insert into public.health_measurements (id, kind, systolic, diastolic, pulse, measured_at)
  values ('a0000000-0000-0000-0000-00000000000b', 'bp', 128, 82, 72, now());
insert into public.health_measurements (kind, glucose_mgdl, glucose_timing, measured_at)
  values ('glucose', 104, 'fasting', now());
insert into public.medications (id, name, dose_text) values ('a0000000-0000-0000-0000-0000000000a1', '시험약A', '1알');
insert into public.medication_schedules (id, medication_id, slot, time_of_day)
  values ('a0000000-0000-0000-0000-0000000000a2', 'a0000000-0000-0000-0000-0000000000a1', 'morning', '08:00');
insert into public.medication_intakes (schedule_id, scheduled_date, status)
  values ('a0000000-0000-0000-0000-0000000000a2', current_date, 'taken');
insert into public.appointments (id, hospital_name, visit_at) values ('a0000000-0000-0000-0000-0000000000a3', '시험내과', now() + interval '1 day');
insert into public.appointment_questions (appointment_id, content) values ('a0000000-0000-0000-0000-0000000000a3', '시험 질문');
insert into public.emergency_contacts (name, phone) values ('시험가족', '010-0000-0000');

select tests.ok((select count(*) from public.health_measurements) = 2, 'A는 자기 기록 2개를 봄');

-- 입력 형식 검사 (DB에서도 막음)
select tests.fails($$insert into public.health_measurements (kind, systolic, diastolic, measured_at) values ('bp', 400, 82, now())$$,
                   '불가능한 숫자(위 숫자 400) 저장 불가');
select tests.fails($$insert into public.health_measurements (kind, systolic, diastolic, measured_at) values ('bp', 80, 120, now())$$,
                   '아래 숫자가 더 큰 혈압 저장 불가');
select tests.fails($$insert into public.health_measurements (kind, glucose_mgdl, measured_at) values ('glucose', 100, now())$$,
                   '혈당 측정 시점 없으면 저장 불가');
select tests.fails($$insert into public.health_measurements (user_id, kind, weight_kg, measured_at)
                     values ('bbbbbbbb-0000-0000-0000-000000000002', 'weight', 60, now())$$,
                   'A가 B 이름으로 기록 저장 불가');

-- ── 사용자 B: A의 기록에 접근 시도 ───────────────────────────────────────
select tests.login('bbbbbbbb-0000-0000-0000-000000000002');
insert into public.consents (consent_type, version) values ('sensitive_health', 'test-v1');

select tests.ok((select count(*) from public.health_measurements) = 0, 'B는 A의 건강기록을 볼 수 없음');
select tests.ok((select count(*) from public.medications) = 0, 'B는 A의 약을 볼 수 없음');
select tests.ok((select count(*) from public.medication_intakes) = 0, 'B는 A의 복약 확인을 볼 수 없음');
select tests.ok((select count(*) from public.appointments) = 0, 'B는 A의 병원 일정을 볼 수 없음');
select tests.ok((select count(*) from public.appointment_questions) = 0, 'B는 A의 질문 메모를 볼 수 없음');
select tests.ok((select count(*) from public.emergency_contacts) = 0, 'B는 A의 긴급 연락처를 볼 수 없음');
select tests.ok((select count(*) from public.consents) = 1, 'B는 자기 동의만 봄');
select tests.ok((select count(*) from public.profiles) = 1, 'B는 자기 프로필만 봄');

select tests.ok(tests.affected($$update public.health_measurements set systolic = 150
                                 where id = 'a0000000-0000-0000-0000-00000000000b'$$) = 0,
                'B는 A의 기록을 고칠 수 없음');
select tests.ok(tests.affected($$delete from public.health_measurements
                                 where id = 'a0000000-0000-0000-0000-00000000000b'$$) = 0,
                'B는 A의 기록을 지울 수 없음');
select tests.fails($$insert into public.medication_schedules (medication_id, slot, time_of_day)
                     values ('a0000000-0000-0000-0000-0000000000a1', 'noon', '12:00')$$,
                   'B는 A의 약에 일정을 붙일 수 없음');
select tests.fails($$insert into public.medication_intakes (schedule_id, scheduled_date, status)
                     values ('a0000000-0000-0000-0000-0000000000a2', current_date - 1, 'taken')$$,
                   'B는 A의 복약 일정에 확인 표시 불가');
select tests.fails($$insert into public.appointment_questions (appointment_id, content)
                     values ('a0000000-0000-0000-0000-0000000000a3', '끼워넣기')$$,
                   'B는 A의 병원 일정에 질문 추가 불가');

-- 감사기록 보호
select tests.ok((select count(*) from public.audit_logs) = 1, 'B는 자기 감사기록(동의 1건)만 봄');
select tests.fails($$insert into public.audit_logs (action) values ('login')$$, '사용자는 감사기록을 쓸 수 없음');

-- ── 다시 A ──────────────────────────────────────────────────────────────
select tests.login('aaaaaaaa-0000-0000-0000-000000000001');
update public.health_measurements set systolic = 130 where id = 'a0000000-0000-0000-0000-00000000000b';
select tests.ok(
  (select detail -> 'changed' from public.audit_logs where action = 'update' and target_id = 'a0000000-0000-0000-0000-00000000000b')
    = '["systolic"]'::jsonb,
  '수정 감사기록에는 바뀐 칸 이름만 남음 (값 없음)');
select tests.ok(
  not exists (select 1 from public.audit_logs where detail::text like '%130%' or detail::text like '%128%'),
  '감사기록에 건강 수치가 남지 않음');
select tests.fails($$delete from public.audit_logs$$, '사용자는 감사기록을 지울 수 없음 (권한 없음)');
select tests.fails($$update public.audit_logs set action = 'login'$$, '사용자는 감사기록을 고칠 수 없음 (권한 없음)');
select tests.ok((select count(*) from public.audit_logs where action = 'insert') >= 7, '기록 저장마다 감사기록 생성');

-- 동의 철회 → 새 저장 불가, 기존 기록은 보임
select public.withdraw_consent('sensitive_health');
select tests.ok(not public.has_health_consent(), '건강정보 동의 철회됨');
select tests.fails($$insert into public.health_measurements (kind, weight_kg, measured_at) values ('weight', 60, now())$$,
                   '동의 철회 후 새 건강기록 저장 불가');
select tests.ok((select count(*) from public.health_measurements) = 2, '철회 후에도 기존 기록은 본인이 볼 수 있음');
select tests.ok((select count(*) from public.consents where withdrawn_at is not null) = 1, '철회해도 동의 기록은 남음(증빙)');
select tests.ok(tests.affected($$delete from public.consents$$) = 0, '사용자는 동의 기록을 지울 수 없음');

-- ── 로그인 안 한 사용자 ─────────────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', '', false);
set role anon;
select tests.fails($$select count(*) from public.health_measurements$$, '로그인 안 하면 건강기록 표 접근 불가');
select tests.fails($$select count(*) from public.profiles$$, '로그인 안 하면 프로필 표 접근 불가');

-- ── 계정 삭제 (관리자 권한 = Edge Function이 하는 일) ────────────────────
reset role;
delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select tests.ok((select count(*) from public.health_measurements where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, '계정 삭제 → 건강기록 모두 삭제');
select tests.ok((select count(*) from public.medication_intakes where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, '계정 삭제 → 복약 기록 모두 삭제');
select tests.ok((select count(*) from public.appointment_questions where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, '계정 삭제 → 질문 메모 모두 삭제');
select tests.ok((select count(*) from public.consents where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, '계정 삭제 → 동의 기록 삭제');
select tests.ok((select count(*) from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, '계정 삭제 → 프로필 삭제');
select tests.ok((select count(*) from public.audit_logs where subject_id = 'aaaaaaaa-0000-0000-0000-000000000001') > 0, '계정 삭제 후에도 감사기록은 보관');

\o
-- 결과 -----------------------------------------------------------------
select format('%s개 통과 / 전체 %s개', count(*) filter (where ok), count(*)) as "2단계 보안 시험" from tests.results;
