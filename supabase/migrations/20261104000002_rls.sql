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
