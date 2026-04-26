@echo off
echo ==========================================
echo  AI Email Manager - Start Dev Servers
echo ==========================================

set NODE_BIN=C:\Users\khoit\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin
set PATH=%NODE_BIN%;%PATH%
set NODE=%NODE_BIN%\node.exe
set NPM=C:\Users\khoit\.cache\npm-portable\package\bin\npm-cli.js

echo [1/2] Starting NestJS backend (port 3001)...
start "NestJS Backend" cmd /k "set PATH=%NODE_BIN%;%PATH% && cd /d "%~dp0backend" && %NODE% %NPM% run start:dev"

echo [2/2] Starting Next.js frontend (port 3000)...
start "Next.js Frontend" cmd /k "set PATH=%NODE_BIN%;%PATH% && cd /d "%~dp0frontend" && %NODE% %NPM% run dev"

echo.
echo  Servers starting...
echo  Frontend: http://localhost:3000
echo  Backend:  http://localhost:3001/api
echo.
pause
