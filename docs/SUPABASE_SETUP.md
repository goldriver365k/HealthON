# Supabase 연결 안내 (사용자가 직접 할 일)

이 작업은 **계정 생성과 키 관리**가 필요해서 사용자가 직접 해야 합니다. 약 20~30분 걸립니다.
모두 **무료 등급**이며, 결제 정보를 넣을 필요가 없습니다.
⚠ 이 단계에서는 **가상 데이터만** 사용하세요. 실제 건강정보는 4단계(전문가 검토, Pro 요금제 백업) 이후에 사용합니다.

> ## 진행 상황 (2026-11-05, 개발용 프로젝트 `ufwqvfodqypbzrmdzdsq`)
> | 단계 | 상태 | 방법 |
> |---|---|---|
> | 1. 프로젝트 만들기 | ✅ (⚠ 지역이 **인도 뭄바이 ap-south-1** — 아래 '지역' 참고) | 사용자 |
> | 2. DB 설계 적용 | ✅ 표 14개, 모두 RLS 켜짐, 서버 함수·가입 트리거 확인 | 사용자 실행 → Claude 확인 |
> | 2-1. 보안 점검 반영 (`20261105000002_lock_trigger_functions.sql`) | ✅ 2026-11-04 사용자 실행 (Success, 파일과 같은 4줄) | SQL Editor |
> | 2-2. 만보기 표 (`20261106000001_daily_steps.sql`) | ⏸ 사용자 실행 필요 — 파일 내용 전체를 SQL Editor에 붙여넣고 Run | SQL Editor |
> | 3. 로그인 메일 숫자코드 | ✅ SMTP(Gmail, 개발용) 연결 → 숫자 6자리·10분·메일 제목/문구(`{{ .Token }}`) 적용 확인 (시간당 30통) | 사용자(SMTP) → Claude(API) |
> | 4. 계정 삭제 함수 | ✅ 배포 완료, 로그인 없이 호출 시 401 거부 확인 | Claude (API) |
> | 5. 앱 연결 | ✅ 2026-11-04 Windows PC + 아이폰 Expo Go 연결, 숫자코드 로그인·혈당 저장 확인 (⏸ 6장 나머지 확인 중) | 사용자 |
>
> **지역**: 개발 중(가상 데이터)에는 지금 프로젝트를 그대로 써도 됩니다. 단, **실제 건강정보를 넣기 전(4단계)** 에는
> 서울(ap-northeast-2) 지역으로 새 프로젝트를 만들어 옮깁니다 — 지역은 나중에 바꿀 수 없고, 국외 저장은 개인정보 국외이전 고지 대상이 될 수 있습니다 [전문가 검토].
>
> **보안 점검 경고 중 의도한 것**: 가족 공유·동의 철회 서버 함수 8개를 로그인 사용자가 실행할 수 있다는 경고는 설계대로입니다
> (함수 안에서 본인·권한을 검사, DB 시험으로 확인). `family_invite_attempts` 정책 없음(INFO)도 의도한 것(사용자 접근 차단).

---

## 1. 프로젝트 만들기
1. https://supabase.com 에서 가입 (GitHub 계정으로 가입 가능)
2. **New project**
   - Name: `oneul-geongang-dev` (개발용임을 이름에 표시)
   - Database Password: 긴 비밀번호를 만들고 **비밀번호 관리 앱에 보관** (앱 코드나 채팅에 붙여넣지 마세요)
   - **Region: Northeast Asia (Seoul)** ← 꼭 서울 선택
   - Plan: Free
3. 만들어지는 데 1~2분 걸립니다.

## 2. DB 설계 적용 (테이블·보안 규칙·감사기록·가족 공유)
⚠ SQL Editor에는 파일 **경로가 아니라 파일 안의 내용**을 붙여넣어야 합니다.
(경로를 붙여넣으면 `syntax error at or near "supabase"` 오류가 납니다. 이 오류가 났다면 아무것도 적용되지 않은 것이니 그냥 다시 하시면 됩니다.)

**가장 쉬운 방법 — 파일 하나를 한 번에**
1. 컴퓨터 브라우저에서 아래 주소를 엽니다
   https://github.com/goldriver365k/HealthON/blob/main/supabase/setup/all_in_one.sql
