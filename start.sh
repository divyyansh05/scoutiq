#!/bin/bash
# ScoutIQ Startup Script
# Usage: ./start.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo "🚀 Starting ScoutIQ..."
echo ""

# Kill any existing processes
pkill -f "uvicorn main:app" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

# Start backend
echo "⚙️  Starting FastAPI backend on http://localhost:8000..."
cd "$BACKEND_DIR"
OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 \
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 3
if curl -s "http://localhost:8000/health" > /dev/null; then
  echo "✅ Backend running (PID: $BACKEND_PID)"
else
  echo "❌ Backend failed to start"
  exit 1
fi

# Start frontend
echo "🎨 Starting React frontend on http://localhost:5173..."
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

sleep 3
echo ""
echo "══════════════════════════════════════════"
echo "  ScoutIQ is running!"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo "══════════════════════════════════════════"
echo ""
echo "Press Ctrl+C to stop both servers."
echo ""

# Wait for both processes
trap "pkill -f 'uvicorn main:app'; pkill -f 'vite'; echo 'Stopped.'" EXIT
wait $BACKEND_PID $FRONTEND_PID
