@echo off
chcp 65001 > nul
title 오늘건강 개발 서버
rem 오늘건강 앱 실행 (Windows) - 이 파일을 두 번 누르면 실행됩니다.
rem Expo 토큰은 같은 폴더의 expo-token.txt 에 저장합니다 (GitHub에 올라가지 않음).

cd /d "%~dp0"
rem 짧은 이름으로 다룬다 (한글 폴더 이름이 있어도 메모장이 찾도록)
set "TOKEN_FILE=expo-token.txt"

if "%EXPO_TOKEN%"=="" if exist "%TOKEN_FILE%" set /p EXPO_TOKEN=<"%TOKEN_FILE%"

if "%EXPO_TOKEN%"=="" (
  echo [토큰 저장] 메모장이 열립니다.
  echo   1. expo.dev 에서 만든 토큰을 붙여 넣으세요. 다른 글자는 넣지 마세요.
  echo   2. Ctrl+S 로 저장하세요.
  echo   3. 저장한 뒤 이 검은 창으로 돌아와 아무 키나 누르세요.
  if not exist "%TOKEN_FILE%" type nul > "%TOKEN_FILE%"
  start "" notepad "%TOKEN_FILE%"
  pause > nul
)
if "%EXPO_TOKEN%"=="" if exist "%TOKEN_FILE%" set /p EXPO_TOKEN=<"%TOKEN_FILE%"

if "%EXPO_TOKEN%"=="" (
  echo [안내] 토큰이 비어 있어요. 이 창을 닫고 start-app.bat 을 다시 두 번 눌러 주세요.
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
