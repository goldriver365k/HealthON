# 1단계 완료 보고 — 가상 데이터 기반 4개 화면

- 작성일: 2026-11-04
- 상태: **개발 완료 · 사용자 검수 대기** (실제 휴대폰 확인은 사용자가 직접 해야 함 — 아래 "남은 확인" 참고)

## 1. 한 일 요약
1. Expo SDK 58 공식 기본 템플릿으로 프로젝트를 만들고, 템플릿 예시 화면·그림을 정리했습니다. **추가로 설치한 패키지는 0개**입니다.
2. 공통 부품(글씨, 버튼, 입력창, 선택 버튼, 카드, 상태 표시, '예시' 표시, 확인창, 저장 안내줄)과 디자인 기준값(색·글씨·간격·아이콘)을 만들었습니다.
3. 하단 탭 4개(오늘 / 건강기록 / 약·병원 / 가족 안심)와 입력·상세 화면 11개를 만들었습니다.
4. 데이터 층을 따로 분리했습니다. 화면은 `useAppState`(읽기)와 `useRepository`(쓰기)만 부르므로, 2단계에서 화면을 다시 쓰지 않고 Supabase로 바꿀 수 있습니다.
5. 브라우저 자동 시험 14개를 통과했고, 타입 오류 0개, Expo 설정 진단(expo-doctor) 20/20을 통과했습니다.

## 2. 만든 파일

| 구분 | 파일 |
|---|---|
| 규칙 | `CLAUDE.md` (새로 만듦) |
| 화면 틀 | `src/app/_layout.tsx`, `src/app/(tabs)/_layout.tsx` |
| 탭 4개 | `src/app/(tabs)/index.tsx`(오늘), `records.tsx`, `meds.tsx`, `family.tsx` |
| 건강기록 | `src/app/record/new.tsx`(혈압·혈당·체중 공용), `src/app/record/[id].tsx`(고치기·지우기) |
| 약 | `src/app/meds/new.tsx`, `src/app/meds/[id].tsx` |
| 병원 | `src/app/appointments/new.tsx`, `src/app/appointments/[id].tsx`(물어볼 것 포함) |
| 가족 | `src/app/family/[linkId].tsx`, `invite.tsx`, `join.tsx`, `contacts.tsx` |
| 설정 | `src/app/settings.tsx` |
| 공통 부품 | `src/components/ui/` — AppText, AppButton, AppIcon, TextField, ChoiceButtons, Stepper, Card, ListRow, Notice/EmptyState, StatusMark, SampleBadge, Screen, Flash |
| 기능 부품 | `src/features/records/MeasurementForm.tsx`, `SimpleBars.tsx`, `src/features/meds/MedicationForm.tsx`, `src/features/appointments/AppointmentForm.tsx`, `src/features/today/DoseRow.tsx` |
| 데이터 | `src/data/repository.ts`(약속), `store.tsx`(메모리 구현), `sampleData.ts`, `selectors.ts` |
| 기준값 | `src/theme/` colors, typography, spacing, icons |
| 타입 | `src/types/domain.ts` (DB 설계안과 같은 이름) |
| 도구 | `src/utils/` date, validate, stats, labels, confirm, phone · `src/hooks/useNow.ts` |
| 설정 변경 | `package.json`(이름, `typecheck` 명령 추가, 템플릿 초기화 명령 삭제), `app.json`(앱 이름 '오늘건강', 밝은 화면 고정, 미색 배경), `.gitignore`(`.env*` 전체 제외) |
| 삭제 | 템플릿 예시 화면·부품·그림, `scripts/reset-project.js` |

## 3. 패키지
- **추가 0개.** 아래는 모두 Expo 템플릿에 원래 들어 있던 것입니다.
- 사용 중: expo-router(화면 이동·탭), expo-symbols(아이콘), react-native-safe-area-context(화면 가장자리 여백), expo-status-bar
- **정리 제안 (승인 필요):** 앱 코드에서 쓰지 않는 템플릿 패키지 `@expo/ui`, `expo-glass-effect`, `expo-image`, `expo-web-browser`, `expo-device`. 지우면 설치 크기가 줄어듭니다. 다른 패키지가 내부적으로 쓰는지 확인한 뒤 지워야 해서, 2단계를 시작할 때 같이 처리하기를 권합니다.