2. 코드 오른쪽 위의 **복사 버튼(Copy raw file, 네모 두 개 모양)**을 누릅니다
3. Supabase 대시보드 왼쪽 **SQL Editor** → 새 쿼리(**+ New query**) → 빈 칸에 **붙여넣기**(Ctrl+V)
4. 오른쪽 아래 **Run** 한 번 → 아래쪽에 `Success. No rows returned`가 나오면 완료
   - "이 쿼리는 위험할 수 있다"(destructive operation) 같은 확인창이 뜨면, 표 권한을 정리하는 문장 때문이므로 **실행(Run this query)**을 누르면 됩니다 [추정: 문구는 대시보드 버전에 따라 다를 수 있음]
5. ⚠ **한 번만** 실행하세요. 두 번 실행하면 "already exists(이미 있음)" 오류가 납니다 — 그 경우 이미 적용된 것이니 다음 단계로 넘어가면 됩니다.

(같은 내용을 4개 파일로 나눠 둔 것이 `supabase/migrations/` 폴더입니다. 나중에 DB를 바꿀 때 쓰는 원본이고, 지금은 위의 합친 파일만 쓰면 됩니다.)

> ⚠ `supabase/tests/` 폴더의 파일은 **시험 전용**입니다. 실제 Supabase에 넣지 마세요.

적용 확인: 대시보드 **Table Editor**에서 표 14개가 보이고, 각 표에 "RLS enabled"가 표시되면 정상입니다.
**Advisors > Security Advisor**에서 경고가 있으면 알려 주세요.

## 3. 이메일 숫자코드 로그인 설정
1. **Authentication > Sign In / Providers > Email**: Email 켜짐 확인
2. **Authentication > Email Templates > Magic Link** 의 본문을 아래처럼 바꿉니다 (링크 대신 숫자코드를 보내도록)
   ```html
   <h2>오늘건강 로그인 숫자코드</h2>
   <p>아래 숫자 6자리를 앱에 넣어 주세요.</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
   <p>본인이 요청하지 않았다면 이 메일을 무시하세요.</p>
   ```
   Subject: `[오늘건강] 로그인 숫자코드`
3. 숫자코드 자릿수가 **6자리**인지 확인 (Authentication 설정의 Email OTP length) [추정: 메뉴 위치는 대시보드 개편에 따라 다를 수 있음]

> **알아둘 점 [추정·확인 필요]:** Supabase 기본 메일 발송은 **프로젝트 팀원 이메일로만, 시간당 몇 통**만 보낼 수 있다고 알려져 있습니다.
> 개발 중에는 본인 이메일로 시험하면 충분합니다. 실제 사용자에게 보내려면 4단계에서 메일 발송 서비스(SMTP) 연결이 필요하고,
> 무료 등급이 있는 서비스도 있지만 **외부 서비스이므로 그때 따로 승인**을 받겠습니다.

## 4. 계정 삭제 기능 배포 (Edge Function)
대시보드 **Edge Functions > Deploy a new function > Via Editor**
- 이름: `delete-account`
- 내용: `supabase/functions/delete-account/index.ts` 전체를 붙여넣고 Deploy
- 관리자 키는 Supabase가 서버 안에서 자동으로 넣어 줍니다. **따로 입력하거나 앱에 넣지 마세요.**

(또는 Supabase CLI가 있다면: `npx supabase functions deploy delete-account`)

## 5. 앱에 연결 (사용자 컴퓨터에서)

