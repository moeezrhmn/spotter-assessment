# Spotter Assessment

A full-stack FMCSA-compliant trip planner for truck drivers. Given a trip (current location, pickup, dropoff, and cycle hours used), the system calculates Hours of Service (HOS) compliance and produces an interactive route map plus ELD daily log sheets.

**Live Demo**: [trip.quanter.dev](https://trip.quanter.dev)

---

## Features

- HOS-compliant trip planning (11hr driving, 14hr window, 70hr/8-day cycle)
- Interactive route map with fuel stops and rest breaks (Leaflet + OpenStreetMap)
- ELD daily log sheets rendered as 24-hour grids (HTML5 Canvas)
- Automatic 30-min breaks, 10-hr rest periods, and 34-hr cycle resets

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django 6 + Django REST Framework |
| Frontend | React 19 + Vite + Material UI |
| Map | Leaflet.js + OpenStreetMap |
| Routing & Geocoding | OpenRouteService API |
| ELD Drawing | HTML5 Canvas |

---

## Local Development

### Prerequisites

- Python 3.13+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/) package manager
- OpenRouteService API key (free at [openrouteservice.org](https://openrouteservice.org/dev/#/login))

### Backend

```bash
cd backend

# Install dependencies
uv sync

# Create .env file
cp .env.example .env
# Edit .env and fill in SECRET_KEY and ORS_API_KEY

# Run migrations
python manage.py migrate

# Start dev server
python manage.py runserver
```

Backend runs at `http://localhost:8000`

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
echo "VITE_API_URL=http://localhost:8000" > .env

# Start dev server
npm run dev
```

Frontend runs at `http://localhost:5173`

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | Django secret key |
| `DEBUG` | `True` for development, `False` for production |
| `ALLOWED_HOSTS` | Comma-separated hostnames (e.g. `localhost,127.0.0.1`) |
| `ORS_API_KEY` | OpenRouteService API key |
| `CORS_ALLOWED_ORIGINS` | Allowed frontend origins in production (e.g. `https://trip.quanter.dev`) |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend base URL (e.g. `http://localhost:8000`) |

---

## API

**POST** `/api/trips/plan/`

```json
{
  "current_location": "Chicago, IL",
  "pickup_location": "Dallas, TX",
  "dropoff_location": "Los Angeles, CA",
  "current_cycle_hours": 24.5
}
```

Returns route waypoints, stop details, ELD daily logs, and a trip summary.
