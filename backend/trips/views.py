from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .hos_calculator import geocode_address, calculate_trip_plan


class TripPlanView(APIView):
    def post(self, request):
        data = request.data

        for field in ['current_location', 'pickup_location', 'dropoff_location', 'current_cycle_hours']:
            if field not in data or data[field] == '':
                return Response({'error': f'Missing required field: {field}'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            current_cycle_hours = float(data['current_cycle_hours'])
        except (ValueError, TypeError):
            return Response({'error': 'current_cycle_hours must be a number'}, status=status.HTTP_400_BAD_REQUEST)

        if not 0 <= current_cycle_hours <= 70:
            return Response({'error': 'current_cycle_hours must be between 0 and 70'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            start_coords = geocode_address(data['current_location'])
            pickup_coords = geocode_address(data['pickup_location'])
            dropoff_coords = geocode_address(data['dropoff_location'])
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'Location lookup failed: {str(e)}'}, status=status.HTTP_502_BAD_GATEWAY)

        try:
            result = calculate_trip_plan(
                start_coords=start_coords,
                pickup_coords=pickup_coords,
                dropoff_coords=dropoff_coords,
                current_cycle_hours=current_cycle_hours,
                start_address=data['current_location'],
                pickup_address=data['pickup_location'],
                dropoff_address=data['dropoff_location'],
            )
        except Exception as e:
            return Response({'error': f'Trip calculation failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response(result)
