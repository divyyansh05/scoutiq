#!/bin/bash
# ScoutIQ — Start both backend and frontend
# Usage: ./start.sh [start|stop|restart|status]

set -e

BACKEND_PID_FILE=".backend.pid"
FRONTEND_PID_FILE=".frontend.pid"
BACKEND_LOG="logs/backend.log"
FRONTEND_LOG="logs/frontend.log"

mkdir -p logs

start_backend() {
  if [ -f "$BACKEND_PID_FILE" ] && kill -0 "$(cat $BACKEND_PID_FILE)" 2>/dev/null; then
    echo "Backend already running (PID $(cat $BACKEND_PID_FILE))"
    return
  fi
  echo "Starting backend..."
  cd backend
  source .venv/bin/activate 2>/dev/null || true
  nohup python -m uvicorn main:app --reload --port 8000 --host 0.0.0.0 \
    > "../$BACKEND_LOG" 2>&1 &
  echo $! > "../$BACKEND_PID_FILE"
  cd ..
  echo "Backend started (PID $(cat $BACKEND_PID_FILE)) — logs: $BACKEND_LOG"
}

start_frontend() {
  if [ -f "$FRONTEND_PID_FILE" ] && kill -0 "$(cat $FRONTEND_PID_FILE)" 2>/dev/null; then
    echo "Frontend already running (PID $(cat $FRONTEND_PID_FILE))"
    return
  fi
  echo "Starting frontend..."
  cd frontend
  nohup npm run dev > "../$FRONTEND_LOG" 2>&1 &
  echo $! > "../$FRONTEND_PID_FILE"
  cd ..
  echo "Frontend started (PID $(cat $FRONTEND_PID_FILE)) — logs: $FRONTEND_LOG"
}

stop_backend() {
  if [ -f "$BACKEND_PID_FILE" ]; then
    PID=$(cat $BACKEND_PID_FILE)
    if kill -0 "$PID" 2>/dev/null; then
      kill "$PID"
      echo "Backend stopped (PID $PID)"
    fi
    rm -f "$BACKEND_PID_FILE"
  else
    echo "Backend not running"
  fi
}

stop_frontend() {
  if [ -f "$FRONTEND_PID_FILE" ]; then
    PID=$(cat $FRONTEND_PID_FILE)
    if kill -0 "$PID" 2>/dev/null; then
      kill "$PID"
      echo "Frontend stopped (PID $PID)"
    fi
    rm -f "$FRONTEND_PID_FILE"
  else
    echo "Frontend not running"
  fi
}

status() {
  echo "=== ScoutIQ Status ==="
  if [ -f "$BACKEND_PID_FILE" ] && kill -0 "$(cat $BACKEND_PID_FILE)" 2>/dev/null; then
    echo "Backend:  RUNNING (PID $(cat $BACKEND_PID_FILE))"
  else
    echo "Backend:  STOPPED"
  fi
  if [ -f "$FRONTEND_PID_FILE" ] && kill -0 "$(cat $FRONTEND_PID_FILE)" 2>/dev/null; then
    echo "Frontend: RUNNING (PID $(cat $FRONTEND_PID_FILE))"
  else
    echo "Frontend: STOPPED"
  fi
}

case "${1:-start}" in
  start)
    start_backend
    start_frontend
    sleep 2
    status
    echo ""
    echo "ScoutIQ running at http://localhost:5173"
    echo "API docs at http://localhost:8000/docs"
    ;;
  stop)
    stop_backend
    stop_frontend
    ;;
  restart)
    stop_backend
    stop_frontend
    sleep 1
    start_backend
    start_frontend
    sleep 2
    status
    ;;
  status)
    status
    ;;
  *)
    echo "Usage: ./start.sh [start|stop|restart|status]"
    exit 1
    ;;
esac
