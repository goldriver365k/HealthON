-- ============================================================================
-- ⚠ 시험 전용. 실제 Supabase에 절대 적용하지 않는다.
-- 일반 PostgreSQL에서 Supabase의 인증 구조(auth.users, auth.uid(), 역할)를 흉내 내
-- supabase/migrations 의 보안 규칙(RLS)을 시험하기 위한 준비물.
-- ============================================================================
-- 역할은 PostgreSQL 전체 공용이라 이미 있으면 건너뜀
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema auth;
-- Supabase는 pgcrypto 등 확장 기능을 extensions 스키마에 둔다
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create table auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

-- Supabase와 같은 방식: 요청의 JWT 'sub' 값을 현재 사용자로 본다
create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Supabase 기본값처럼 public 표 권한을 미리 열어 둔다 (그래도 RLS가 막아야 함)
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
