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
