# 오늘건강

50~80대를 위한 복약 확인 · 혈압/혈당 기록 앱 (Expo + React Native + TypeScript)

> 현재: **3단계** (가족 공유·통계까지) — `.env`에 Supabase 주소가 없으면 체험 모드(예시 데이터), 있으면 로그인 후 서버 저장.

## 문서
- [전체 개발계획](docs/MASTER_PLAN.md)
- [기능 목록](docs/FEATURES.md)
- [단계별 계획·검수 기준](docs/ROADMAP.md)
- [1단계 완료 보고](docs/PHASE1_REPORT.md)
- [2단계 보고](docs/PHASE2_REPORT.md) · [3단계 보고](docs/PHASE3_REPORT.md) · [Supabase 연결 안내](docs/SUPABASE_SETUP.md)
- [작업 규칙](CLAUDE.md)

## 실행
```bash
npm install
```
```bash
npx expo start
```
휴대폰의 Expo Go 앱으로 QR 코드를 찍어 실행합니다.

## 확인
```bash
npm run typecheck
```

이 앱은 기록을 돕는 앱이며, 질병을 진단하거나 약을 바꾸라고 하지 않습니다.
