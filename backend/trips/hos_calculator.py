import math
import requests
from datetime import date, timedelta
from django.conf import settings

# ── HOS Constants ─────────────────────────────────────────────────────────────
MAX_DRIVING_HOURS = 11.0       # max driving per shift
MAX_WINDOW_HOURS = 14.0        # 14-hour on-duty window
BREAK_AFTER_HOURS = 8.0        # mandatory 30-min break after 8 cumulative driving hours
BREAK_DURATION = 0.5           # 30 minutes
REST_DURATION = 10.0           # 10-hour off-duty rest between shifts
RESTART_DURATION = 34.0        # 34-hour restart resets the 70-hour cycle
MAX_CYCLE_HOURS = 70.0         # 70-hour / 8-day limit
FUEL_INTERVAL_MILES = 1000.0   # fuel stop every 1,000 miles
FUEL_STOP_DURATION = 0.25      # ~15 minutes
STOP_DURATION = 1.0            # 1 hour for pickup and dropoff
TRIP_START_HOUR = 8.0          # driver begins at 8 AM on day 1

METERS_PER_MILE = 1609.344
ORS_BASE = "https://api.openrouteservice.org"


# ── Geocoding ─────────────────────────────────────────────────────────────────

def geocode_address(address: str) -> dict:
    """Convert a plain-text address into {lat, lon, label}."""
    url = f"{ORS_BASE}/geocode/search"
    params = {
        "api_key": settings.ORS_API_KEY,
        "text": address,
        "size": 1,
    }
    resp = requests.get(url, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    if not data.get("features"):
        raise ValueError(f"Could not find location: '{address}'. Try being more specific.")

    feature = data["features"][0]
    lon, lat = feature["geometry"]["coordinates"]
    label = feature["properties"].get("label", address)
    return {"lat": lat, "lon": lon, "label": label}


def reverse_geocode(lat: float, lon: float) -> str:
    """Convert lat/lon to 'City, ST' via ORS reverse geocoding. Returns '' on failure."""
    try:
        url = f"{ORS_BASE}/geocode/reverse"
        params = {
            "api_key": settings.ORS_API_KEY,
            "point.lat": lat,
            "point.lon": lon,
            "size": 1,
        }
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if data.get("features"):
            props = data["features"][0]["properties"]
            city = props.get("locality") or props.get("county") or ""
            region = props.get("region_a") or props.get("region") or ""
            if city and region:
                return f"{city}, {region}"
            label = props.get("label", "")
            return ", ".join(label.split(",")[:2]).strip()
    except Exception:
        pass
    return ""


# ── Routing ───────────────────────────────────────────────────────────────────

def get_route(origin: dict, destination: dict) -> dict:
    """
    Get driving route between two {lat, lon} points via ORS.
    Returns {distance_miles, duration_hours, waypoints: [[lat, lon], ...]}.
    """
    # Same location — return zero-distance leg so the rest of the planner works normally
    if (abs(origin["lat"] - destination["lat"]) < 0.001 and
            abs(origin["lon"] - destination["lon"]) < 0.001):
        return {
            "distance_miles": 0.0,
            "duration_hours": 0.0,
            "waypoints": [[origin["lat"], origin["lon"]]],
        }

    url = f"{ORS_BASE}/v2/directions/driving-hgv/geojson"
    headers = {"Authorization": settings.ORS_API_KEY}
    body = {
        "coordinates": [
            [origin["lon"], origin["lat"]],
            [destination["lon"], destination["lat"]],
        ]
    }

    resp = requests.post(url, json=body, headers=headers, timeout=15)
    resp.raise_for_status()
    data = resp.json()

    feature = data["features"][0]
    summary = feature["properties"].get("summary", {})

    distance_miles = summary.get("distance", 0) / METERS_PER_MILE
    duration_hours = summary.get("duration", 0) / 3600.0

    # GeoJSON coordinates are [lon, lat] — flip to [lat, lon] for Leaflet
    coords = feature["geometry"]["coordinates"]
    waypoints = [[c[1], c[0]] for c in coords]

    return {
        "distance_miles": round(distance_miles, 2),
        "duration_hours": round(duration_hours, 4),
        "waypoints": waypoints,
    }


# ── Geometry helpers ──────────────────────────────────────────────────────────

def _segment_lengths(waypoints: list) -> list:
    lengths = []
    for i in range(len(waypoints) - 1):
        lat1, lon1 = waypoints[i]
        lat2, lon2 = waypoints[i + 1]
        lengths.append(math.sqrt((lat2 - lat1) ** 2 + (lon2 - lon1) ** 2))
    return lengths


def interpolate_position(waypoints: list, fraction: float) -> list:
    """Return [lat, lon] at a given fraction (0–1) along a polyline."""
    if not waypoints:
        return [0.0, 0.0]
    fraction = max(0.0, min(1.0, fraction))
    if fraction == 0.0:
        return waypoints[0]
    if fraction == 1.0:
        return waypoints[-1]

    lengths = _segment_lengths(waypoints)
    total = sum(lengths)
    if total == 0:
        return waypoints[0]

    target = fraction * total
    cumulative = 0.0
    for i, seg_len in enumerate(lengths):
        if cumulative + seg_len >= target:
            t = (target - cumulative) / seg_len if seg_len > 0 else 0
            lat = waypoints[i][0] + t * (waypoints[i + 1][0] - waypoints[i][0])
            lon = waypoints[i][1] + t * (waypoints[i + 1][1] - waypoints[i][1])
            return [round(lat, 6), round(lon, 6)]
        cumulative += seg_len

    return waypoints[-1]


# ── Daily log builder ─────────────────────────────────────────────────────────

def build_daily_logs(events: list) -> list:
    """
    Group flat events list into per-day entries for ELD log sheets.
    Each day covers 0–24 hours from midnight. Gaps are filled as off_duty.
    """
    if not events:
        return []

    max_hour = max(e["end"] for e in events)
    num_days = int(max_hour / 24) + 1
    today = date.today()
    daily_logs = []

    for day_num in range(num_days):
        day_start = day_num * 24.0
        day_end = day_start + 24.0

        raw = []
        for event in events:
            clip_start = max(event["start"], day_start)
            clip_end = min(event["end"], day_end)
            if clip_start >= clip_end:
                continue
            raw.append({
                "type": event["type"],
                "status": event["status"],
                "start_hour": round(clip_start - day_start, 4),
                "end_hour": round(clip_end - day_start, 4),
                "duration": round(clip_end - clip_start, 4),
                "address": event.get("address", ""),
            })

        if not raw:
            continue

        raw.sort(key=lambda e: e["start_hour"])

        # Fill every gap with off_duty so the full 24 hours is always covered
        filled = []
        cursor = 0.0
        for ev in raw:
            if ev["start_hour"] > cursor + 0.0001:
                filled.append({
                    "type": "off_duty",
                    "status": "off_duty",
                    "start_hour": round(cursor, 4),
                    "end_hour": round(ev["start_hour"], 4),
                    "duration": round(ev["start_hour"] - cursor, 4),
                })
            filled.append(ev)
            cursor = ev["end_hour"]

        if cursor < 24.0 - 0.0001:
            filled.append({
                "type": "off_duty",
                "status": "off_duty",
                "start_hour": round(cursor, 4),
                "end_hour": 24.0,
                "duration": round(24.0 - cursor, 4),
            })

        totals = {"off_duty": 0.0, "sleeper_berth": 0.0, "driving": 0.0, "on_duty_not_driving": 0.0}
        for ev in filled:
            s = ev["status"]
            if s in totals:
                totals[s] = round(totals[s] + ev["duration"], 2)

        daily_logs.append({
            "date": (today + timedelta(days=day_num)).isoformat(),
            "day_number": day_num + 1,
            "events": filled,
            "totals": totals,
        })

    return daily_logs


# ── Main trip planner ─────────────────────────────────────────────────────────

def calculate_trip_plan(
    start_coords: dict,
    pickup_coords: dict,
    dropoff_coords: dict,
    current_cycle_hours: float,
    start_address: str,
    pickup_address: str,
    dropoff_address: str,
) -> dict:
    """
    Calculate a fully HOS-compliant trip plan.

    Returns a dict with:
      route   – waypoints and totals for the map
      stops   – all stops (pickup, dropoff, fuel, rest) for map markers
      daily_logs – per-day ELD log entries
      summary – quick stats
    """
    leg1 = get_route(start_coords, pickup_coords)
    leg2 = get_route(pickup_coords, dropoff_coords)

    all_waypoints = leg1["waypoints"] + leg2["waypoints"]
    total_miles = leg1["distance_miles"] + leg2["distance_miles"]

    # ── mutable state (simulated with a list so closures can mutate) ──────────
    state = {
        "current_hour": TRIP_START_HOUR,
        "shift_start": TRIP_START_HOUR,
        "driving_this_shift": 0.0,
        "on_duty_this_shift": 0.0,
        "cumulative_since_break": 0.0,
        "cycle_hours": current_cycle_hours,
        "miles_since_fuel": 0.0,
        "miles_total": 0.0,
    }

    events = []
    stops = []

    # ── helpers ───────────────────────────────────────────────────────────────

    def current_pos():
        frac = state["miles_total"] / total_miles if total_miles > 0 else 0
        return interpolate_position(all_waypoints, frac)

    def add_event(event_type, status, start, end, lat=None, lon=None, address=""):
        if lat is None:
            p = current_pos()
            lat, lon = p[0], p[1]
        events.append({
            "type": event_type,
            "status": status,
            "start": round(start, 4),
            "end": round(end, 4),
            "duration": round(end - start, 4),
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "address": address,
        })

    def add_stop(stop_type, start, end, lat, lon, address=""):
        stops.append({
            "type": stop_type,
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "address": address,
            "duration_hours": round(end - start, 2),
            "start": round(start, 4),
            "end": round(end, 4),
        })

    def take_rest():
        s = state["current_hour"]
        e = s + REST_DURATION
        p = current_pos()
        address = reverse_geocode(p[0], p[1])
        add_event("rest", "off_duty", s, e, lat=p[0], lon=p[1], address=address)
        add_stop("rest", s, e, p[0], p[1], address)
        state["current_hour"] = e
        state["shift_start"] = e
        state["driving_this_shift"] = 0.0
        state["on_duty_this_shift"] = 0.0
        state["cumulative_since_break"] = 0.0

    def take_restart():
        """34-hour restart — resets the 70-hour/8-day cycle clock."""
        s = state["current_hour"]
        e = s + RESTART_DURATION
        p = current_pos()
        city = reverse_geocode(p[0], p[1])
        address = f"34-Hr Restart — {city}" if city else "34-Hr Restart"
        add_event("restart", "off_duty", s, e, lat=p[0], lon=p[1], address=address)
        add_stop("restart", s, e, p[0], p[1], address)
        state["current_hour"] = e
        state["shift_start"] = e
        state["driving_this_shift"] = 0.0
        state["on_duty_this_shift"] = 0.0
        state["cumulative_since_break"] = 0.0
        state["cycle_hours"] = 0.0  # cycle resets after 34-hr restart

    def take_break():
        s = state["current_hour"]
        e = s + BREAK_DURATION
        p = current_pos()
        add_event("break", "off_duty", s, e, lat=p[0], lon=p[1])
        add_stop("break", s, e, p[0], p[1])
        state["current_hour"] = e
        state["cumulative_since_break"] = 0.0

    def take_fuel():
        s = state["current_hour"]
        e = s + FUEL_STOP_DURATION
        p = current_pos()
        address = reverse_geocode(p[0], p[1])
        add_event("fuel", "on_duty_not_driving", s, e, lat=p[0], lon=p[1], address=address)
        add_stop("fuel", s, e, p[0], p[1], address)
        state["current_hour"] = e
        state["on_duty_this_shift"] += FUEL_STOP_DURATION
        state["cycle_hours"] += FUEL_STOP_DURATION
        state["miles_since_fuel"] = 0.0

    def drive_segment(seg_hours: float, seg_miles: float):
        """Drive a single route leg, splitting into chunks as HOS rules require."""
        if seg_hours < 0.0001:
            return  # zero-distance leg (same origin and destination)
        remaining_hours = seg_hours
        speed = seg_miles / seg_hours if seg_hours > 0 else 55.0

        iteration_guard = 0
        while remaining_hours > 0.0001:
            iteration_guard += 1
            if iteration_guard > 500:
                break  # safety valve — should never trigger on real inputs

            window_used = state["current_hour"] - state["shift_start"]

            # 70-hour cycle limit reached — need 34-hour restart
            if state["cycle_hours"] >= MAX_CYCLE_HOURS - 0.0001:
                take_restart()
                continue

            # Shift limits exceeded — take a rest
            if state["driving_this_shift"] >= MAX_DRIVING_HOURS - 0.0001 or window_used >= MAX_WINDOW_HOURS - 0.0001:
                take_rest()
                continue

            # 30-minute break due
            if state["cumulative_since_break"] >= BREAK_AFTER_HOURS - 0.0001:
                take_break()
                continue

            # Fuel stop due
            if state["miles_since_fuel"] >= FUEL_INTERVAL_MILES - 0.01:
                take_fuel()
                continue

            # How far can we go before the next mandatory event?
            hours_left_driving = MAX_DRIVING_HOURS - state["driving_this_shift"]
            hours_left_window = MAX_WINDOW_HOURS - window_used
            hours_to_break = BREAK_AFTER_HOURS - state["cumulative_since_break"]
            miles_to_fuel = FUEL_INTERVAL_MILES - state["miles_since_fuel"]
            hours_to_fuel = miles_to_fuel / speed
            hours_to_cycle_limit = MAX_CYCLE_HOURS - state["cycle_hours"]

            can_drive = min(
                remaining_hours,
                hours_left_driving,
                hours_left_window,
                hours_to_break,
                hours_to_fuel,
                hours_to_cycle_limit,
            )

            if can_drive < 0.0001:
                take_rest()
                continue

            chunk_miles = can_drive * speed
            chunk_start = state["current_hour"]
            chunk_end = chunk_start + can_drive

            add_event("driving", "driving", chunk_start, chunk_end)

            state["current_hour"] = chunk_end
            state["driving_this_shift"] += can_drive
            state["on_duty_this_shift"] += can_drive
            state["cumulative_since_break"] += can_drive
            state["cycle_hours"] += can_drive
            state["miles_since_fuel"] += chunk_miles
            state["miles_total"] += chunk_miles
            remaining_hours -= can_drive

    # ── Execute the trip ──────────────────────────────────────────────────────

    # Off-duty period from midnight to trip start — anchors the origin city in REMARKS
    add_event("off_duty", "off_duty", 0.0, TRIP_START_HOUR,
              lat=start_coords["lat"], lon=start_coords["lon"], address=start_address)

    # Leg 1: current location → pickup
    drive_segment(leg1["duration_hours"], leg1["distance_miles"])

    # Pickup stop (1 hour on-duty not driving)
    ps, pe = state["current_hour"], state["current_hour"] + STOP_DURATION
    add_event("pickup", "on_duty_not_driving", ps, pe,
              lat=pickup_coords["lat"], lon=pickup_coords["lon"], address=pickup_address)
    add_stop("pickup", ps, pe, pickup_coords["lat"], pickup_coords["lon"], pickup_address)
    state["current_hour"] = pe
    state["on_duty_this_shift"] += STOP_DURATION
    state["cycle_hours"] += STOP_DURATION

    # Leg 2: pickup → dropoff
    drive_segment(leg2["duration_hours"], leg2["distance_miles"])

    # Dropoff stop (1 hour on-duty not driving)
    ds, de = state["current_hour"], state["current_hour"] + STOP_DURATION
    add_event("dropoff", "on_duty_not_driving", ds, de,
              lat=dropoff_coords["lat"], lon=dropoff_coords["lon"], address=dropoff_address)
    add_stop("dropoff", ds, de, dropoff_coords["lat"], dropoff_coords["lon"], dropoff_address)
    state["current_hour"] = de

    # ── Assemble response ─────────────────────────────────────────────────────

    daily_logs = build_daily_logs(events)
    total_driving = leg1["duration_hours"] + leg2["duration_hours"]

    return {
        "route": {
            "leg1_waypoints": leg1["waypoints"],
            "leg2_waypoints": leg2["waypoints"],
            "all_waypoints": all_waypoints,
            "total_miles": round(total_miles, 1),
        },
        "stops": stops,
        "daily_logs": daily_logs,
        "summary": {
            "num_days": len(daily_logs),
            "total_miles": round(total_miles, 1),
            "total_driving_hours": round(total_driving, 1),
            "cycle_hours_used": round(state["cycle_hours"], 1),
            "cycle_hours_remaining": round(max(0, MAX_CYCLE_HOURS - state["cycle_hours"]), 1),
        },
    }
