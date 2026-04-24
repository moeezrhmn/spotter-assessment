import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix broken Leaflet default icons in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const makeIcon = (color, size = 14) =>
  L.divIcon({
    className: '',
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${color};
      border-radius:50%;
      border:2.5px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });

const ICONS = {
  pickup:  makeIcon('#16a34a', 16),
  dropoff: makeIcon('#dc2626', 16),
  fuel:    makeIcon('#d97706', 12),
  rest:    makeIcon('#7c3aed', 12),
  break:   makeIcon('#7c3aed', 12),
  restart: makeIcon('#dc2626', 14),
};

const STOP_LABELS = {
  pickup:  'Pickup',
  dropoff: 'Dropoff',
  fuel:    'Fuel Stop',
  rest:    '10-hr Rest',
  break:   '30-min Break',
  restart: '34-hr Restart (Cycle Reset)',
};

function FitRoute({ waypoints }) {
  const map = useMap();
  useEffect(() => {
    if (waypoints && waypoints.length > 1) {
      map.fitBounds(L.latLngBounds(waypoints), { padding: [32, 32] });
    }
  }, [waypoints, map]);
  return null;
}

export default function RouteMap({ routeData, stops }) {
  if (!routeData) return null;

  const { leg1_waypoints, leg2_waypoints, all_waypoints } = routeData;

  return (
    <MapContainer
      center={all_waypoints[0] || [39.5, -98.35]}
      zoom={5}
      style={{ width: '100%', height: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitRoute waypoints={all_waypoints} />

      {/* Leg 1: current → pickup (blue) */}
      {leg1_waypoints?.length > 1 && (
        <Polyline positions={leg1_waypoints} color="#2563eb" weight={4} opacity={0.85} />
      )}

      {/* Leg 2: pickup → dropoff (darker blue) */}
      {leg2_waypoints?.length > 1 && (
        <Polyline positions={leg2_waypoints} color="#1d4ed8" weight={4} opacity={0.85} />
      )}

      {/* Stops */}
      {stops?.map((stop, i) => (
        <Marker
          key={i}
          position={[stop.lat, stop.lon]}
          icon={ICONS[stop.type] || ICONS.fuel}
        >
          <Popup>
            <div style={{ minWidth: 140 }}>
              <strong>{STOP_LABELS[stop.type] || stop.type}</strong>
              {stop.address && <div style={{ color: '#475569', fontSize: 12, marginTop: 2 }}>{stop.address}</div>}
              {stop.duration_hours > 0 && (
                <div style={{ color: '#475569', fontSize: 12, marginTop: 2 }}>
                  Duration: {stop.duration_hours.toFixed(1)} hr
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
