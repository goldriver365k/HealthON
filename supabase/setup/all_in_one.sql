-- ============================================================================
-- 오늘건강 DB 설정 (한 번에 붙여넣기용) — 자동 생성 파일, 직접 고치지 마세요
-- 만드는 방법: bash scripts/build-setup-sql.sh
-- 사용법: 이 파일의 '내용 전체'를 Supabase > SQL Editor 에 붙여넣고 [Run] 한 번
-- ⚠ 새 프로젝트에 한 번만 실행하세요. (두 번 실행하면 '이미 있음' 오류가 납니다)
-- ============================================================================

-- ▶▶▶ supabase/migrations/20261104000001_core_schema.sql
-- ============================================================================
-- 오늘건강 2단계: 기본 테이블
-- 설계 근거: docs/MASTER_PLAN.md D장
-- 원칙: 최소 수집(생년월일·성별·주소·질병명 없음), 모든 기록에 source(real/sample)
-- 🔒 보안 검토 대상
-- ============================================================================

-- 공통: updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── 1. 사용자 정보 ─────────────────────────────────────────────────────────
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text check (char_length(display_name) <= 20),
  font_scale    numeric(3, 2) not null default 1.0 check (font_scale between 1.0 and 1.6),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── 2. 동의 기록 (철회해도 지우지 않음: 증빙) ──────────────────────────────
create table public.consents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  consent_type  text not null check (consent_type in ('terms', 'privacy', 'sensitive_health', 'age_14')),
  version       text not null check (char_length(version) <= 30),
  agreed_at     timestamptz not null default now(),
  withdrawn_at  timestamptz
);
create index consents_user_idx on public.consents (user_id, consent_type);
-- 같은 종류의 '유효한' 동의는 하나만
create unique index consents_active_uniq on public.consents (user_id, consent_type) where withdrawn_at is null;

-- ── 3. 건강 측정 기록 ───────────────────────────────────────────────────────
-- 숫자 범위는 입력 실수 방지용이며 건강 판정 기준이 아니다 (src/utils/validate.ts와 같은 값)
create table public.health_measurements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind            text not null check (kind in ('bp', 'glucose', 'weight')),
  systolic        int check (systolic between 50 and 260),
  diastolic       int check (diastolic between 30 and 160),
  pulse           int check (pulse between 30 and 220),
  glucose_mgdl    int check (glucose_mgdl between 20 and 600),
  glucose_timing  text check (glucose_timing in ('fasting', 'after_meal', 'bedtime', 'other')),
  weight_kg       numeric(4, 1) check (weight_kg between 20 and 250),
  measured_at     timestamptz not null,
  memo            text check (char_length(memo) <= 200),
  source          text not null default 'real' check (source in ('real', 'sample')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- 종류별 필수 값
  constraint measurement_shape check (
    (kind = 'bp' and systolic is not null and diastolic is not null and systolic > diastolic
       and glucose_mgdl is null and weight_kg is null)
    or (kind = 'glucose' and glucose_mgdl is not null and glucose_timing is not null
       and systolic is null and diastolic is null and pulse is null and weight_kg is null)
    or (kind = 'weight' and weight_kg is not null
       and systolic is null and diastolic is null and pulse is null and glucose_mgdl is null)
  )
);
create index health_measurements_user_time_idx on public.health_measurements (user_id, kind, measured_at desc);

-- ── 4. 등록 약품 ────────────────────────────────────────────────────────────
create table public.medications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  dose_text   text check (char_length(dose_text) <= 20),
  memo        text check (char_length(memo) <= 200),
  is_active   boolean not null default true,
  source      text not null default 'real' check (source in ('real', 'sample')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id) -- 아래 테이블이 "같은 주인"을 강제하기 위한 복합 참조용
);

-- ── 5. 복약 일정 ────────────────────────────────────────────────────────────
create table public.medication_schedules (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid(),
  medication_id  uuid not null,
  slot           text not null check (slot in ('morning', 'noon', 'evening', 'bedtime', 'custom')),
  time_of_day    time not null,
  days_of_week   smallint[] not null default '{0,1,2,3,4,5,6}'
                   check (days_of_week <@ '{0,1,2,3,4,5,6}'::smallint[] and cardinality(days_of_week) between 1 and 7),
  remind         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- 남의 약에 일정을 붙일 수 없도록 (약 주인 = 일정 주인)
  foreign key (medication_id, user_id) references public.medications (id, user_id) on delete cascade,
  unique (id, user_id)
);
create index medication_schedules_user_idx on public.medication_schedules (user_id);

