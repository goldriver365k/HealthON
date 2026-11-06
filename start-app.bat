@echo off
chcp 65001 > nul
title 오늘건강 개발 서버
rem 오늘건강 앱 실행 (Windows) - 이 파일을 두 번 누르면 실행됩니다.
rem 처음 한 번: 명령 프롬프트에서  setx EXPO_TOKEN "토큰"  을 실행해 두세요.

cd /d "%~dp0"

if "%EXPO_TOKEN%"=="" (
  echo [안내] Expo 토큰이 없습니다. 아래 명령을 한 번 실행한 뒤, 이 창을 닫고 다시 여세요.
  echo        setx EXPO_TOKEN "expo.dev에서 만든 토큰"
  echo.
  pause
  exit /b 1
)

echo [1/3] 새로 고친 내용 받기...
git pull

echo [2/3] 패키지 확인...
call npm install --no-audit --no-fund

echo [3/3] 앱 서버 켜기... (QR 코드가 나오면 아이폰 Expo Go로 찍으세요. 끝내려면 Ctrl+C)
call npx expo start --tunnel

pause