@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js가 필요합니다. 설치 후 다시 실행해 주세요.
  pause
  exit /b 1
)
if not exist "node_modules\express" (
  echo 처음 실행 준비 중입니다...
  call npm install --omit=dev --no-audit --no-fund
  if errorlevel 1 (
    echo 준비에 실패했습니다. 인터넷 연결을 확인해 주세요.
    pause
    exit /b 1
  )
)
echo 한글 지킴이를 시작합니다.
echo 이 창을 열어 두세요. 종료하려면 Ctrl+C를 누르세요.
node scripts\launch.js
pause