-- ── 6. 복약 확인 기록 ───────────────────────────────────────────────────────
create table public.medication_intakes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid(),
  schedule_id     uuid not null,
  scheduled_date  date not null,
  status          text not null check (status in ('taken', 'skipped')),
  checked_at      timestamptz not null default now(),
  source          text not null default 'real' check (source in ('real', 'sample')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (schedule_id, user_id) references public.medication_schedules (id, user_id) on delete cascade,
  unique (schedule_id, scheduled_date)
);
create index medication_intakes_user_date_idx on public.medication_intakes (user_id, scheduled_date desc);

-- ── 7. 병원 방문 일정 ───────────────────────────────────────────────────────
create table public.appointments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  hospital_name  text not null check (char_length(hospital_name) between 1 and 40),
  department     text check (char_length(department) <= 20),
  visit_at       timestamptz not null,
  remind_before  text not null default 'day_before' check (remind_before in ('none', 'day_before', 'same_day')),
  memo           text check (char_length(memo) <= 200),
  source         text not null default 'real' check (source in ('real', 'sample')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, user_id)
);
create index appointments_user_time_idx on public.appointments (user_id, visit_at);

-- ── 8. 진료 질문 메모 (가족에게 공유하지 않음) ──────────────────────────────
create table public.appointment_questions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid(),
  appointment_id  uuid not null,
  content         text not null check (char_length(content) between 1 and 200),
  is_done         boolean not null default false,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (appointment_id, user_id) references public.appointments (id, user_id) on delete cascade
);
create index appointment_questions_apt_idx on public.appointment_questions (appointment_id);

-- ── 11. 긴급 연락처 ─────────────────────────────────────────────────────────
create table public.emergency_contacts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 20),
  phone           text not null check (phone ~ '^[0-9+\- ]{9,15}$'),
  relation_label  text check (char_length(relation_label) <= 10),
  priority        smallint not null default 1,
  source          text not null default 'real' check (source in ('real', 'sample')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── 12. 알림 설정 (실제 알림 예약은 기기 안에서) ────────────────────────────
create table public.notification_settings (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  meds_enabled          boolean not null default true,
  appointments_enabled  boolean not null default true,
  show_med_name         boolean not null default false, -- 잠금화면에 약 이름 노출 (기본: 숨김)
  updated_at            timestamptz not null default now()
);

-- updated_at 트리거 연결
do $$
declare t text;
begin
  foreach t in array array['profiles','health_measurements','medications','medication_schedules',
                           'medication_intakes','appointments','appointment_questions',
                           'emergency_contacts','notification_settings']
  loop
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- 가입 시 프로필·알림 설정 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.notification_settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ▶▶▶ supabase/migrations/20261104000002_rls.sql
-- ============================================================================
-- 오늘건강 2단계: 행 단위 보안(RLS) — "내 기록은 나만"
-- 🔒 보안 검토 대상
-- - 모든 테이블 RLS 켬. 정책이 없으면 아무도 접근 못함(기본 차단).
-- - 로그인하지 않은 사용자(anon)에게는 어떤 정책도 주지 않음.
-- - 건강정보 테이블은 '건강정보 처리 동의(sensitive_health)'가 유효할 때만 새로 저장 가능.
-- - 가족 조회 정책은 여기 없음 → 3단계에서 서버 함수로만 허용.
-- ============================================================================

-- 건강정보 동의가 유효한지 (본인 기준)
create or replace function public.has_health_consent()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.consents c
    where c.user_id = (select auth.uid())
      and c.consent_type = 'sensitive_health'
      and c.withdrawn_at is null
  );
$$;
revoke execute on function public.has_health_consent() from public, anon;
grant execute on function public.has_health_consent() to authenticated;

alter table public.profiles              enable row level security;
alter table public.consents              enable row level security;
alter table public.health_measurements   enable row level security;
alter table public.medications           enable row level security;
alter table public.medication_schedules  enable row level security;
alter table public.medication_intakes    enable row level security;
alter table public.appointments          enable row level security;
alter table public.appointment_questions enable row level security;
alter table public.emergency_contacts    enable row level security;
alter table public.notification_settings enable row level security;

