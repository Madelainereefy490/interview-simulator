#!/bin/bash
echo ""
echo "Interview Simulator Pro v3.0"
echo ""
if ! command -v node &>/dev/null; then echo "Install Node.js from https://nodejs.org"; exit 1; fi
echo "Node: $(node -v)"
if [ ! -f ".env" ]; then cp .env.example .env; echo "Created .env - edit it with your API key"; read -p "Press Enter after editing..."; fi
echo "Installing..."
npm install --silent 2>/dev/null
cd client && npm install --silent 2>/dev/null && cd ..
echo "Starting... Open http://localhost:3000 in Chrome"
npm start
