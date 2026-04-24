import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
});

export async function planTrip({ currentLocation, pickupLocation, dropoffLocation, currentCycleHours }) {
  const { data } = await client.post('/api/trips/plan/', {
    current_location: currentLocation,
    pickup_location: pickupLocation,
    dropoff_location: dropoffLocation,
    current_cycle_hours: Number(currentCycleHours),
  });
  return data;
}
