#!/usr/bin/env bash
# 로컬 PostgreSQL에서 DB 설계·보안 규칙(RLS)을 시험한다.
# 실제 Supabase에는 아무것도 하지 않는다. 시험용 DB를 새로 만들고 끝나면 지운다.
#
# 준비: PostgreSQL 15 이상이 설치·실행 중이어야 함
#   (예: Ubuntu → sudo pg_ctlcluster 16 main start)
# 실행: bash scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."

DB="oneul_test_$$"
if [ "$(id -u)" = "0" ]; then PSQL=(su postgres -c); else PSQL=(bash -c); fi
run() { "${PSQL[@]}" "$1"; }

cleanup() { run "dropdb --if-exists $DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT

run "createdb $DB"
files=(supabase/tests/00_local_supabase_stub.sql supabase/migrations/*.sql supabase/tests/[1-9]*.sql)
for f in "${files[@]}"; do
  echo "▶ $f"
  run "psql -X -q -v ON_ERROR_STOP=1 -d $DB -f '$PWD/$f'"
done
echo "✅ DB 시험 완료"