-- ── profiles: 본인 조회·수정 (생성은 가입 트리거, 삭제는 계정 삭제 시 연쇄) ──
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ── consents: 본인 조회·추가만. 수정·삭제 불가 (철회는 withdraw_consent 함수) ──
create policy "consents_select_own" on public.consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy "consents_insert_own" on public.consents
  for insert to authenticated with check (user_id = (select auth.uid()) and withdrawn_at is null);

-- ── 건강정보 테이블: 본인 조회·수정·삭제, 추가는 동의가 있을 때만 ──────────
do $$
declare t text;
begin
  foreach t in array array['health_measurements','medications','medication_schedules',
                           'medication_intakes','appointments','appointment_questions']
  loop
    execute format($f$
      create policy "%1$s_select_own" on public.%1$I
        for select to authenticated using (user_id = (select auth.uid()));
      create policy "%1$s_insert_own_with_consent" on public.%1$I
        for insert to authenticated
        with check (user_id = (select auth.uid()) and (select public.has_health_consent()));
      create policy "%1$s_update_own" on public.%1$I
        for update to authenticated
        using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
      create policy "%1$s_delete_own" on public.%1$I
        for delete to authenticated using (user_id = (select auth.uid()));
    $f$, t);
  end loop;
end $$;

-- ── emergency_contacts: 본인만 ──────────────────────────────────────────────
create policy "emergency_contacts_all_own" on public.emergency_contacts
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ── notification_settings: 본인 조회·수정 ──────────────────────────────────
create policy "notification_settings_select_own" on public.notification_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "notification_settings_update_own" on public.notification_settings
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 로그인 안 한 사용자는 표 자체에 손대지 못하게 (RLS와 이중 차단)
revoke all on all tables in schema public from anon;

