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
