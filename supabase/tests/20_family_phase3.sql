-- ============================================================================
-- 3단계 보안 시험: 가족 초대·공유·철회 (C = 정보 주인, D = 보는 가족, E = 남)
-- 10_rls_phase2.sql 의 시험 도구(tests 스키마)를 그대로 사용
-- ============================================================================
\set ON_ERROR_STOP on
set client_min_messages = warning;
\o /dev/null

create table tests.ctx (k text primary key, v text);
grant all on tests.ctx to authenticated;
select max(n) as start_n from tests.results \gset

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000003', 'c@example.test'),
  ('dddddddd-0000-0000-0000-000000000004', 'd@example.test'),
  ('eeeeeeee-0000-0000-0000-000000000005', 'e@example.test');

-- ── C: 동의 + 기록 ─────────────────────────────────────────────────────
set role authenticated;
select tests.login('cccccccc-0000-0000-0000-000000000003');

select tests.fails($$select public.create_family_invite('딸', '어머니', true, false, false, true, false, 'v')$$,
                   '건강정보 동의 없이는 초대 불가');

insert into public.consents (consent_type, version) values ('sensitive_health', 'v'), ('terms', 'v'), ('privacy', 'v'), ('age_14', 'v');
insert into public.health_measurements (kind, systolic, diastolic, measured_at, memo) values ('bp', 131, 85, now() - interval '1 hour', '비밀메모혈압');
insert into public.health_measurements (kind, systolic, diastolic, measured_at) values ('bp', 129, 83, now() - interval '20 days');
insert into public.health_measurements (kind, glucose_mgdl, glucose_timing, measured_at, memo) values ('glucose', 104, 'fasting', now() - interval '2 hours', '비밀메모혈당');
insert into public.medications (id, name) values ('c0000000-0000-0000-0000-0000000000c1', '비밀약이름');
insert into public.medication_schedules (id, medication_id, slot, time_of_day)
  values ('c0000000-0000-0000-0000-0000000000c2', 'c0000000-0000-0000-0000-0000000000c1', 'morning', '08:00');
insert into public.medication_intakes (schedule_id, scheduled_date, status)
  values ('c0000000-0000-0000-0000-0000000000c2', (now() at time zone 'Asia/Seoul')::date, 'taken');
insert into public.appointments (id, hospital_name, visit_at, memo) values ('c0000000-0000-0000-0000-0000000000c3', '시험내과', now() + interval '2 days', '비밀메모병원');
insert into public.appointment_questions (appointment_id, content) values ('c0000000-0000-0000-0000-0000000000c3', '비밀질문');

select tests.fails($$select public.create_family_invite('딸', '어머니', false, false, false, false, false, 'v')$$,
                   '공유 항목 없이 초대 불가');

-- 혈압 + 약 확인만 공유하는 초대
insert into tests.ctx values ('code1', public.create_family_invite('딸', '어머니', true, false, false, true, false, 'v'));
select tests.ok((select v from tests.ctx where k = 'code1') ~ '^[0-9]{6}$', '초대 코드는 숫자 6자리');
select tests.ok(not exists (select 1 from public.family_invites where code_hash = (select v from tests.ctx where k = 'code1')),
                '원래 코드는 저장하지 않음 (해시만)');
select tests.ok((select count(*) from public.family_invites) = 1, '내 초대는 내가 볼 수 있음');
select tests.ok(exists (select 1 from public.audit_logs where action = 'consent_agree' and detail ->> 'type' = 'family_share'),
                '가족 공유 동의가 감사기록에 남음');
select tests.ok(((public.accept_family_invite((select v from tests.ctx where k = 'code1'))) ->> 'reason') = 'own_code',
                '내 코드를 내가 입력할 수 없음');
select tests.fails($$insert into public.family_invites (code_hash, relation_label, owner_label, share_bp, consent_version)
                     values ('x', '딸', '어머니', true, 'v')$$, '초대를 표에 직접 쓸 수 없음 (서버 함수만)');

-- ── E: 틀린 코드 5번 → 막힘 ─────────────────────────────────────────────
select tests.login('eeeeeeee-0000-0000-0000-000000000005');
select tests.ok((select count(*) from public.family_invites) = 0, '남의 초대는 볼 수 없음');
select public.accept_family_invite('000000'), public.accept_family_invite('000001'), public.accept_family_invite('000002'),
       public.accept_family_invite('000003');
select tests.ok((public.accept_family_invite('000004') ->> 'reason') = 'invalid_code', '틀린 코드는 거부');
select tests.ok((public.accept_family_invite((select v from tests.ctx where k = 'code1')) ->> 'reason') = 'too_many_attempts',
                '1시간에 5번 틀리면 맞는 코드도 거부 (무작위 대입 방지)');
select tests.fails($$select count(*) from public.family_invite_attempts$$, '시도 기록 표는 사용자가 볼 수 없음');