-- 동의 철회 (본인 것만, 기록은 남김)
create or replace function public.withdraw_consent(p_type text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;
  update public.consents
     set withdrawn_at = now()
   where user_id = (select auth.uid())
     and consent_type = p_type
     and withdrawn_at is null;
end;
$$;
revoke execute on function public.withdraw_consent(text) from public, anon;
grant execute on function public.withdraw_consent(text) to authenticated;

-- ▶▶▶ supabase/migrations/20261104000003_audit.sql
-- ============================================================================
-- 오늘건강 2단계: 보안 감사 기록
-- 🔒 보안 검토 대상
-- - 누가·언제·무엇을(어느 표의 어느 기록) 했는지 남긴다.
-- - 건강 수치 자체는 남기지 않는다 (수정 시 "바뀐 칸 이름"만).
-- - 사용자는 자기 정보에 대한 기록을 볼 수만 있고, 쓰기·고치기·지우기는 누구도 못한다.
-- - 계정이 삭제돼도 감사기록은 보관기간 동안 남는다 (사용자 id만 남고 다른 개인정보는 없음).
--   보관기간 2년 [추정·전문가 검토 필요]
-- ============================================================================

create table public.audit_logs (
  id            bigint generated always as identity primary key,
  occurred_at   timestamptz not null default now(),
  actor_id      uuid,       -- 행동한 사람 (FK 없음: 계정 삭제 후에도 기록 유지)
  subject_id    uuid,       -- 정보 주인
  action        text not null check (action in (
                  'insert', 'update', 'delete', 'family_view', 'consent_agree', 'consent_withdraw',
                  'link_create', 'link_revoke', 'account_delete', 'login')),
  target_table  text,
  target_id     uuid,
  detail        jsonb
);
create index audit_logs_subject_idx on public.audit_logs (subject_id, occurred_at desc);

alter table public.audit_logs enable row level security;
create policy "audit_logs_select_own" on public.audit_logs
  for select to authenticated using (subject_id = (select auth.uid()));
-- 쓰기 정책 없음 + 권한 회수 = 사용자는 절대 쓰거나 지울 수 없음
revoke insert, update, delete, truncate on public.audit_logs from authenticated, anon;

-- 기록 변경 감사 트리거
create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row      jsonb;
  v_changed  jsonb;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  if tg_op = 'UPDATE' then
    -- 값은 남기지 않고 바뀐 칸 이름만 남긴다
    select coalesce(jsonb_agg(n.key), '[]'::jsonb) into v_changed
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o using (key)
     where n.value is distinct from o.value
       and n.key not in ('updated_at');
  end if;

  insert into public.audit_logs (actor_id, subject_id, action, target_table, target_id, detail)
  values (
    (select auth.uid()),
    coalesce((v_row ->> 'user_id')::uuid, (v_row ->> 'id')::uuid),
    lower(tg_op),
    tg_table_name,
    (v_row ->> 'id')::uuid,
    case when tg_op = 'UPDATE' then jsonb_build_object('changed', v_changed) else null end
  );
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['health_measurements','medications','medication_schedules',
                           'medication_intakes','appointments','appointment_questions',
                           'emergency_contacts']
  loop
    execute format('create trigger audit_row_change after insert or update or delete on public.%I
                    for each row execute function public.audit_row_change()', t);
  end loop;
end $$;

-- 동의·철회 감사
create or replace function public.audit_consent_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, subject_id, action, target_table, target_id, detail)
    values ((select auth.uid()), new.user_id, 'consent_agree', 'consents', new.id,
            jsonb_build_object('type', new.consent_type, 'version', new.version));
  elsif tg_op = 'UPDATE' and old.withdrawn_at is null and new.withdrawn_at is not null then
    insert into public.audit_logs (actor_id, subject_id, action, target_table, target_id, detail)
    values ((select auth.uid()), new.user_id, 'consent_withdraw', 'consents', new.id,
            jsonb_build_object('type', new.consent_type));
  end if;
  return null;
end;
$$;

create trigger audit_consent_change
  after insert or update on public.consents
  for each row execute function public.audit_consent_change();

-- 보관기간이 지난 감사기록 정리 (4단계에서 예약 실행 방법 결정)
create or replace function public.purge_old_audit_logs(p_keep interval default interval '2 years')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_count bigint;
begin
  delete from public.audit_logs where occurred_at < now() - p_keep;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.purge_old_audit_logs(interval) from public, anon, authenticated;

-- ▶▶▶ supabase/migrations/20261105000001_family_sharing.sql
-- ============================================================================
-- 오늘건강 3단계: 가족 초대·연결·공유
-- 설계 근거: docs/MASTER_PLAN.md D-1 #9·#10, D-3
-- 🔒 보안 검토 대상
-- 원칙
--  1) 가족(보는 사람)은 건강정보 표를 직접 읽을 수 없다. 기존 표의 RLS는 "본인만" 그대로.
--  2) 가족은 get_shared_summary() 서버 함수로만 조회한다. 함수는 매번
--     연결 상태·공유 항목·정보 주인의 건강정보 동의를 다시 검사하고 감사기록을 남긴다.
--  3) 공유 범위 최소화: 최근 7일 수치, 오늘 약 확인 여부(약 이름 없음), 다음 병원 일정만.
--     메모·진료 질문 메모는 어떤 경우에도 공유하지 않는다.
--  4) 초대 코드는 해시로만 저장, 24시간 만료, 1회용. 코드 입력 실패는 사용자당 1시간 5회로 제한.
--  5) 정보 주인은 언제든 항목 변경·철회, 보는 가족도 언제든 그만 보기 가능.
-- ============================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ── 9. 가족 초대 코드 ───────────────────────────────────────────────────────
create table public.family_invites (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code_hash           text not null,
  relation_label      text not null check (char_length(relation_label) between 1 and 10), -- 주인이 부르는 가족 (예: 딸)
  owner_label         text not null check (char_length(owner_label) between 1 and 20),    -- 가족에게 보일 주인 이름 (예: 어머니)
  share_bp            boolean not null default false,
  share_glucose       boolean not null default false,
  share_weight        boolean not null default false,
  share_intakes       boolean not null default false,
  share_appointments  boolean not null default false,
  consent_version     text not null check (char_length(consent_version) <= 30),
  expires_at          timestamptz not null default now() + interval '24 hours',
  used_at             timestamptz,
  used_by             uuid,
  created_at          timestamptz not null default now(),
  constraint invite_has_scope check (share_bp or share_glucose or share_weight or share_intakes or share_appointments)
);
create index family_invites_owner_idx on public.family_invites (owner_id);
create index family_invites_code_idx on public.family_invites (code_hash) where used_at is null;

