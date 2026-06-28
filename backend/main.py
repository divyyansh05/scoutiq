import logging
import sys
import time
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from routers import players, teams, analytics, search, lists, dashboard, rankings, reports, leagues, profiles, tactical, planner
from routers.lists import notes_router, searches_router, recruitment_router
from routers.meta import router as meta_router

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)-8s %(name)-20s %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.StreamHandler(sys.stdout),
    ]
)

# Suppress noisy third-party loggers
logging.getLogger('uvicorn.access').setLevel(logging.WARNING)
logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)

log = logging.getLogger('scoutiq')

app = FastAPI(title="ScoutIQ API", version="1.0.0", description="Football scouting intelligence platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:5174", "http://localhost:5176", "http://localhost:5177"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = round((time.time() - start) * 1000, 1)
    log.info(
        f"{request.method} {request.url.path} "
        f"→ {response.status_code} ({duration}ms)"
    )
    return response

app.include_router(players.router)
app.include_router(teams.router)
app.include_router(analytics.router)
app.include_router(search.router)
app.include_router(lists.router)
app.include_router(notes_router)
app.include_router(searches_router)
app.include_router(dashboard.router)
app.include_router(rankings.router)
app.include_router(meta_router)
app.include_router(reports.router)
app.include_router(leagues.router)
app.include_router(profiles.router)
app.include_router(recruitment_router)
app.include_router(tactical.router)
app.include_router(planner.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ScoutIQ API", "version": "1.0.0"}


@app.get("/")
def root():
    return {"message": "ScoutIQ API — visit /docs for API documentation"}
