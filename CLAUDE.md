# 오늘건강 — Claude Code 작업 규칙

## 프로젝트 요약
50~80대를 위한 복약 확인·혈압/혈당 기록 앱.
Expo SDK 58 + React Native + TypeScript + Expo Router, (2단계부터) Supabase.
- 상세 계획: docs/MASTER_PLAN.md · 기능: docs/FEATURES.md · 단계: docs/ROADMAP.md
- Expo 일반 지침: AGENTS.md (Expo 템플릿 기본 제공 — Expo API는 버전별 공식 문서를 확인)

**현재 단계: 3단계 코드 완료 → ⏸ 사용자 작업 대기** (Supabase 연결·실기기·가족 공유 확인, docs/PHASE3_REPORT.md 7장). 확인 결과를 받으면 수정 후 4단계로 진행.

### 단계 진행 방식 (사용자 지시, 2026-11-04)
- 2단계부터는 한 단계가 끝나고 검수 기준을 통과하면 **자동으로 다음 단계로 넘어간다.**
- **사용자가 직접 해야 할 일**(계정 생성·키 입력·실제 기기 확인·외부 서비스 가입·유료 결제·법률 검토 등)이 생기면 **그 자리에서 멈추고** 할 일을 정리해 보고한다.
- 각 단계가 끝날 때마다 `docs/PHASEn_REPORT.md`로 결과를 남긴다.
- 유료 서비스·배포·스토어 제출은 자동 진행 대상이 아니다 (항상 승인 필요).

### Supabase 설정 진행 상황 (2026-11-05) — 자세한 표: docs/SUPABASE_SETUP.md 맨 위
- 개발용 프로젝트 ref `ufwqvfodqypbzrmdzdsq` (⚠ 지역 ap-south-1 뭄바이 → 실제 데이터 전 서울로 새 프로젝트, 4단계)
- (삭제됨) 토큰은 **네트워크 시크릿**(Bearer, `api.supabase.com`, `/v1/`)으로 주입됨. 환경변수 없음. 토큰 값을 출력·저장하지 않는다.
  권한: 프로젝트 설정 읽기, 자문가 읽기, API 키 읽기(비밀 없음), 인증 구성 읽기/쓰기, DB 읽기, 엣지 함수 읽기/쓰기. 만료 2026-11-05.
  - 인증 메일 설정(`PATCH /config/auth`)은 `project_admin_write`가 필요해 토큰으로 불가 → 사용자가 대시보드에서 설정
- 완료: DB 적용 확인(표 14·RLS 14), 보안 자문가 확인, `delete-account` 배포(401 확인), 공개용 키 확인
- 2026-11-04: 로그인 메일 설정 완료. SMTP(Gmail 앱 비밀번호, 개발용) 연결 후 PATCH 200, GET으로 OTP 6자리·600초·두 템플릿 `{{ .Token }}` 확인.
  ✅ 토큰 삭제 확인(2026-11-04, API 401). 이후 Supabase API 작업이 필요하면 사용자에게 새 토큰을 요청. 4단계(서울 새 프로젝트)에서는 Gmail 대신 도메인 연결된 발송 서비스로 교체.
- ✅ `20261105000002_lock_trigger_functions.sql` 사용자 실행 완료(2026-11-04).
- ✅ 휴대폰 연결(2026-11-04): Windows PC + 아이폰 Expo Go, 숫자코드 로그인·혈당 저장 확인. Windows 문제·해결은 SUPABASE_SETUP.md 6장.
- 만보기(2026-11-04 승인): `expo-sensors` 설치, `daily_steps` 표(마이그레이션 20261106000001, DB 시험 40_daily_steps). 아이폰만 지원(최근 7일 읽어 저장), 안드로이드는 정식 빌드 후 헬스 커넥트. ⏸ 사용자가 SQL 실행 필요.
- 로그인 방식 결정(2026-11-04): 지금은 이메일 숫자코드 유지, 4단계에서 카카오 로그인 추가(ROADMAP 4단계 8번). 휴대폰 문자 로그인은 유료라 보류.
- 남음(사용자): 6장 나머지(재실행 후 기록 유지·알림·계정 삭제·오프라인) + 가족 공유(계정 2개)

