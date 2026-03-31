#!/bin/bash
# ScoutIQ — Start both development servers
# Usage: bash scripts/dev.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Starting ScoutIQ..."
echo ""

# Kill any existing instances (scope to this project only)
pkill -f "uvicorn main:app" 2>/dev/null && echo "Stopped existing backend." || true
pkill -f "vite" 2>/dev/null && echo "Stopped existing frontend." || true
sleep 1

# ── Backend ──────────────────────────────────────────────────────────────────
echo "[1/2] Starting FastAPI backend on http://localhost:8000..."
cd "$PROJECT_ROOT/backend"
OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1 \
  uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Wait for backend health check
for i in 1 2 3 4 5; do
  sleep 1
  if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo "Backend ready (PID: $BACKEND_PID)"
    break
  fi
  if [ $i -eq 5 ]; then
    echo "WARNING: Backend may not be ready yet (still starting...)"
  fi
done

# ── Frontend ─────────────────────────────────────────────────────────────────
echo "[2/2] Starting React frontend on http://localhost:5173..."
cd "$PROJECT_ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "══════════════════════════════════════════"
echo "  ScoutIQ is running"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo "  API docs: http://localhost:8000/docs"
echo "══════════════════════════════════════════"
echo ""
echo "Press Ctrl+C to stop both servers."
echo ""

# Graceful shutdown on Ctrl+C
trap "echo ''; echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait $BACKEND_PID $FRONTEND_PID
