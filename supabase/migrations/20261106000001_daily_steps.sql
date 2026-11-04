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
