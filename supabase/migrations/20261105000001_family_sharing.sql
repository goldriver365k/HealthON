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
