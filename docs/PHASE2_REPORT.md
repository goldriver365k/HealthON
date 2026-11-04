# 2단계 보고 — 계정·기록 저장·복약 알림

- 작성일: 2026-11-04
- 상태: **코드 완료 · 이 환경에서 가능한 시험 모두 통과 · ⏸ 사용자 작업 대기**
  - 실제 Supabase 연결과 휴대폰 알림 확인은 사용자가 계정을 만들어야 해서 여기서 멈췄습니다 → [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

## 1. 한 일 요약
1. **DB 설계 적용 SQL** (표 11개, 행 단위 보안(RLS), 감사기록) 작성 → 이 환경의 PostgreSQL에서 Supabase 인증 구조를 흉내 내어 **보안 시험 42개 통과**
2. **로그인**: 이메일 6자리 숫자코드 (비밀번호 없음, 처음이면 자동 가입). 카카오 로그인은 카카오 개발자 등록 후 추가 예정
3. **동의 화면**: 이용약관 / 개인정보 / **건강정보 별도 동의** / 만 14세 — 모두 동의해야 앱 사용. 서버에 버전과 함께 기록
4. **서버 저장**: 화면 코드는 그대로 두고 데이터 층만 교체. 서버 설정이 없으면 지금처럼 **체험 모드**로 동작
5. **로그인 정보 암호화 보관**: Supabase 공식 방식(암호화 키는 휴대폰 보안 저장소, 암호화된 세션은 일반 저장소). 공식 예시의 외부 패키지 2개 대신 Expo 내장 `expo-crypto`(AES-GCM) 사용
6. **복약·병원 알림**: 휴대폰 안 알림(서버·비용 없음). 같은 시각 약은 하나로 묶음, **잠금화면에 약 이름 기본 숨김**, 권한 요청 전 안내 화면
7. **설정**: 알림 켜기/끄기, 약 이름 표시 여부, 동의 내역, 건강정보 동의 철회, 로그아웃, **계정 삭제**(확인 2번 → 모든 기록 삭제)
8. **오류 처리**: 저장 실패 시 한국어 안내, 입력 내용 유지, 버튼 중복 실행 방지
9. **단위 테스트 45개** 도입 (jest-expo)

## 2. 🔒 보안 관련 변경 (별도 검토 대상)

| 항목 | 내용 | 파일 |
|---|---|---|
| 행 단위 보안 | 모든 표 RLS 켬. 본인 행만 조회·수정·삭제. 로그인 안 한 사용자는 표 접근 권한 자체를 회수 | `supabase/migrations/..._rls.sql` |
| 동의 없으면 저장 불가 | 건강정보 표 6개는 '건강정보 동의'가 유효해야 새로 저장 가능 (서버에서 검사) | 같은 파일 `has_health_consent()` |
| 남의 데이터에 끼워넣기 방지 | 일정·복약확인·질문 메모는 "부모 기록의 주인 = 내 것"을 DB 외래키로 강제 | `..._core_schema.sql` |
| 감사기록 | 생성·수정·삭제·동의·철회를 자동 기록. 수정은 **바뀐 칸 이름만** (수치 없음). 사용자는 읽기만, 쓰기·수정·삭제 불가. 계정 삭제 후에도 보관 | `..._audit.sql` |
| 동의 기록 | 지울 수 없음, 철회는 `withdrawn_at` 기록 (증빙) | `..._rls.sql` `withdraw_consent()` |
| 계정 삭제 | 서버 함수가 로그인 토큰으로 본인 확인 후 **본인만** 삭제. 관리자 키는 Supabase 서버 안에만 존재 | `supabase/functions/delete-account/index.ts` |
| 세션 보관 | AES-GCM 암호화, 키는 Keychain/Keystore | `src/data/supabase/secureStorage.ts` |
| 화면 접근 | 로그인 → 동의 → 앱 순서. 조건이 안 맞으면 화면 자체가 열리지 않음 | `src/app/_layout.tsx` |
| 비밀키 | 앱·Git에 관리자 키 없음(검색 확인). `.env*` 전체 Git 제외(`.env.example`만 예외) | `.gitignore` |
| 로그 | 오류 코드만 남김, 건강 수치·이름 없음 | `src/data/supabase/repository.ts` |

## 3. 패키지 (계획서 E-2에 있던 것만)

| 패키지 | 용도 | 비고 |
|---|---|---|
| `@supabase/supabase-js` | 서버 연결 | |
| `@react-native-async-storage/async-storage` | 암호화된 세션 보관 | Supabase 공식 방식 |
| `expo-secure-store` | 암호화 키 보관 (Keychain/Keystore) | |
| `expo-crypto` | AES 암호화 | 공식 예시의 `aes-js` + `react-native-get-random-values` 2개를 대신함 |
| `expo-notifications` | 휴대폰 안 알림 | 원격 푸시는 쓰지 않음 |
| `jest-expo`, `jest`, `@types/jest` (개발용) | 단위 테스트 | 앱 크기에 영향 없음 |

- ESLint는 아직 도입하지 않음 (승인 대기 항목으로 유지)
- 1단계 보고서의 "쓰지 않는 템플릿 패키지 5개 정리"는 답을 받지 못해 그대로 두었습니다

## 4. 새로 만들거나 바꾼 파일

**새 파일**
- DB: `supabase/migrations/` 3개, `supabase/functions/delete-account/index.ts`
- DB 시험: `supabase/tests/00_local_supabase_stub.sql`(시험 전용), `supabase/tests/10_rls_phase2.sql`, `scripts/test-db.sh`
- 데이터: `src/data/config.ts`, `auth.tsx`, `reducer.ts`, `memoryRepository.ts`, `src/data/supabase/{client,secureStorage,mappers,repository}.ts`
- 화면: `src/app/login.tsx`, `consent.tsx`, `notifications-intro.tsx`
- 알림: `src/notifications/{plan.ts,scheduler.ts,NotificationSync.tsx}`
- 공통: `src/hooks/useSafeAction.ts`, `src/components/ui/LoadingView.tsx`
- 테스트: `src/utils/__tests__/utils.test.ts`, `src/data/__tests__/data.test.ts`, `src/notifications/__tests__/plan.test.ts`
- 문서: `docs/SUPABASE_SETUP.md`, 이 보고서, `.env.example`

**바뀐 파일 (부분 수정)**
- `src/data/store.tsx`: 상태 변경 규칙을 `reducer.ts`로, 체험 저장소를 `memoryRepository.ts`로 옮기고 모드 선택만 남김 (1단계 동작 동일 — 웹 시험 14개 재통과)
- `src/data/repository.ts`, `sampleData.ts`, `src/types/domain.ts`: 알림 설정·동의 타입 추가
- `src/app/_layout.tsx`: 로그인·동의 단계별 화면 잠금
- `src/app/settings.tsx`: 알림·계정 카드 추가
- 저장/삭제를 부르는 화면 9개: `useSafeAction`으로 감싸 실패 시 안내 (동작 흐름은 같음)
- `src/app/(tabs)/index.tsx`: 체험판 안내는 체험 모드에서만
- 약·병원 입력 양식: "2단계에서 켜져요" 안내 → 실제 알림 안내로 교체
- `src/components/ui/Flash.tsx`: 되돌리기 실패 시 안내
- `package.json`(test, test:db 명령, jest 설정), `tsconfig.json`(서버 함수 폴더 제외), `.gitignore`, `CLAUDE.md`

## 5. 검수 결과 (ROADMAP I-2)

| 항목 | 결과 | 확인 방법 |
|---|---|---|
| A 계정으로 B 계정 기록 조회·수정·삭제 → 모두 실패 | ✅ | DB 시험 (`npm run test:db`) |
| 동의하지 않으면 건강기록 저장 불가 | ✅ | DB 시험 + 화면 잠금 |
| 생성·수정·삭제 → 감사기록, 사용자는 감사기록 수정·삭제 불가 | ✅ | DB 시험 |
| 감사기록에 건강 수치가 남지 않음 | ✅ | DB 시험 |
| 계정 삭제 시 모든 기록 삭제 (감사기록은 보관) | ✅ | DB 시험 (서버 함수 자체는 실제 Supabase에서 확인 필요) |
| 앱 코드·Git에 관리자 키 없음 | ✅ | 검색 |
| 인터넷 끊김 → 한국어 안내, 앱 멈추지 않음 | ✅ | 웹 시험 (가짜 서버 주소) |
| 로그인 전에는 어떤 주소로도 앱 화면 접근 불가 | ✅ | 웹 시험 3개 주소 |
| 단위 테스트 | ✅ 45개 통과 | `npm test` |
| 체험 모드 기존 기능 | ✅ 14개 재통과 | 웹 시험 |
| 타입 검사 / Expo 진단 | ✅ 0개 / 20/20 | |
| **실제 Supabase 로그인·저장·재실행 후 유지** | ⏸ 사용자 작업 필요 | SUPABASE_SETUP.md 6장 |
| **정해진 시각 알림 도착 (아이폰·안드로이드)** | ⏸ 실제 기기 필요 | 알림 계획 로직은 단위 테스트 8개 통과 |
| **동의 화면 실제 모습** | ⏸ | 로그인 후에만 보여서 웹 시험으로 확인 못함 |

### DB 보안 시험 42개 (요약)
가입 시 프로필 자동 생성 · 동의 전 저장 불가 · 불가능한 숫자/아래>위 숫자/시점 없는 혈당 저장 불가 · 남의 이름으로 저장 불가 ·
B가 A의 건강기록/약/복약/병원/질문/연락처/동의/프로필 조회 불가 · 수정·삭제 0건 · 남의 약에 일정 붙이기/남의 일정에 복약 표시/남의 병원 일정에 질문 추가 불가 ·
감사기록 쓰기·수정·삭제 불가 · 수정 기록엔 칸 이름만 · 수치 미기록 · 동의 철회 후 저장 불가 · 철회해도 동의 증빙 유지 ·
로그인 안 하면 표 접근 불가 · 계정 삭제 시 건강기록/복약/질문/동의/프로필 삭제 · 감사기록 보관

## 6. 알아 둘 점·제한
1. **알림 시각**: 안드로이드에서 '정확한 알람' 권한을 쓰지 않아 기기에 따라 몇 분 늦을 수 있습니다 (구글 플레이 정책상 이 권한은 알람 앱용). 실제 사용자 테스트에서 문제가 되면 다시 검토합니다.
2. **메일 발송 한도 [추정]**: Supabase 기본 메일은 팀원에게만, 적은 수만 보낼 수 있다고 알려져 있습니다. 실제 사용자 대상에는 4단계에서 메일 발송 서비스 연결이 필요합니다(외부 서비스 → 그때 승인).
3. **처음 불러오는 기록 기간**: 최근 90일 (통계는 30일까지라 충분. 그 이전 기록은 서버에 그대로 있음)
4. **가족 공유**: 서버 모드에서는 아직 비어 있습니다 (3단계에서 서버 함수로 구현)
5. **동의 문구는 초안**입니다 → 4단계 전문가 검토 필수
6. 세션 암호화 저장소는 휴대폰 기능이라 단위 테스트로 확인하지 못했습니다 → 실제 기기에서 "앱 종료 후 다시 열어도 로그인 유지"로 확인

## 7. ⏸ 사용자가 해야 할 일 (이것 때문에 멈췄습니다)
1. **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md) 1~5장**: 무료 Supabase 프로젝트 만들기(서울), SQL 3개 붙여넣기, 메일 문구 바꾸기, 계정 삭제 함수 배포, `.env` 작성 — 약 20~30분
2. **같은 문서 6장**: 휴대폰으로 로그인·저장·알림·계정 삭제 확인 후 결과 알려 주기
3. **GitHub 저장소 연결** (아직 커밋하지 않았습니다. 이 작업 공간은 임시라 파일이 사라질 수 있어 가장 급합니다)
4. (선택) 카카오 로그인을 원하시면 카카오 개발자 앱 등록 — 3단계 이후로 미뤄도 됩니다

위 1·2번 결과를 받으면 문제를 고친 뒤 **자동으로 3단계(가족 공유·건강 통계)**로 넘어갑니다.
