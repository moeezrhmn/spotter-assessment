import { useState, useRef } from 'react';
import {
  ThemeProvider, createTheme, CssBaseline,
  AppBar, Toolbar, Box, Typography, Paper, Grid,
  Alert, Chip, Divider, CircularProgress,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import MapIcon from '@mui/icons-material/Map';
import ArticleIcon from '@mui/icons-material/Article';
import SpeedIcon from '@mui/icons-material/Speed';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';

import TripForm from './components/TripForm';
import RouteMap from './components/RouteMap';
import ELDLogSheet from './components/ELDLogSheet';
import { planTrip } from './services/api';
import './App.css';

const theme = createTheme({
  palette: {
    primary: { main: '#2563eb' },
    background: { default: '#f1f5f9' },
  },
  typography: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none' } } },
    MuiTextField: { defaultProps: { variant: 'outlined' } },
  },
});

const STOP_COLORS = { pickup: '#16a34a', dropoff: '#dc2626', fuel: '#d97706', rest: '#7c3aed', break: '#7c3aed', restart: '#dc2626' };
const STOP_LABELS = { pickup: 'Pickup', dropoff: 'Dropoff', fuel: 'Fuel Stop', rest: 'Rest', break: 'Break', restart: '34-hr Restart' };

function StatCard({ icon, value, label, valueColor }) {
  return (
    <Paper elevation={1} sx={{ p: { xs: 1.5, sm: 2.5 }, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, borderRadius: 2 }}>
      <Box sx={{ color: 'primary.main', display: 'flex', '& svg': { fontSize: { xs: 20, sm: 24 } } }}>{icon}</Box>
      <Typography fontWeight={800} sx={{ color: valueColor || '#0f172a', lineHeight: 1, fontSize: { xs: '1.25rem', sm: '2.125rem' } }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" textAlign="center" fontWeight={500} sx={{ fontSize: { xs: 10, sm: 12 } }}>
        {label}
      </Typography>
    </Paper>
  );
}

export default function App() {
  const [tripData, setTripData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const resultsRef = useRef(null);

  const handleSubmit = async (values) => {
    setLoading(true);
    setError(null);
    setTripData(null);
    try {
      const data = await planTrip(values);
      setTripData(data);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      {/* ── Header ─────────────────────────────────────────────── */}
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: '#0f172a', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Toolbar sx={{ maxWidth: 1400, width: '100%', mx: 'auto', px: { xs: 2, md: 3 } }}>
          <LocalShippingIcon sx={{ color: '#60a5fa', mr: 1.5 }} />
          <Typography variant="h6" fontWeight={800} color="#fff" letterSpacing="-0.3px">
            ELD Trip Planner
          </Typography>
          <Typography variant="caption" color="#475569" sx={{ ml: 'auto', display: { xs: 'none', sm: 'block' } }}>
            FMCSA HOS Compliant · 70 hr / 8-day Cycle
          </Typography>
        </Toolbar>
      </AppBar>

      {/* ── Page body ──────────────────────────────────────────── */}
      <Box sx={{ bgcolor: 'background.default', minHeight: 'calc(100vh - 64px)' }}>
        <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 1.5, md: 3 }, py: { xs: 2, md: 3 }, display: 'flex', gap: { xs: 2, md: 3 }, alignItems: 'flex-start', flexDirection: { xs: 'column', md: 'row' } }}>

          {/* Sidebar */}
          <Box sx={{ width: { xs: '100%', md: 360 }, flexShrink: 0, position: { md: 'sticky' }, top: { md: 88 } }}>
            <TripForm onSubmit={handleSubmit} loading={loading} />
          </Box>

          {/* Main content */}
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2.5 }}>

            {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

            {!tripData && !loading && (
              <Paper elevation={1} sx={{ p: { xs: 4, sm: 5 }, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, borderRadius: 2 }}>
                <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LocalShippingIcon sx={{ fontSize: 26, color: '#94a3b8' }} />
                </Box>
                <Typography variant="subtitle2" fontWeight={700} color="#334155">
                  No trip planned yet
                </Typography>
                <Typography variant="body2" color="text.secondary" textAlign="center" maxWidth={300} lineHeight={1.6}>
                  Fill in the trip details to generate an HOS-compliant route and ELD log sheets.
                </Typography>
              </Paper>
            )}

            {loading && (
              <Paper elevation={1} sx={{ p: { xs: 4, sm: 5 }, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, borderRadius: 2 }}>
                <CircularProgress size={40} thickness={3.5} />
                <Typography variant="body2" color="text.secondary">Calculating route and HOS schedule…</Typography>
              </Paper>
            )}

            {tripData && (
              <Box ref={resultsRef} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

                {/* Summary stats */}
                <Grid container spacing={{ xs: 1, sm: 2 }}>
                  <Grid item xs={6} sm={3}>
                    <StatCard icon={<SpeedIcon />} value={tripData.summary.total_miles} label="Total Miles" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <StatCard icon={<AccessTimeIcon />} value={tripData.summary.total_driving_hours} label="Driving Hours" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <StatCard icon={<CalendarTodayIcon />} value={tripData.summary.num_days} label="Days on Road" />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <StatCard
                      icon={<BatteryChargingFullIcon />}
                      value={tripData.summary.cycle_hours_remaining}
                      label="Cycle Hours Left"
                      valueColor={tripData.summary.cycle_hours_remaining < 10 ? '#dc2626' : '#16a34a'}
                    />
                  </Grid>
                </Grid>

                {/* Map */}
                <Paper elevation={1} sx={{ borderRadius: 2, overflow: 'hidden' }}>
                  <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid #e2e8f0', bgcolor: '#fafafa' }}>
                    <MapIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={700}>Route Map</Typography>
                  </Box>
                  <Box className="map-wrap">
                    <RouteMap routeData={tripData.route} stops={tripData.stops} />
                  </Box>

                  {/* Stops row */}
                  <Box sx={{ px: 2, py: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1, borderTop: '1px solid #e2e8f0', bgcolor: '#fafafa' }}>
                    {tripData.stops.map((stop, i) => (
                      <Chip
                        key={i}
                        label={`${STOP_LABELS[stop.type] || stop.type}${stop.duration_hours > 0 ? ` · ${stop.duration_hours.toFixed(1)} hr` : ''}`}
                        size="small"
                        sx={{ bgcolor: STOP_COLORS[stop.type] + '18', color: STOP_COLORS[stop.type], fontWeight: 600, fontSize: 11, border: `1px solid ${STOP_COLORS[stop.type]}44` }}
                      />
                    ))}
                  </Box>
                </Paper>

                {/* ELD sheets */}
                <Paper elevation={1} sx={{ borderRadius: 2, overflow: 'hidden' }}>
                  <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid #e2e8f0', bgcolor: '#fafafa' }}>
                    <ArticleIcon color="primary" fontSize="small" />
                    <Typography variant="subtitle2" fontWeight={700}>ELD Daily Log Sheets</Typography>
                    <Chip label={`${tripData.daily_logs.length} day${tripData.daily_logs.length !== 1 ? 's' : ''}`} size="small" color="primary" sx={{ ml: 'auto', fontWeight: 700 }} />
                  </Box>
                  {tripData.daily_logs.map((log, i) => (
                    <Box key={log.day_number}>
                      {i > 0 && <Divider />}
                      <ELDLogSheet logData={log} />
                    </Box>
                  ))}
                </Paper>

              </Box>
            )}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