## 4. 계획과 달라진 점

| 계획 (ROADMAP J-4) | 실제 | 이유 |
|---|---|---|
| 화면 폴더 `app/` | `src/app/` | SDK 58 템플릿의 기본 위치 |
| 혈압·혈당·체중 입력 파일 3개 | `record/new.tsx` 하나 + 공용 양식 | 같은 코드를 세 번 쓰지 않으려고 |
| `@expo/vector-icons` 아이콘 | `expo-symbols` | SDK 58 템플릿에 vector-icons가 빠짐. 이미 들어 있는 것을 사용 |
| 템플릿의 기본 탭(NativeTabs) | JS 탭 (같은 expo-router 안에 있음) | 탭 글씨 크기·선택 표시를 직접 조절하기 위해 |
| ConfirmDialog 부품 | `utils/confirm.ts` (기본 Alert) | 부품을 따로 만들 필요가 없음 |
| (계획에 없음) | Flash: "저장했어요 + [되돌리기]" | 계획 C-1의 "되돌리기"를 모든 저장에 적용 |
| (계획에 없음) | Stepper: 날짜·시각을 큰 버튼으로 조정 | 달력 패키지 없이 어르신이 쓰기 쉽게 |

## 5. 검수 결과 (ROADMAP I-0, I-1)

| 항목 | 결과 | 확인 방법 |
|---|---|---|
| 타입 검사 오류 0개 | ✅ 통과 | `npm run typecheck` |
| Expo 설정 진단 | ✅ 20/20 | `npx expo-doctor` |
| 하단 탭 4개 (글자 + 아이콘) | ✅ | 화면 확인 |
| 오늘: 날짜·완료 현황·약 확인·혈압·혈당·오늘 진료 | ✅ | 자동 시험 |
| 약 [먹었어요] → 완료, 취소 가능 | ✅ | 자동 시험 (되돌리기, 표시 취소) |
| 혈압·혈당·체중 입력 → 오늘·목록에 바로 반영 | ✅ | 자동 시험 |
| 입력 실수 안내 (범위 밖, 아래 숫자 > 위 숫자, 빈 칸) | ✅ | 자동 시험 |
| 기록 수정·삭제 (확인창 포함) | ✅ | 자동 시험 |
| 약 추가·수정·복약시간 → 오늘 화면 반영 | ✅ | 자동 시험 |
| 병원 일정·물어볼 것 추가·체크 | ✅ | 화면 확인 |
| 119: 확인창 → 전화 앱 | ⚠ 확인창까지만 확인 | 웹에서는 전화 앱이 없어 **실제 휴대폰 확인 필요** |
| 가족 초대·동의·공유 항목·철회 (예시) | ✅ | 자동 시험 (철회 후 목록에서 사라짐) |
| 예시 데이터에 '예시' 표시 | ✅ | 화면 확인 |
| 화면 파일에 글씨 크기·색 코드 직접 쓰지 않음 | ✅ | 모두 `src/theme` 사용 |
| 진단·판정·처방 문구 없음 | ✅ | 문구 검색 (안내문 "진단하지 않아요"와 "처방전"만 나옴) |
| 상태를 색 없이도 구분 | ✅ | ✓/○ 아이콘 + 글자, 선택은 굵은 테두리 + ✓ |
| 앱 안 글씨 '아주 크게'에서 잘림 없음 | ✅ (고친 뒤) | 처음엔 탭 이름이 잘려서 탭 글씨를 고정 크기로 바꿈 |
| **아이폰·안드로이드 실제 기기** | ⏳ 미확인 | 클라우드 환경이라 Expo Go를 쓸 수 없음 → **사용자 확인 필요** |
| **휴대폰 글씨 크기 최대 설정** | ⏳ 미확인 | 실제 기기 필요 |
| **VoiceOver / TalkBack** | ⏳ 미확인 | 실제 기기 필요 (모든 버튼에 한국어 이름은 넣어 둠) |
| **50대 이상 1~2명 간이 테스트** | ⏳ 미실시 | 사용자 진행 필요 |