-- ── 10. 가족 연결 (가족별·항목별 공유 권한) ─────────────────────────────────
create table public.family_links (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users (id) on delete cascade, -- 정보 주인
  viewer_id           uuid not null references auth.users (id) on delete cascade, -- 보는 가족
  relation_label      text not null check (char_length(relation_label) between 1 and 10),
  owner_label         text not null check (char_length(owner_label) between 1 and 20),
  share_bp            boolean not null default false,
  share_glucose       boolean not null default false,
  share_weight        boolean not null default false,
  share_intakes       boolean not null default false,
  share_appointments  boolean not null default false,
  status              text not null default 'active' check (status in ('active', 'revoked')),
  consented_at        timestamptz not null,
  consent_version     text not null,
  revoked_at          timestamptz,
  revoked_by          uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint link_not_self check (owner_id <> viewer_id)
);
create unique index family_links_active_pair on public.family_links (owner_id, viewer_id) where status = 'active';
create index family_links_viewer_idx on public.family_links (viewer_id) where status = 'active';
create trigger set_updated_at before update on public.family_links
  for each row execute function public.set_updated_at();

-- ── 코드 입력 시도 기록 (무작위 대입 방지용, 사용자에게 보이지 않음) ─────────
create table public.family_invite_attempts (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  attempted_at  timestamptz not null default now(),
  success       boolean not null
);
create index family_invite_attempts_user_idx on public.family_invite_attempts (user_id, attempted_at desc);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.family_invites         enable row level security;
alter table public.family_links           enable row level security;
alter table public.family_invite_attempts enable row level security;

-- 초대: 만든 사람만 보고 취소(삭제). 만들기는 서버 함수로만.
create policy "family_invites_select_own" on public.family_invites
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "family_invites_delete_own" on public.family_invites
  for delete to authenticated using (owner_id = (select auth.uid()));

-- 연결: 양쪽 당사자만 볼 수 있음. 만들기·바꾸기·철회는 서버 함수로만.
create policy "family_links_select_party" on public.family_links
  for select to authenticated
  using (owner_id = (select auth.uid()) or viewer_id = (select auth.uid()));

-- family_invite_attempts: 정책 없음 = 사용자 접근 불가

-- 표에 직접 쓰기 금지 (RLS와 이중 차단)
revoke insert, update on public.family_invites from authenticated, anon;
revoke insert, update, delete on public.family_links from authenticated, anon;
revoke all on public.family_invite_attempts from authenticated, anon;
revoke all on public.family_invites, public.family_links from anon;

-- ── 내부 도구 ───────────────────────────────────────────────────────────────
create or replace function public._code_hash(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest('oneul-family-invite:' || p_code, 'sha256'), 'hex');
$$;
revoke execute on function public._code_hash(text) from public, anon, authenticated;

-- 특정 사용자의 건강정보 동의가 유효한지 (서버 함수 내부용)
create or replace function public._has_health_consent_of(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.consents c
    where c.user_id = p_user and c.consent_type = 'sensitive_health' and c.withdrawn_at is null
  );
$$;
revoke execute on function public._has_health_consent_of(uuid) from public, anon, authenticated;

create or replace function public._scope_list(
  p_bp boolean, p_glucose boolean, p_weight boolean, p_intakes boolean, p_appointments boolean)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select 'bp' as x where p_bp
    union all select 'glucose' where p_glucose
    union all select 'weight' where p_weight
    union all select 'intakes' where p_intakes
    union all select 'appointments' where p_appointments
  ) s;
$$;
revoke execute on function public._scope_list(boolean, boolean, boolean, boolean, boolean) from public, anon, authenticated;

