# ScoutIQ

Professional football scouting application powered by data analytics.

## Features
- **Player Search** — filter by position, league, age, xG, aerials, rating
- **Performance Scoring** — REAP-equivalent composite score per player
- **Similar Players** — cosine similarity engine, position-normalised
- **Team Style Clustering** — k-means playing style fingerprints
- **Emerging Talent** — U-23 players outperforming their age cohort
- **Scatter Analysis** — any two metrics, Chelsea FC highlighted
- **Scouting Lists** — save and annotate player shortlists

## Stack
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: FastAPI (Python)
- **ML**: scikit-learn (cosine similarity, k-means)
- **Database**: PostgreSQL (via football-etl-pipeline)

## Prerequisites

Requires the [football-etl-pipeline](https://github.com/yourusername/football-etl-pipeline) database running.

## Quick Start
```bash
git clone https://github.com/yourusername/scoutiq
cd scoutiq

# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Or use the startup script:
```bash
./start.sh
```

Open http://localhost:5173

## API Docs
http://localhost:8000/docs