-- ── D: 맞는 코드로 연결 ────────────────────────────────────────────────
select tests.login('dddddddd-0000-0000-0000-000000000004');
insert into tests.ctx select 'accept1', public.accept_family_invite((select v from tests.ctx where k = 'code1'))::text;
select tests.ok(((select v from tests.ctx where k = 'accept1')::jsonb ->> 'ok')::boolean, '맞는 코드로 연결됨');
insert into tests.ctx select 'link1', (select v from tests.ctx where k = 'accept1')::jsonb ->> 'link_id';
select tests.ok((public.accept_family_invite((select v from tests.ctx where k = 'code1')) ->> 'reason') = 'invalid_code',
                '한 번 쓴 코드는 다시 못 씀');
select tests.ok((select count(*) from public.family_links where status = 'active') = 1, 'D는 자기 연결을 봄');

-- 공유 범위 확인
insert into tests.ctx select 'sum1', public.get_shared_summary((select v::uuid from tests.ctx where k = 'link1'))::text;
select tests.ok((select v::jsonb ? 'bp' from tests.ctx where k = 'sum1'), '허용한 혈압은 보임');
select tests.ok((select jsonb_array_length(v::jsonb -> 'bp') from tests.ctx where k = 'sum1') = 1, '혈압은 최근 7일 것만');
select tests.ok((select v::jsonb ? 'intakes_today' from tests.ctx where k = 'sum1'), '허용한 약 확인 여부는 보임');
select tests.ok((select (v::jsonb -> 'intakes_today' -> 0 ->> 'taken')::boolean from tests.ctx where k = 'sum1'), '오늘 아침 약 확인됨으로 보임');
select tests.ok((select not (v::jsonb ? 'glucose') and not (v::jsonb ? 'weight') and not (v::jsonb ? 'next_appointment')
                 from tests.ctx where k = 'sum1'), '허용하지 않은 혈당·체중·병원 일정은 안 보임');
select tests.ok((select v not like '%비밀%' from tests.ctx where k = 'sum1'), '메모·약 이름·질문은 절대 안 보임');

-- 직접 접근 차단
select tests.ok((select count(*) from public.health_measurements) = 0, 'D는 C의 건강기록 표를 직접 읽을 수 없음');
select tests.ok((select count(*) from public.medications) = 0, 'D는 C의 약 표를 직접 읽을 수 없음');
select tests.ok((select count(*) from public.appointment_questions) = 0, 'D는 C의 질문 메모를 읽을 수 없음');
select tests.fails($$select public.update_family_share_scope((select v::uuid from tests.ctx where k = 'link1'), true, true, true, true, true)$$,
                   '보는 가족은 공유 항목을 넓힐 수 없음');
select tests.fails($$update public.family_links set share_glucose = true$$, '연결 표를 직접 고칠 수 없음');
select tests.fails($$insert into public.family_links (owner_id, viewer_id, relation_label, owner_label, share_bp, consented_at, consent_version)
                     values ('cccccccc-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000004', '딸', '어머니', true, now(), 'v')$$,
                   '연결을 표에 직접 만들 수 없음');

-- ── E: 남의 연결 ────────────────────────────────────────────────────
select tests.login('eeeeeeee-0000-0000-0000-000000000005');
select tests.ok((select count(*) from public.family_links) = 0, '남은 연결을 볼 수 없음');
select tests.ok(public.get_shared_summary((select v::uuid from tests.ctx where k = 'link1')) is null, '남은 연결 id를 알아도 정보를 못 받음');
select tests.fails($$select public.revoke_family_link((select v::uuid from tests.ctx where k = 'link1'))$$, '남은 연결을 끊을 수 없음');

-- ── C: 열람 기록 확인, 공유 항목 변경 ────────────────────────────────────
select tests.login('cccccccc-0000-0000-0000-000000000003');
select tests.ok((select count(*) from public.audit_logs where action = 'family_view' and target_id = (select v::uuid from tests.ctx where k = 'link1')) = 1,
                '정보 주인은 가족이 본 기록을 확인 가능 (남의 시도는 기록 안 됨)');
select tests.ok(not exists (select 1 from public.audit_logs where action = 'family_view' and detail::text ~ '13[0-9]|비밀'),
                '열람 감사기록에 수치·메모 없음');
select public.update_family_share_scope((select v::uuid from tests.ctx where k = 'link1'), false, true, false, false, false);

select tests.login('dddddddd-0000-0000-0000-000000000004');
insert into tests.ctx select 'sum2', public.get_shared_summary((select v::uuid from tests.ctx where k = 'link1'))::text;
select tests.ok((select (v::jsonb ? 'glucose') and not (v::jsonb ? 'bp') and not (v::jsonb ? 'intakes_today') from tests.ctx where k = 'sum2'),
                '항목을 바꾸면 즉시 반영 (혈당만 보임)');

