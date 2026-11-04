#!/usr/bin/env bash
# supabase/migrations/*.sql 을 순서대로 합쳐 supabase/setup/all_in_one.sql 을 만든다.
# Supabase 대시보드 SQL Editor에 한 번에 붙여넣기 위한 파일 (직접 고치지 말 것).
set -euo pipefail
cd "$(dirname "$0")/.."
out=supabase/setup/all_in_one.sql
{
  echo "-- ============================================================================"
  echo "-- 오늘건강 DB 설정 (한 번에 붙여넣기용) — 자동 생성 파일, 직접 고치지 마세요"
  echo "-- 만드는 방법: bash scripts/build-setup-sql.sh"
  echo "-- 사용법: 이 파일의 '내용 전체'를 Supabase > SQL Editor 에 붙여넣고 [Run] 한 번"
  echo "-- ⚠ 새 프로젝트에 한 번만 실행하세요. (두 번 실행하면 '이미 있음' 오류가 납니다)"
  echo "-- ============================================================================"
  for f in supabase/migrations/*.sql; do
    echo
    echo "-- ▶▶▶ $f"
    cat "$f"
  done
} > "$out"
echo "만들었음: $out ($(wc -l < "$out")줄)"
