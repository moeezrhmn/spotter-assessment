# Spotter Assessment — Full Implementation Plan

## What We're Building

A full-stack Django + React app where a truck driver enters trip details and gets back:
1. An interactive map with the full route, fuel stops, and rest breaks
2. FMCSA-compliant ELD daily log sheets drawn as 24-hour grids

### Inputs
- Current location (starting point)
- Pickup location
- Dropoff location
- Current cycle hours used (out of 70hr/8-day limit)

### Outputs
- Map with route, stops, fuel stops, rest breaks
- Filled-out ELD daily log sheets (24-hour grid, 4 rows)

---

## HOS Rules to Implement

| Rule | Limit |
|------|-------|
| Daily driving | 11 hours max |
| Daily window | 14 consecutive hours (then must stop) |
| Mandatory break | 30 min after every 8 cumulative driving hours |
| Rest between shifts | 10 consecutive hours off duty |
| Weekly cycle | 70 hours / 8 days rolling |
| Fuel stop | Every 1,000 miles |
| Pickup time | 1 hour (on-duty, not driving) |
| Dropoff time | 1 hour (on-duty, not driving) |

### ELD Log Rows (4 duty statuses)
1. Off Duty
2. Sleeper Berth
3. Driving
4. On Duty (Not Driving)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Django (Python) |
| Frontend | React (JavaScript) |
| Map rendering | Leaflet.js + OpenStreetMap (free) |
| Routing/Geocoding | OpenRouteService (free) |
| ELD drawing | HTML5 Canvas |
| Frontend hosting | Vercel |
| Backend hosting | Render.com or Railway.app (free tier) |

---

## Project Structure

```
spooter-assesment-task/
├── PLAN.md
├── backend/                          # Django
│   ├── manage.py
│   ├── requirements.txt
│   ├── config/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   └── trips/
│       ├── __init__.py
│       ├── views.py                  # REST API endpoint
│       ├── urls.py
│       ├── serializers.py
│       └── hos_calculator.py         # Core HOS logic (most critical)
└── frontend/                         # React
    ├── package.json
    ├── .env
    └── src/
        ├── App.jsx
        ├── components/
        │   ├── TripForm.jsx           # 4 input fields + submit
        │   ├── RouteMap.jsx           # Leaflet map with stops
        │   └── ELDLogSheet.jsx        # Canvas 24-hr grid (hardest part)
        └── services/
            └── api.js                 # Axios calls to Django backend
```

---

## Backend Logic — HOS Calculator Algorithm

`trips/hos_calculator.py` is the heart of the app.

### Step 1 — Geocoding
Convert address strings to (lat, lon) coordinates using OpenRouteService geocoding.

### Step 2 — Route Fetching
Call OpenRouteService to get:
- Distance (miles) for each leg: start → pickup, pickup → dropoff
- Estimated driving duration (hours) per leg
- Polyline waypoints for map rendering

### Step 3 — Trip Scheduling
Walk through the trip, scheduling events in order:

```
Start of day (driver comes on duty)
  └── Drive to pickup
        ├── Insert 30-min break after every 8 cumulative driving hours
        ├── Insert fuel stop every 1,000 miles (~15 min on-duty not driving)
        ├── If 11-hour driving limit OR 14-hour window hit → rest 10 hours (new day)
        └── Arrive at pickup → 1 hour on-duty not driving
  └── Drive to dropoff
        ├── Same rules as above
        └── Arrive at dropoff → 1 hour on-duty not driving
  └── Trip complete
```

### Step 4 — 70-Hour Cycle Tracking
At every point, check:
```
remaining_70hr = 70 - current_cycle_hours_used - hours_on_duty_this_trip
```
If remaining_70hr would go negative, driver must stop and wait for oldest day to roll off.

### Resulting Data Structure Per Day

Each day produces a list of timestamped events:
```python
[
    { "status": "on_duty_not_driving", "start": 0.0,  "end": 1.0  },  # pickup
    { "status": "driving",             "start": 1.0,  "end": 9.0  },  # drive
    { "status": "off_duty",            "start": 9.0,  "end": 9.5  },  # 30-min break
    { "status": "driving",             "start": 9.5,  "end": 12.5 },  # drive
    { "status": "off_duty",            "start": 12.5, "end": 22.5 },  # 10-hr rest
]
```
These events directly map to the ELD canvas drawing.

---

## API Design

### Endpoint

**POST** `/api/trips/plan/`

### Request Body
```json
{
  "current_location": "Chicago, IL",
  "pickup_location": "Dallas, TX",
  "dropoff_location": "Los Angeles, CA",
  "current_cycle_hours": 24.5
}
```