-- ── 초대 코드 만들기 (정보 주인) ───────────────────────────────────────────
-- 호출 전에 앱에서 제3자 제공 동의 화면을 거친다. 동의 사실은 감사기록에 남긴다.
create or replace function public.create_family_invite(
  p_relation_label text,
  p_owner_label text,
  p_share_bp boolean,
  p_share_glucose boolean,
  p_share_weight boolean,
  p_share_intakes boolean,
  p_share_appointments boolean,
  p_consent_version text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_code  text;
  v_id    uuid;
  v_tries int := 0;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public._has_health_consent_of(v_uid) then raise exception 'health_consent_required'; end if;
  if not (p_share_bp or p_share_glucose or p_share_weight or p_share_intakes or p_share_appointments) then
    raise exception 'scope_required';
  end if;

  -- 지난 초대 정리, 동시에 살아 있는 초대는 5개까지
  delete from public.family_invites where owner_id = v_uid and (used_at is not null or expires_at <= now());
  if (select count(*) from public.family_invites where owner_id = v_uid) >= 5 then
    raise exception 'too_many_invites';
  end if;

  -- 6자리 숫자 (암호학적 난수), 살아 있는 다른 초대와 겹치지 않게
  loop
    v_tries := v_tries + 1;
    v_code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
    exit when not exists (
      select 1 from public.family_invites
      where code_hash = public._code_hash(v_code) and used_at is null and expires_at > now()
    );
    if v_tries > 20 then raise exception 'code_generation_failed'; end if;
  end loop;

  insert into public.family_invites (
    owner_id, code_hash, relation_label, owner_label,
    share_bp, share_glucose, share_weight, share_intakes, share_appointments, consent_version)
  values (
    v_uid, public._code_hash(v_code), trim(p_relation_label), trim(p_owner_label),
    p_share_bp, p_share_glucose, p_share_weight, p_share_intakes, p_share_appointments, p_consent_version)
  returning id into v_id;

  insert into public.audit_logs (actor_id, subject_id, action, target_table, target_id, detail)
  values (v_uid, v_uid, 'consent_agree', 'family_invites', v_id,
          jsonb_build_object('type', 'family_share', 'version', p_consent_version,
            'categories', public._scope_list(p_share_bp, p_share_glucose, p_share_weight, p_share_intakes, p_share_appointments)));

  return v_code; -- 원래 코드는 여기서 한 번만 돌려주고 저장하지 않는다
end;
$$;

-- ── 초대 코드 입력 (보는 가족) ─────────────────────────────────────────────
-- 실패해도 오류를 던지지 않고 결과를 돌려준다 (시도 기록이 지워지지 않도록)
create or replace function public.accept_family_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_code   text := regexp_replace(coalesce(p_code, ''), '[^0-9]', '', 'g');
  v_inv    public.family_invites%rowtype;
  v_link   uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  if (select count(*) from public.family_invite_attempts
       where user_id = v_uid and not success and attempted_at > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'too_many_attempts');
  end if;

  select * into v_inv from public.family_invites
   where code_hash = public._code_hash(v_code) and used_at is null and expires_at > now()
   for update;

  if not found or not public._has_health_consent_of(v_inv.owner_id) then
    insert into public.family_invite_attempts (user_id, success) values (v_uid, false);
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  if v_inv.owner_id = v_uid then
    return jsonb_build_object('ok', false, 'reason', 'own_code');
  end if;

  if exists (select 1 from public.family_links
              where owner_id = v_inv.owner_id and viewer_id = v_uid and status = 'active') then
    return jsonb_build_object('ok', false, 'reason', 'already_linked');
  end if;

  insert into public.family_links (
    owner_id, viewer_id, relation_label, owner_label,
    share_bp, share_glucose, share_weight, share_intakes, share_appointments,
    consented_at, consent_version)
  values (
    v_inv.owner_id, v_uid, v_inv.relation_label, v_inv.owner_label,
    v_inv.share_bp, v_inv.share_glucose, v_inv.share_weight, v_inv.share_intakes, v_inv.share_appointments,
    v_inv.created_at, v_inv.consent_version)
  returning id into v_link;

  update public.family_invites set used_at = now(), used_by = v_uid where id = v_inv.id;
  insert into public.family_invite_attempts (user_id, success) values (v_uid, true);
  insert into public.audit_logs (actor_id, subject_id, action, target_table, target_id, detail)
  values (v_uid, v_inv.owner_id, 'link_create', 'family_links', v_link,
          jsonb_build_object('categories', public._scope_list(v_inv.share_bp, v_inv.share_glucose,
            v_inv.share_weight, v_inv.share_intakes, v_inv.share_appointments)));

  return jsonb_build_object('ok', true, 'link_id', v_link, 'owner_label', v_inv.owner_label);
end;
$$;

-- ── 공유 항목 바꾸기 (정보 주인만) ─────────────────────────────────────────
create or replace function public.update_family_share_scope(
  p_link_id uuid,
  p_share_bp boolean,
  p_share_glucose boolean,
  p_share_weight boolean,
  p_share_intakes boolean,
  p_share_appointments boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not (p_share_bp or p_share_glucose or p_share_weight or p_share_intakes or p_share_appointments) then
    raise exception 'scope_required'; -- 모두 끄려면 철회를 사용
  end if;
  update public.family_links
     set share_bp = p_share_bp, share_glucose = p_share_glucose, share_weight = p_share_weight,
         share_intakes = p_share_intakes, share_appointments = p_share_appointments
   where id = p_link_id and owner_id = v_uid and status = 'active';
  if not found then raise exception 'link_not_found'; end if;

  insert into public.audit_logs (actor_id, subject_id, action, target_table, target_id, detail)
  values (v_uid, v_uid, 'consent_agree', 'family_links', p_link_id,
          jsonb_build_object('type', 'family_share_change',
            'categories', public._scope_list(p_share_bp, p_share_glucose, p_share_weight, p_share_intakes, p_share_appointments)));
end;
$$;

-- ── 공유 그만두기 (정보 주인 = 동의 철회 / 보는 가족 = 그만 보기) ───────────
create or replace function public.revoke_family_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_owner uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  update public.family_links
     set status = 'revoked', revoked_at = now(), revoked_by = v_uid
   where id = p_link_id and status = 'active' and (owner_id = v_uid or viewer_id = v_uid)
  returning owner_id into v_owner;
  if not found then raise exception 'link_not_found'; end if;

  insert into public.audit_logs (actor_id, subject_id, action, target_table, target_id, detail)
  values (v_uid, v_owner, 'link_revoke', 'family_links', p_link_id,
          jsonb_build_object('by', case when v_owner = v_uid then 'owner' else 'viewer' end));
end;
$$;

-- ── 가족 정보 보기 (보는 가족) — 가족이 건강정보를 읽는 유일한 통로 ──────────
-- p_today: 정보 주인의 '오늘' (기본: 한국 시간)
create or replace function public.get_shared_summary(p_link_id uuid, p_today date default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_link   public.family_links%rowtype;
  v_today  date := coalesce(p_today, (now() at time zone 'Asia/Seoul')::date);
  v_since  timestamptz := now() - interval '7 days';
  v_result jsonb := '{}'::jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  -- 1) 내가 '보는 가족'인 살아 있는 연결인가
  select * into v_link from public.family_links
   where id = p_link_id and viewer_id = v_uid and status = 'active';
  if not found then return null; end if;

  -- 2) 정보 주인의 건강정보 동의가 아직 유효한가 (철회했으면 공유도 멈춤)
  if not public._has_health_consent_of(v_link.owner_id) then return null; end if;

  -- 3) 허용된 항목만 담는다 (메모 칸은 어떤 경우에도 넣지 않음)
  if v_link.share_bp then
    v_result := v_result || jsonb_build_object('bp', coalesce((
      select jsonb_agg(jsonb_build_object('measured_at', m.measured_at, 'systolic', m.systolic,
                                          'diastolic', m.diastolic) order by m.measured_at desc)
        from (select * from public.health_measurements
               where user_id = v_link.owner_id and kind = 'bp' and measured_at >= v_since
               order by measured_at desc limit 20) m), '[]'::jsonb));
  end if;
  if v_link.share_glucose then
    v_result := v_result || jsonb_build_object('glucose', coalesce((
      select jsonb_agg(jsonb_build_object('measured_at', m.measured_at, 'glucose_mgdl', m.glucose_mgdl,
                                          'glucose_timing', m.glucose_timing) order by m.measured_at desc)
        from (select * from public.health_measurements
               where user_id = v_link.owner_id and kind = 'glucose' and measured_at >= v_since
               order by measured_at desc limit 20) m), '[]'::jsonb));
  end if;
  if v_link.share_weight then
    v_result := v_result || jsonb_build_object('weight', coalesce((
      select jsonb_agg(jsonb_build_object('measured_at', m.measured_at, 'weight_kg', m.weight_kg)
                       order by m.measured_at desc)
        from (select * from public.health_measurements
               where user_id = v_link.owner_id and kind = 'weight' and measured_at >= v_since
               order by measured_at desc limit 10) m), '[]'::jsonb));
  end if;
  if v_link.share_intakes then
    -- 약 이름 없이 시간대와 확인 여부만
    v_result := v_result || jsonb_build_object('intakes_today', coalesce((
      select jsonb_agg(jsonb_build_object('slot', s.slot, 'time_of_day', to_char(s.time_of_day, 'HH24:MI'),
                                          'taken', i.status = 'taken') order by s.time_of_day, s.id)
        from public.medication_schedules s
        join public.medications md on md.id = s.medication_id and md.is_active
        left join public.medication_intakes i on i.schedule_id = s.id and i.scheduled_date = v_today
       where s.user_id = v_link.owner_id
         and extract(dow from v_today)::smallint = any (s.days_of_week)), '[]'::jsonb));
  end if;
  if v_link.share_appointments then
    v_result := v_result || jsonb_build_object('next_appointment', (
      select jsonb_build_object('hospital_name', a.hospital_name, 'visit_at', a.visit_at)
        from public.appointments a
       where a.user_id = v_link.owner_id and a.visit_at >= now()
       order by a.visit_at limit 1));
  end if;

  -- 4) 열람 감사기록 (정보 주인이 "누가 언제 봤는지" 확인 가능)
  insert into public.audit_logs (actor_id, subject_id, action, target_table, target_id, detail)
  values (v_uid, v_link.owner_id, 'family_view', 'family_links', v_link.id,
          jsonb_build_object('categories', public._scope_list(v_link.share_bp, v_link.share_glucose,
            v_link.share_weight, v_link.share_intakes, v_link.share_appointments)));

  return v_result;
