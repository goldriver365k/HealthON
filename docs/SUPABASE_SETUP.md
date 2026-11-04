# Supabase 연결 안내 (사용자가 직접 할 일)

이 작업은 **계정 생성과 키 관리**가 필요해서 사용자가 직접 해야 합니다. 약 20~30분 걸립니다.
모두 **무료 등급**이며, 결제 정보를 넣을 필요가 없습니다.
⚠ 이 단계에서는 **가상 데이터만** 사용하세요. 실제 건강정보는 4단계(전문가 검토, Pro 요금제 백업) 이후에 사용합니다.

---

## 1. 프로젝트 만들기
1. https://supabase.com 에서 가입 (GitHub 계정으로 가입 가능)
2. **New project**
   - Name: `oneul-geongang-dev` (개발용임을 이름에 표시)
   - Database Password: 긴 비밀번호를 만들고 **비밀번호 관리 앱에 보관** (앱 코드나 채팅에 붙여넣지 마세요)
   - **Region: Northeast Asia (Seoul)** ← 꼭 서울 선택
   - Plan: Free
3. 만들어지는 데 1~2분 걸립니다.

## 2. DB 설계 적용 (테이블·보안 규칙·감사기록)
가장 쉬운 방법: 대시보드의 **SQL Editor**에 아래 파일 4개의 내용을 **순서대로** 하나씩 붙여넣고 [Run]
1. `supabase/migrations/20261104000001_core_schema.sql`
2. `supabase/migrations/20261104000002_rls.sql`
3. `supabase/migrations/20261104000003_audit.sql`
4. `supabase/migrations/20261105000001_family_sharing.sql` (3단계: 가족 공유)

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

## 5. 앱에 연결
1. 대시보드 **Project Settings > API** (또는 Data API) 에서
   - Project URL
   - **anon / publishable** 키 (공개용)
   를 확인합니다. ⚠ `service_role` / `secret` 키는 **절대 복사하지 마세요.**
2. 프로젝트 폴더의 `.env.example`을 복사해 `.env`로 저장하고 두 값을 채웁니다.
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=공개용키
   ```
   `.env`는 Git에 올라가지 않도록 이미 설정되어 있습니다.
3. 앱 실행
   ```bash
   npx expo start --clear
   ```
   → 로그인 화면이 나오면 연결된 것입니다. (값이 비어 있으면 지금처럼 '체험 모드')

## 6. 확인할 것 (휴대폰, Expo Go)
- [ ] 이메일 입력 → 메일로 숫자 6자리 도착 → 입력 → 동의 화면
- [ ] 동의 4개 체크 → [동의하고 시작하기] → 알림 안내 화면 → 오늘 화면 (빈 화면)
- [ ] 약 1개 등록(시간을 2~3분 뒤로) → **알림이 오는지** → 알림 누르면 오늘 화면
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
