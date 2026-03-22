from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import players, teams, analytics, search, lists, dashboard

app = FastAPI(title="ScoutIQ API", version="1.0.0", description="Football scouting intelligence platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(players.router)
app.include_router(teams.router)
app.include_router(analytics.router)
app.include_router(search.router)
app.include_router(lists.router)
app.include_router(dashboard.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "ScoutIQ API", "version": "1.0.0"}


@app.get("/")
def root():
    return {"message": "ScoutIQ API — visit /docs for API documentation"}
