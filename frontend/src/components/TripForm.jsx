import {
  Box, Button, TextField, Typography, Paper, Divider, List, ListItem, ListItemIcon, ListItemText,
} from '@mui/material';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import SendIcon from '@mui/icons-material/Send';
import { useState } from 'react';

const HOS_RULES = [
  '11 hr max driving per shift',
  '14 hr on-duty window per shift',
  '30 min break after 8 hr driving',
  '10 hr rest between shifts',
  '70 hr / 8-day rolling cycle limit',
  'Fuel stop every 1,000 miles',
  '1 hr at pickup & dropoff',
];

export default function TripForm({ onSubmit, loading }) {
  const [values, setValues] = useState({
    currentLocation: '',
    pickupLocation: '',
    dropoffLocation: '',
    currentCycleHours: '',
  });

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  return (
    <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
      {/* Form header */}
      <Box sx={{ bgcolor: '#0f172a', px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <LocalShippingIcon sx={{ color: '#60a5fa', fontSize: 22 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff' }}>
          Trip Details
        </Typography>
      </Box>

      <Box
        component="form"
        onSubmit={(e) => { e.preventDefault(); onSubmit(values); }}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2.5 }}
      >
        <TextField
          label="Current Location"
          placeholder="e.g. Chicago, IL"
          value={values.currentLocation}
          onChange={set('currentLocation')}
          required
          disabled={loading}
          size="small"
          fullWidth
        />
        <TextField
          label="Pickup Location"
          placeholder="e.g. Dallas, TX"
          value={values.pickupLocation}
          onChange={set('pickupLocation')}
          required
          disabled={loading}
          size="small"
          fullWidth
        />
        <TextField
          label="Dropoff Location"
          placeholder="e.g. Los Angeles, CA"
          value={values.dropoffLocation}
          onChange={set('dropoffLocation')}
          required
          disabled={loading}
          size="small"
          fullWidth
        />
        <TextField
          label="Current Cycle Hours Used"
          placeholder="e.g. 24.5"
          helperText="Hours used out of the 70 hr / 8-day limit"
          type="number"
          inputProps={{ min: 0, max: 70, step: 0.5 }}
          value={values.currentCycleHours}
          onChange={set('currentCycleHours')}
          required
          disabled={loading}
          size="small"
          fullWidth
        />

        <Button
          type="submit"
          variant="contained"
          fullWidth
          size="large"
          disabled={loading}
          endIcon={loading ? null : <SendIcon />}
          sx={{ fontWeight: 700, mt: 0.5 }}
        >
          {loading ? 'Calculating…' : 'Plan Trip'}
        </Button>
      </Box>

      <Divider />

      {/* HOS rules reference */}
      <Box sx={{ px: 2.5, py: 2, bgcolor: '#eff6ff' }}>
        <Typography variant="caption" fontWeight={700} color="primary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Applied HOS Rules
        </Typography>
        <List dense disablePadding sx={{ mt: 0.5 }}>
          {HOS_RULES.map((rule) => (
            <ListItem key={rule} disablePadding sx={{ py: 0.2 }}>
              <ListItemIcon sx={{ minWidth: 26 }}>
                <CheckCircleOutlinedIcon sx={{ fontSize: 14, color: 'primary.main' }} />
              </ListItemIcon>
              <ListItemText
                primary={rule}
                primaryTypographyProps={{ fontSize: 12, color: '#1e40af' }}
              />
            </ListItem>
          ))}
        </List>
      </Box>
    </Paper>
  );
}