### Response Body
```json
{
  "route": {
    "waypoints": [[lat, lon], [lat, lon], "..."],
    "total_miles": 2100,
    "total_hours": 38.5
  },
  "stops": [
    { "type": "pickup",  "location": "Dallas, TX",      "lat": 32.7, "lon": -96.7, "hour_of_trip": 8.0  },
    { "type": "fuel",    "location": "Amarillo, TX",     "lat": 35.2, "lon": -101.8,"hour_of_trip": 14.0 },
    { "type": "rest",    "duration_hours": 10,           "lat": 35.2, "lon": -106.6,"hour_of_trip": 20.0 },
    { "type": "dropoff", "location": "Los Angeles, CA",  "lat": 34.0, "lon": -118.2,"hour_of_trip": 36.0 }
  ],
  "daily_logs": [
    {
      "date": "2026-04-23",
      "day_number": 1,
      "events": [
        { "status": "driving",           "start_hour": 0.0,  "end_hour": 8.0  },
        { "status": "off_duty",          "start_hour": 8.0,  "end_hour": 8.5  },
        { "status": "driving",           "start_hour": 8.5,  "end_hour": 11.0 },
        { "status": "off_duty",          "start_hour": 11.0, "end_hour": 21.0 }
      ],
      "totals": {
        "off_duty": 10.5,
        "sleeper_berth": 0,
        "driving": 11.0,
        "on_duty_not_driving": 1.0
      }
    }
  ]
}
```

---

## Frontend Components

### TripForm
- 4 input fields: Current Location, Pickup Location, Dropoff Location, Current Cycle Hours
- Submit button triggers API call
- Loading state while waiting for response

### RouteMap (Leaflet + OpenStreetMap)
- Full route polyline in blue
- Pickup marker — green pin
- Dropoff marker — red pin
- Fuel stop markers — yellow pin
- Rest stop markers — orange pin
- Popup on each marker with details

### ELDLogSheet (HTML5 Canvas)
- One canvas component per day
- 24-hour grid (midnight to midnight), x-axis
- 4 rows on y-axis: Off Duty / Sleeper Berth / Driving / On Duty Not Driving
- Horizontal lines drawn across each row per the events array
- Shows totals on the right side
- Looks like the paper log sheet from the FMCSA sample

---

## Free APIs Used

| Service | Purpose | Key Required |
|---------|---------|--------------|
| OpenRouteService | Route distance, duration, waypoints + geocoding | Yes (free signup) |
| Leaflet.js | Map rendering library | No |
| OpenStreetMap tiles | Map tiles | No |

---

## Build Order (4 days, ~16 hours)

### Day 1 — Backend Core (5 hrs)
- [ ] Django project setup + CORS
- [ ] OpenRouteService integration (geocoding + routing)
- [ ] HOS calculator engine (`hos_calculator.py`)
- [ ] REST API endpoint + serializer
- [ ] Test with Postman/curl

### Day 2 — React + Map (4 hrs)
- [ ] React project setup (Vite)
- [ ] TripForm component
- [ ] API service (axios)
- [ ] Leaflet map with route + stop markers

### Day 3 — ELD Log Sheets (4 hrs)
- [ ] Canvas 24-hour grid layout
- [ ] Draw horizontal lines per event status
- [ ] Row labels, hour labels, totals column
- [ ] Multiple sheets for multi-day trips
- [ ] Match the paper log format from the FMCSA sample

### Day 4 — Polish + Deploy (3 hrs)
- [ ] UI/UX polish (good design matters per the rubric)
- [ ] Deploy backend to Render.com
- [ ] Deploy frontend to Vercel
- [ ] Record 3-5 min Loom video (app walkthrough + code review)
- [ ] Submit GitHub repo + hosted URL + Loom link

---

## Key Technical Decisions

- **No database needed** — stateless calculation, no Django models required
- **OpenRouteService** handles both geocoding and routing in one free API
- **Canvas over SVG** for ELD sheets — easier to draw precise pixel-level horizontal lines
- **CORS** enabled on Django so the React frontend (different domain) can call the API
- **No sleeper berth** used in calculations — driver uses standard 10-hour off-duty rest
- **Driver type**: property-carrying (standard rules, no short-haul exceptions)

---

## Deliverables Checklist

- [ ] GitHub repository (public)
- [ ] Live hosted version (frontend on Vercel, backend on Render)
- [ ] 3-5 minute Loom video covering:
  - App walkthrough with a sample trip
  - Code review / explanation of HOS calculator logic

---

## Reference Files

- `fmcsa-hos-395-drivers-guide-to-hos-2022-04-28-0-1-.pdf` — Full HOS rulebook
- `blank-paper-log.png` — Sample ELD log sheet to replicate
- `fmsca-image.png` — Table of contents / overview image
- `new-full-stack-dev-assessment.docx` — Assessment instructions