-- ── C가 건강정보 동의 철회 → 공유도 멈춤 ─────────────────────────────────
select tests.login('cccccccc-0000-0000-0000-000000000003');
select public.withdraw_consent('sensitive_health');
select tests.login('dddddddd-0000-0000-0000-000000000004');
select tests.ok(public.get_shared_summary((select v::uuid from tests.ctx where k = 'link1')) is null, '주인이 건강정보 동의를 철회하면 공유도 멈춤');
select tests.login('cccccccc-0000-0000-0000-000000000003');
insert into public.consents (consent_type, version) values ('sensitive_health', 'v2');
select tests.login('dddddddd-0000-0000-0000-000000000004');
select tests.ok(public.get_shared_summary((select v::uuid from tests.ctx where k = 'link1')) is not null, '다시 동의하면 공유 재개');

-- ── D가 그만 보기 ───────────────────────────────────────────────────
select public.revoke_family_link((select v::uuid from tests.ctx where k = 'link1'));
select tests.ok(public.get_shared_summary((select v::uuid from tests.ctx where k = 'link1')) is null, '그만 보기 후 정보 못 받음');
select tests.fails($$select public.revoke_family_link((select v::uuid from tests.ctx where k = 'link1'))$$, '이미 끝난 연결은 다시 끊을 수 없음');

-- ── 다시 초대 → C가 철회 ─────────────────────────────────────────────
select tests.login('cccccccc-0000-0000-0000-000000000003');
select tests.ok((select status from public.family_links where id = (select v::uuid from tests.ctx where k = 'link1')) = 'revoked', '주인도 끝난 연결을 확인 가능');
insert into tests.ctx values ('code2', public.create_family_invite('딸', '어머니', true, false, false, false, false, 'v'));
select tests.login('dddddddd-0000-0000-0000-000000000004');
insert into tests.ctx select 'link2', public.accept_family_invite((select v from tests.ctx where k = 'code2')) ->> 'link_id';
select tests.ok((select v from tests.ctx where k = 'link2') is not null, '끝난 뒤 새 초대로 다시 연결 가능');
select tests.ok((public.accept_family_invite((select v from tests.ctx where k = 'code2')) ->> 'ok')::boolean is false, '이미 연결된 상태에서 중복 연결 불가');
select tests.login('cccccccc-0000-0000-0000-000000000003');
select public.revoke_family_link((select v::uuid from tests.ctx where k = 'link2'));
select tests.ok(exists (select 1 from public.audit_logs where action = 'link_revoke' and detail ->> 'by' = 'owner'), '주인의 철회가 감사기록에 남음');
select tests.login('dddddddd-0000-0000-0000-000000000004');
select tests.ok(public.get_shared_summary((select v::uuid from tests.ctx where k = 'link2')) is null, '주인이 철회하면 즉시 못 봄');

-- ── 만료 ────────────────────────────────────────────────────────────
select tests.login('cccccccc-0000-0000-0000-000000000003');
insert into tests.ctx values ('code3', public.create_family_invite('아들', '어머니', true, false, false, false, false, 'v'));
reset role;
update public.family_invites set expires_at = now() - interval '1 minute' where used_at is null;
set role authenticated;
select tests.login('eeeeeeee-0000-0000-0000-000000000005');
reset role;
delete from public.family_invite_attempts; -- E의 시도 제한 초기화 (시험용)
set role authenticated;
select tests.ok((public.accept_family_invite((select v from tests.ctx where k = 'code3')) ->> 'reason') = 'invalid_code', '24시간 지난 코드는 거부');

-- ── 로그인 안 한 사용자 ─────────────────────────────────────────────
reset role;
select set_config('request.jwt.claims', '', false);
set role anon;
select tests.fails($$select public.get_shared_summary('00000000-0000-0000-0000-000000000000')$$, '로그인 안 하면 가족 정보 함수 실행 불가');
select tests.fails($$select public.accept_family_invite('123456')$$, '로그인 안 하면 초대 코드 입력 불가');

-- ── 계정 삭제 → 연결·초대도 삭제 ─────────────────────────────────────
reset role;
delete from auth.users where id = 'cccccccc-0000-0000-0000-000000000003';
select tests.ok((select count(*) from public.family_links where owner_id = 'cccccccc-0000-0000-0000-000000000003') = 0, '주인 계정 삭제 → 연결 삭제');
select tests.ok((select count(*) from public.family_invites where owner_id = 'cccccccc-0000-0000-0000-000000000003') = 0, '주인 계정 삭제 → 초대 삭제');

\o
select format('%s개 통과 / 전체 %s개', count(*) filter (where ok), count(*)) as "3단계 가족 공유 보안 시험"
  from tests.results where n > :start_n;
