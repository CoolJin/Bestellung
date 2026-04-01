#!/bin/bash
kill $(lsof -t -i :8080) 2>/dev/null || true
npx http-server . -p 8080 > server.log 2>&1 &
SERVER_PID=$!
sleep 2
node test.js
kill $SERVER_PID
