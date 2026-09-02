# weather-schedule

A simple installable PWA combining an hourly weather forecast with editable schedule/content data.

## Features

- 24 hourly rows
- Weather from Open-Meteo, with no API key
- Browser geolocation or manual city search
- Previous/next day navigation
- Multiple workspaces
- Schedule content saved in `localStorage`
- Installable PWA
- Responsive desktop/mobile layout

## Run locally

A service worker requires HTTP/HTTPS; opening `index.html` directly as `file://` will not provide the full PWA experience.

If Python is installed:

```bash
cd weather-schedule
python -m http.server 8080
```

Then open:

`http://localhost:8080`

For a real deployment, upload the folder to any static HTTPS host.

## Data model

Workspaces are stored locally in the browser. Each entry is keyed by date and hour, so switching workspaces changes the schedule while weather remains location/date based.

## Weather

The app uses Open-Meteo's public forecast and geocoding endpoints. Internet access is required to update weather. The service worker caches the application shell, not live weather data.
