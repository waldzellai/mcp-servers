# Weather MCP Server

A Model Context Protocol (MCP) server that provides access to National Weather Service data through natural, user-friendly weather tools.

## Features

This server provides weather information through tools designed around how people naturally ask about weather:

### Current Weather
- **`get_current_weather`** - "What's the weather like in San Francisco?"
- Get real-time conditions: temperature, humidity, wind, pressure, visibility

### Forecasts  
- **`get_weather_forecast`** - "What's the 7-day forecast for New York?"
- Get multi-day forecasts with daily high/low temps and conditions
- **`get_hourly_forecast`** - "What's the hourly forecast for today?"
- Get hour-by-hour weather for detailed planning

### Weather Alerts
- **`get_weather_alerts`** - "Are there any weather alerts for Florida?"
- Get active weather warnings, watches, and advisories
- Filter by severity (extreme, severe, moderate, minor)

### Weather Stations
- **`find_weather_stations`** - "What weather stations are near me?"
- Find nearby observation stations with current readings

## Usage Examples

### Current Weather
```
get_current_weather(location: "40.7128,-74.0060")
get_current_weather(location: "New York, NY")  # Coming soon - city name support
```

### 7-Day Forecast
```
get_weather_forecast(location: "37.7749,-122.4194", days: 7)
```

### Hourly Forecast
```
get_hourly_forecast(location: "34.0522,-118.2437", hours: 24)
```

### Weather Alerts
```
get_weather_alerts(location: "CA")  # State alerts
get_weather_alerts(location: "40.7128,-74.0060", severity: "severe")  # Point alerts
```

### Find Stations
```
find_weather_stations(location: "39.7392,-104.9903", limit: 5)
```

## Location Input

Currently supports:
- **Coordinates**: `"latitude,longitude"` format (e.g., `"40.7128,-74.0060"`)
- **State codes**: For weather alerts (e.g., `"CA"`, `"FL"`)

*Coming soon: City names, addresses, and other location formats*

## Data Source

All weather data comes from the National Weather Service (weather.gov) API, providing:
- Official government weather data for the United States
- Real-time observations from weather stations
- Professional forecasts from local NWS offices
- Official weather warnings and alerts

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the server:
```bash
npm run build
```

3. Start the server:
```bash
npm start
```

The server will run on port 8081 by default.

## Development

```bash
npm run dev  # Run in development mode with auto-reload
```

## API Coverage

This server implements user-friendly tools on top of the National Weather Service API, specifically:
- `/points/{lat},{lon}` - Point metadata
- `/gridpoints/{wfo}/{x},{y}/forecast` - Multi-day forecasts  
- `/gridpoints/{wfo}/{x},{y}/forecast/hourly` - Hourly forecasts
- `/gridpoints/{wfo}/{x},{y}/stations` - Weather stations
- `/stations/{id}/observations/latest` - Current observations
- `/alerts/active` - Weather alerts

*No API key required - the National Weather Service provides free, open access to weather data.* 