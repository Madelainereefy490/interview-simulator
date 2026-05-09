@echo off
echo.
echo  Interview Simulator Pro v3.0
echo  Multi-Provider AI Support
echo.
node --version >nul 2>&1
if errorlevel 1 (
    echo  Node.js not found! Download from https://nodejs.org
    pause
    exit /b 1
)
echo  Node.js found
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo.
    echo  Created .env - configure your AI provider and API key
    notepad .env
    pause
)
echo  Installing dependencies...
call npm install --silent 2>nul
cd client
call npm install --silent 2>nul
cd ..
echo.
echo  Starting... Open http://localhost:3000 in Chrome
echo  Allow Microphone + Camera when asked
echo.
call npm start