## 작업 규칙
1. 작업 전에 관련 파일을 먼저 읽고 확인한다.
2. 기존 코드와 공통 부품(src/components/ui, src/theme)을 재사용한다.
3. 전체 재작성보다 부분 수정을 우선한다. 정상 동작하는 코드를 이유 없이 다시 쓰지 않는다.
4. 새 패키지는 설치 전에 이유·대안·기존 기능으로 가능한지 보고하고 승인받는다. 같은 기능 라이브러리 중복 금지. 설치는 `npx expo install` 사용.
5. 보안 관련 수정(인증, RLS, DB 함수, 동의, 가족 공유, 삭제)은 별도로 표시하고 따로 검토받는다.
6. 한 번에 하나의 개발 단계만 수행한다.
7. 작업 후 변경한 파일 목록, 변경 영향, 테스트 방법과 결과를 보고한다.
8. 정상 동작 확인 후에만 다음 단계로 넘어간다.
9. 승인 없이 배포, 스토어 제출, 유료 서비스 신청·연결을 하지 않는다.

## 절대 만들지 않는 기능
질병 진단, 약물 변경 지시, AI 처방, 응급 위험도 자동 판정, 건강 수치에 따른 자동 119 신고,
건강 수치에 대한 "정상/높음/위험" 판정 문구·색 표시.

## 화면 규칙
- 글씨는 반드시 `AppText` 사용 (본문 19pt, 보조 17pt 이상, 중요 숫자 34pt). 화면 파일에 글씨 크기·색 코드 직접 쓰지 않기 → `src/theme`
- 버튼은 `AppButton` (높이 56dp, 글자 필수, 아이콘만 있는 버튼 금지)
- 화면당 핵심 행동 1~3개, 애니메이션 금지, 다크 모드 없음(1차)
- 상태는 색 + 아이콘 + 글자 (`StatusMark`, `ChoiceButtons`)
- 모든 누를 수 있는 요소에 한국어 accessibilityLabel
- 예시 데이터는 `SampleBadge`로 '예시' 표시
- 지우기·철회·119는 반드시 `confirmAsync` 확인창을 거친다
- 쉬운 말: 수축기→위 숫자, 이완기→아래 숫자, 공복→아침 식사 전

## 데이터·보안 규칙
- 화면은 `useAppState()`(읽기)와 `useRepository()`(쓰기)만 사용. 데이터 출처 교체는 `src/data`에서만.
- 실제 건강정보를 개발·테스트에 사용하지 않는다(가상 데이터만).
- 로그(console 포함)에 건강 수치·이름·전화번호를 남기지 않는다.
- 비밀키(service_role 등)는 앱 코드·Git에 절대 넣지 않는다. `.env*`는 Git 제외.
- 가족 공유 권한은 반드시 서버(DB 함수)에서 검사한다 (3단계).

## 폴더
```
src/app/            화면 (Expo Router: 파일 = 화면 주소)
  (tabs)/           하단 탭 4개: index(오늘) records meds family
  record/ meds/ appointments/ family/   입력·상세 화면
  settings.tsx
src/components/ui/  공통 부품
src/features/       기능별 양식·부품 (records, meds, appointments, today)
src/data/           repository.ts(약속) · store.tsx(모드 선택) · reducer.ts · memoryRepository.ts(체험)
                    supabase/(서버 저장) · auth.tsx(로그인·동의) · config.ts · sampleData.ts · selectors.ts
src/notifications/  알림 계획(plan.ts)·예약(scheduler.ts)
src/steps/          만보기: 휴대폰 걸음 읽기(pedometer.ts)·저장(StepSync)·일/주/월 묶기(stats.ts)
supabase/           migrations(실제 적용) · functions(서버 함수) · tests(시험 전용, 실제 적용 금지)
src/theme/          색·글씨·간격·아이콘
src/types/          domain.ts (DB 설계와 같은 이름)
src/utils/          날짜·검증·통계·이름표·확인창·전화
```

## 명령어
```bash
npm install               # 패키지 설치 (package-lock 그대로)
npx expo start            # 개발 서버 → 휴대폰 Expo Go로 QR 스캔
npx expo start --web      # 웹 미리보기 (확인용)
npm run typecheck         # 타입 검사 (오류 0개 유지)
npx expo-doctor           # Expo 설정 진단
npm test                  # 단위 테스트
npm run test:db           # DB 보안 시험 (로컬 PostgreSQL 필요)
```
- `.env`에 `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`가 있으면 서버 모드, 없으면 체험 모드.
- DB를 바꾸면 새 마이그레이션 파일을 추가하고(기존 파일 수정 금지), `supabase/tests`에 시험을 추가한 뒤 `bash scripts/build-setup-sql.sh`로 `supabase/setup/all_in_one.sql`(붙여넣기용)을 다시 만든다.
`npx expo lint`는 처음 실행 시 ESLint 설정 패키지를 설치하므로, 도입 전에 승인을 받는다.
