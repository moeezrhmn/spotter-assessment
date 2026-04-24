# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Full-stack FMCSA-compliant trip planner for truck drivers. Given a trip (current location, pickup, dropoff, cycle hours used), the system calculates Hours of Service (HOS) compliance and produces an interactive route map plus ELD (Electronic Logging Device) daily log sheets.

**Stack**: Django 6 (REST API, stateless) + React 19 + Vite + Material-UI + Leaflet + OpenRouteService API.

## Commands

### Backend (from `backend/`)

```bash
# Install dependencies (uses uv package manager)
uv sync

# Run dev server
python manage.py runserver

# Apply migrations (rarely needed — no DB models)
python manage.py migrate
```

Required env vars in `backend/.env`:
- `SECRET_KEY` — Django secret key
- `DEBUG` — `True` for dev
- `ORS_API_KEY` — OpenRouteService API key (needed for geocoding + routing)

### Frontend (from `frontend/`)

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # output to dist/
npm run lint
```

Required env var in `frontend/.env`:
- `VITE_API_URL` — backend base URL (e.g. `http://localhost:8000`)

## Architecture

### Data Flow

```
TripForm (React)
  → POST /api/trips/plan/  (Axios via frontend/src/services/api.js)
  → TripPlanView (trips/views.py)
  → geocode_address() → get_route()  [OpenRouteService]
  → calculate_trip_plan()            [HOS simulation]
  → build_daily_logs()               [group events by day]
  → JSON response
  → RouteMap + ELDLogSheet[] (React)
```

### Backend (`backend/`)

- **Stateless**: No database models. Django is used purely for REST scaffolding and CORS.
- **Single endpoint**: `POST /api/trips/plan/` handled by `trips/views.py`.
- **Core logic lives entirely in `trips/hos_calculator.py`** (~450 lines):
  - `geocode_address()` — address → lat/lon via ORS
  - `get_route()` — ORS routing for each leg (returns distance, duration, waypoints)
  - `drive_segment()` — iterative HOS simulation; at each step checks all mandatory events before driving further:
    - 70-hr/8-day cycle limit → 34-hr restart
    - 11-hr driving or 14-hr on-duty window → 10-hr rest
    - 8 cumulative driving hours without break → 30-min break
    - Every 1,000 miles → fuel stop (15 min, on-duty-not-driving)
    - Pickup/dropoff → 1-hr on-duty stop
  - `build_daily_logs()` — groups events into per-day structures for ELD rendering

### Frontend (`frontend/src/`)

- **`App.jsx`** — top-level state (`tripData`, `loading`, `error`), layout
- **`components/TripForm.jsx`** — 4-field form; calls `planTrip()` from api.js
- **`components/RouteMap.jsx`** — Leaflet map; two polylines (leg 1 light blue, leg 2 darker blue); color-coded stop markers with popups
- **`components/ELDLogSheet.jsx`** — HTML5 Canvas rendering (~323 lines); draws the 24-hr grid with 4 duty-status rows, remarks section, and totals column. One sheet rendered per day.

### API Contract

**Request**:
```json
{
  "current_location": "Chicago, IL",
  "pickup_location": "Dallas, TX",
  "dropoff_location": "Los Angeles, CA",
  "current_cycle_hours": 24.5
}
```

**Response top-level keys**: `route`, `stops`, `daily_logs`, `summary`

- `route`: `leg1_waypoints`, `leg2_waypoints`, `all_waypoints`, `total_miles`
- `stops`: array of `{ type, lat, lon, address, duration_hours, start, end }`
- `daily_logs`: array of `{ date, day_number, events[], totals{} }`
- `summary`: `num_days`, `total_miles`, `total_driving_hours`, `cycle_hours_used`, `cycle_hours_remaining`

## Key Constraints & Gotchas

- **Trip start time is hardcoded** to 8 AM (`TRIP_START_HOUR = 8.0` in `hos_calculator.py`); dates derive from `date.today()`.
- **Sleeper berth is never used** by the HOS algorithm — only off-duty rest — even though the ELD sheet renders a sleeper berth row.
- **Speed interpolation**: Speed is derived per leg from ORS distance/duration, then used to interpolate intermediate stop coordinates.
- **No sleeper berth split**: The 34-hr restart is the only cycle reset mechanism implemented.
- **ORS API key** is mandatory at runtime; no fallback if missing or rate-limited.