### 자동 시험 내용 (웹 미리보기, 390×844 휴대폰 크기)
혈당 범위 밖 입력 안내 → 정상 저장 → 오늘 화면 반영 → 되돌리기 → 점심 약 확인 → 혈압 아래 숫자 오류 → 혈압 저장·반영 → 건강기록에서 삭제 → 약 이름 빈 칸 안내 → 약 추가 후 오늘 화면 반영 → 가족 공유 철회 → 119 확인창. **14개 통과, 콘솔 오류 0개.**

## 6. 화면 (예시 데이터)
`docs/screenshots/phase1/` — 1 오늘, 2 건강기록, 3 약·병원, 4 가족 안심, 5 혈압 입력, 6 가족 초대, 7 병원 일정, 8 설정, 9 '아주 크게' 글씨의 오늘 화면

## 7. 알려진 문제 · 2단계로 넘길 일
1. **데이터가 저장되지 않음**: 앱을 껐다 켜면 예시로 돌아갑니다 (1단계 의도대로). 2단계에서 Supabase로 저장합니다.
2. **알림 없음**: 약·병원 알림은 시간만 저장되고, 안내 문구로 "2단계에서 켜져요"라고 표시합니다.
3. **앱 아이콘·시작 화면**이 아직 Expo 기본 그림입니다 → 4단계 전에 디자인이 필요합니다.
4. **오늘 화면이 깁니다**: 약이 3개 이상이면 혈압·혈당 버튼을 보려면 스크롤해야 합니다. 실제 사용자 테스트 결과를 보고 "약 확인을 접어 두기" 등을 검토합니다.
5. **ESLint 미도입**: `npx expo lint`는 처음 실행할 때 설정 패키지를 설치하므로, 승인 후 도입합니다.
6. **단위 테스트 미도입**: 계획대로 2단계에서 jest-expo를 승인받은 뒤 도입합니다(날짜·통계·검증 함수 대상).
7. **Git**: 저장소는 만들었지만(`git init`) 아직 커밋하지 않았습니다. **이 작업 공간은 임시 공간이라, GitHub 저장소에 올리지 않으면 파일이 사라질 수 있습니다.**

## 8. 직접 확인하는 방법
```bash
npm install
```
```bash
npx expo start
```
휴대폰에 **Expo Go** 앱(무료)을 설치하고, 화면의 QR 코드를 찍으면 실행됩니다. 컴퓨터와 휴대폰이 같은 와이파이에 있어야 합니다.

확인할 것: ① 아이폰·안드로이드에서 4개 탭 ② 휴대폰 설정에서 글씨를 가장 크게 ③ VoiceOver/TalkBack으로 [먹었어요] 누르기 ④ 119 버튼 → 전화 앱이 열리는지(**통화 버튼은 누르지 마세요**) ⑤ 주변 어르신께 "저녁 약 먹은 걸 표시해 보세요", "혈압 128 / 82를 기록해 보세요"

## 9. 2단계를 시작하기 전에 결정해 주실 것
1. GitHub 저장소 연결 (코드 보관). 연결하시면 1단계 결과를 커밋해서 올리겠습니다.
2. 쓰지 않는 템플릿 패키지 5개 정리 여부
3. 로그인 방식: 카카오 + 이메일 숫자코드 (카카오 개발자 앱 등록은 무료지만 외부 서비스라 승인 필요)
4. Supabase 무료 프로젝트 생성 (서울 리전, 가상 데이터만 사용)
5. jest-expo(단위 테스트), ESLint 도입 승인