end;
$$;

-- 서버 함수 실행 권한: 로그인한 사용자만
revoke execute on function public.create_family_invite(text, text, boolean, boolean, boolean, boolean, boolean, text) from public, anon;
revoke execute on function public.accept_family_invite(text) from public, anon;
revoke execute on function public.update_family_share_scope(uuid, boolean, boolean, boolean, boolean, boolean) from public, anon;
revoke execute on function public.revoke_family_link(uuid) from public, anon;
revoke execute on function public.get_shared_summary(uuid, date) from public, anon;
grant execute on function public.create_family_invite(text, text, boolean, boolean, boolean, boolean, boolean, text) to authenticated;
grant execute on function public.accept_family_invite(text) to authenticated;
grant execute on function public.update_family_share_scope(uuid, boolean, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.revoke_family_link(uuid) to authenticated;
grant execute on function public.get_shared_summary(uuid, date) to authenticated;

-- ▶▶▶ supabase/migrations/20261105000002_lock_trigger_functions.sql
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

-- ▶▶▶ supabase/migrations/20261106000001_daily_steps.sql
-- ============================================================================
-- 오늘건강: 만보기 (날짜별 걸음 수)
-- 🔒 보안 검토 대상
-- - 걸음 수는 휴대폰(아이폰 동작 기록)에서 읽어 날짜별 합계만 저장한다. 위치·시각별 기록은 저장하지 않는다.
-- - 다른 건강정보 테이블과 같은 규칙: 본인만 조회·수정·삭제, 추가는 건강정보 동의가 있을 때만.
-- - 가족 공유 범위에는 포함하지 않는다 (가족 공유 서버 함수는 이 표를 읽지 않음).
-- - 계정 삭제 시 auth.users 연쇄 삭제로 함께 지워진다.
-- ============================================================================

create table public.daily_steps (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  step_date   date not null,
  steps       integer not null check (steps between 0 and 200000),
  source      text not null default 'real' check (source in ('real', 'sample')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, step_date)
);
create index daily_steps_user_date_idx on public.daily_steps (user_id, step_date desc);

create trigger set_updated_at before update on public.daily_steps
  for each row execute function public.set_updated_at();

alter table public.daily_steps enable row level security;

create policy "daily_steps_select_own" on public.daily_steps
  for select to authenticated using (user_id = (select auth.uid()));
create policy "daily_steps_insert_own_with_consent" on public.daily_steps
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.has_health_consent()));
create policy "daily_steps_update_own" on public.daily_steps
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "daily_steps_delete_own" on public.daily_steps
  for delete to authenticated using (user_id = (select auth.uid()));

-- 로그인 안 한 사용자는 표 자체에 손댈 수 없음
revoke all on public.daily_steps from anon;

-- 감사기록 (값은 남기지 않고 바뀐 칸 이름만)
create trigger audit_row_change after insert or update or delete on public.daily_steps
  for each row execute function public.audit_row_change();