### 5-1. 처음 한 번만: 준비물 설치
- **Node.js LTS** (https://nodejs.org → LTS 버튼으로 내려받아 설치)
- **Git** (https://git-scm.com → 내려받아 설치, 설치 중 선택지는 기본값 그대로)
- 휴대폰에 **Expo Go** 앱 (앱스토어/플레이스토어에서 "Expo Go" 검색, 무료)

### 5-2. 처음 한 번만: 프로젝트 내려받기
컴퓨터의 터미널(윈도우: "명령 프롬프트" 또는 "PowerShell", 맥: "터미널")을 열고 한 줄씩 입력합니다.
```bash
git clone https://github.com/goldriver365k/HealthON.git
```
```bash
cd HealthON
```
```bash
npm install
```
(2~5분 걸립니다)

### 5-3. 서버 주소·공개 키 넣기
1. Supabase 대시보드 **Project Settings > API** (또는 Data API) 에서
   - **Project URL**
   - **anon / publishable** 키 (공개용)
   를 확인합니다. ⚠ `service_role` / `secret` 키는 **절대 복사하지 마세요.**
2. `HealthON` 폴더 안의 `.env.example` 파일을 복사해서 이름을 `.env`로 바꾸고, 메모장 등으로 열어 두 값을 채운 뒤 저장합니다.
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=공개용키
   ```
   `.env`는 GitHub에 올라가지 않도록 설정되어 있습니다.
   - 윈도우에서 파일 이름 앞의 점(.)이 안 보이면: 탐색기 > 보기 > "파일 확장명"과 "숨긴 항목"을 켜 주세요.

### 5-4. 실행
```bash
npx expo start --clear
```
- 화면에 QR 코드가 나오면 휴대폰으로 찍습니다 (아이폰: 기본 카메라 / 안드로이드: Expo Go 앱의 "Scan QR code")
- 컴퓨터와 휴대폰이 **같은 와이파이**에 있어야 합니다
- 첫 화면이 **로그인 화면**이면 서버에 연결된 것입니다. (예시 데이터가 보이면 `.env`가 읽히지 않은 것 → 파일 이름·위치 확인 후 다시 실행)
- 다음부터는 `HealthON` 폴더에서 `npx expo start`만 하면 됩니다. 새 버전을 받으려면 `git pull` 후 `npm install`

## 6. 확인할 것 (휴대폰, Expo Go)
> **Windows에서 겪은 문제와 해결 (2026-11-04)**
> - `npm` 실행 막힘(PSSecurityException) → `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
> - 프로젝트를 OneDrive 폴더에 두지 않기 → `C:\Users\<이름>\HealthON`
> - `.env`의 URL은 `https://<ref>.supabase.co`까지만 (`/rest/v1/` 붙이지 않기)
> - iOS Expo Go "signed in to Expo CLI" 오류 → `npx expo login` 실패 시 expo.dev 접근 토큰을 `$env:EXPO_TOKEN="…"`(따옴표 필수, 창마다 다시)
> - 밖에서 열기: `npx expo start --tunnel` + PC 절전 '안 함' (PC가 켜져 있어야 함)

- [x] 이메일 입력 → 메일로 숫자 6자리 도착 → 입력 → 동의 화면 (2026-11-04 확인)
- [ ] 동의 4개 체크 → [동의하고 시작하기] → 알림 안내 화면 → 오늘 화면 (빈 화면)
- [ ] 약 1개 등록(약 시간은 30분 단위로만 바뀌므로 **가장 가까운 다음 30분 시각**으로, 예: 지금 22:10 → 22:30) → **알림이 오는지** → 알림 누르면 오늘 화면
- [ ] 혈압 기록 → 앱 완전히 종료 후 다시 열기 → 기록이 남아 있는지
- [ ] 대시보드 Table Editor에서 `audit_logs`에 기록이 쌓이는지 (수치 없이 표 이름·칸 이름만)
- [ ] 설정 > 계정 삭제 → 다시 로그인하면 빈 계정인지
- [ ] 인터넷 끄고 저장 → "인터넷 연결을 확인한 뒤 다시 해 주세요" 안내

### 가족 공유 확인 (3단계) — 이메일 계정 2개 필요
- [ ] 계정 A: 가족 안심 > 가족 초대하기 → 호칭·항목(예: 혈압, 약 여부) 고르고 동의 → 6자리 코드
- [ ] 계정 B(다른 휴대폰 또는 로그아웃 후): 초대 코드 입력하기 → 연결됨 → A가 고른 항목만 보이는지
- [ ] A가 공유 항목을 바꾸면 B 화면에 바로 반영되는지 (B가 화면을 다시 열 때)
- [ ] A가 ‘공유 그만두기’ → B에서 바로 안 보이는지
- [ ] A의 가족 상세 화면에 ‘가족이 본 기록(최근 7일 N번)’이 보이는지
- [ ] 틀린 코드를 5번 넣으면 1시간 동안 막히는지

결과(특히 안 되는 것)를 알려 주시면 이어서 고치겠습니다.
