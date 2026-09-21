const STORAGE = "weather-schedule-v1";
const state = {
  data: loadData(),
  weather: new Map(),
  coords: null,
  locationName: "Location not set",
  installPrompt: null
};

const $ = id => document.getElementById(id);
const todayISO = () => new Date().toISOString().slice(0, 10);

function loadData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE)) || {
      activeWorkspace: "My Day",
      workspaces: { "My Day": { entries: {} } }
    };
  } catch {
    return { activeWorkspace: "My Day", workspaces: { "My Day": { entries: {} } } };
  }
}
function saveData() { localStorage.setItem(STORAGE, JSON.stringify(state.data)); }

function currentWorkspace() {
  return state.data.workspaces[state.data.activeWorkspace];
}
function entryKey(date, hour) { return `${date}|${hour}`; }

function init() {
  $("dateInput").value = todayISO();
  renderWorkspaces();
  renderRows();
  loadSavedLocation();
  registerEvents();
  registerPWA();
}
function renderWorkspaces() {
  const select = $("workspaceSelect");
  select.innerHTML = "";
  Object.keys(state.data.workspaces).forEach(name => {
    const o = document.createElement("option");
    o.value = name; o.textContent = name;
    o.selected = name === state.data.activeWorkspace;
    select.appendChild(o);
  });
}
function renderRows() {
  const date = $("dateInput").value || todayISO();
  const container = $("rows");
  container.innerHTML = "";
  for (let hour = 0; hour < 24; hour++) {
    const row = document.createElement("div");
    row.className = "schedule-row";
    const now = new Date();
    if (date === todayISO() && hour === now.getHours()) row.classList.add("current");

    const time = new Date(`${date}T${String(hour).padStart(2,"0")}:00`);
    const label = time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const w = state.weather.get(hour);

    row.innerHTML = `
      <div class="time">${label}</div>
      <div class="weather">
        <div class="weather-icon">${w?.icon ?? "—"}</div>
        <div>
          <div class="temp">${w ? `${Math.round(w.temp)}°F` : "Loading…"}</div>
          <div class="weather-detail">${w ? `${w.description} · ${Math.round(w.precip)}% rain` : "Fetching forecast"}</div>
        </div>
      </div>
      <div class="content-cell">
        <textarea data-hour="${hour}" placeholder="Add content, task, event, or data…"></textarea>
      </div>`;
    const textarea = row.querySelector("textarea");
    textarea.value = currentWorkspace().entries[entryKey(date, hour)] || "";
    textarea.addEventListener("input", e => {
      currentWorkspace().entries[entryKey(date, hour)] = e.target.value;
      saveData();
    });
    container.appendChild(row);
  }
  fetchWeather(date);
}

async function fetchWeather(date) {
  if (!state.coords) return;
  setStatus("Loading weather…");
  try {
    const { latitude, longitude } = state.coords;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation_probability,weather_code&temperature_unit=fahrenheit&timezone=auto&start_date=${date}&end_date=${date}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Weather service returned an error.");
    const data = await response.json();
    state.weather.clear();
    data.hourly.time.forEach((t, i) => {
      const hour = Number(t.slice(11, 13));
      state.weather.set(hour, {
        temp: data.hourly.temperature_2m[i],
        precip: data.hourly.precipitation_probability[i] ?? 0,
        description: weatherDescription(data.hourly.weather_code[i]),
        icon: weatherIcon(data.hourly.weather_code[i])
      });
    });
    setStatus(`${state.locationName} · forecast updated`);
    updateWeatherCells();
  } catch (err) {
    setStatus(`Could not load weather: ${err.message}`, true);
  }
}
function updateWeatherCells() {
  document.querySelectorAll(".schedule-row").forEach((row, hour) => {
    const w = state.weather.get(hour);
    if (!w) return;
    row.querySelector(".weather-icon").textContent = w.icon;
    row.querySelector(".temp").textContent = `${Math.round(w.temp)}°F`;
    row.querySelector(".weather-detail").textContent = `${w.description} · ${Math.round(w.precip)}% rain`;
  });
}
function weatherDescription(code) {
  if (code === 0) return "Clear";
  if ([1,2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if ([45,48].includes(code)) return "Fog";
  if ([51,53,55,56,57].includes(code)) return "Drizzle";
  if ([61,63,65,66,67].includes(code)) return "Rain";
  if ([71,73,75,77].includes(code)) return "Snow";
  if ([80,81,82].includes(code)) return "Showers";
  if ([85,86].includes(code)) return "Snow showers";
  if ([95,96,99].includes(code)) return "Thunderstorm";
  return "Weather";
}
function weatherIcon(code) {
  if (code === 0) return "☀️";
  if ([1,2].includes(code)) return "🌤️";
  if (code === 3) return "☁️";
  if ([45,48].includes(code)) return "🌫️";
  if ([51,53,55,56,57].includes(code)) return "🌦️";
  if ([61,63,65,66,67,80,81,82].includes(code)) return "🌧️";
  if ([71,73,75,77,85,86].includes(code)) return "🌨️";
  if ([95,96,99].includes(code)) return "⛈️";
  return "🌡️";
}

function setStatus(text, error = false) {
  $("status").textContent = text;
  $("status").className = error ? "status error" : "status";
}
function setDate(delta) {
  const d = new Date(`${$("dateInput").value}T12:00:00`);
  d.setDate(d.getDate() + delta);
  $("dateInput").value = d.toISOString().slice(0,10);
  state.weather.clear();
  renderRows();
}
function useCoords(coords, name) {
  state.coords = coords;
  state.locationName = name || "Current location";
  localStorage.setItem("weather-schedule-location", JSON.stringify({ coords, name: state.locationName }));
  $("locationLabel").textContent = state.locationName;
  renderRows();
}
function loadSavedLocation() {
  try {
    const saved = JSON.parse(localStorage.getItem("weather-schedule-location"));
    if (saved?.coords) useCoords(saved.coords, saved.name);
  } catch {}
}
async function geocodeCity(city) {
  setStatus("Finding location…");
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not contact geocoding service.");
  const data = await response.json();
  if (!data.results?.length) throw new Error("Location not found.");
  const r = data.results[0];
  useCoords({ latitude: r.latitude, longitude: r.longitude },
    [r.name, r.admin1, r.country].filter(Boolean).join(", "));
}

function registerEvents() {
  $("prevDayBtn").onclick = () => setDate(-1);
  $("nextDayBtn").onclick = () => setDate(1);
  $("todayBtn").onclick = () => { $("dateInput").value = todayISO(); state.weather.clear(); renderRows(); };
  $("dateInput").onchange = () => { state.weather.clear(); renderRows(); };
  $("workspaceSelect").onchange = e => {
    state.data.activeWorkspace = e.target.value; saveData(); renderRows();
  };
  $("newWorkspaceBtn").onclick = () => {
    $("workspaceName").value = "";
    $("workspaceDialog").showModal();
    $("workspaceName").focus();
  };
  $("workspaceForm").onsubmit = e => {
    e.preventDefault();
    const name = $("workspaceName").value.trim();
    if (!name || state.data.workspaces[name]) return;
    state.data.workspaces[name] = { entries: {} };
    state.data.activeWorkspace = name;
    saveData(); renderWorkspaces(); $("workspaceDialog").close(); renderRows();
  };
  $("locationBtn").onclick = () => navigator.geolocation.getCurrentPosition(
    p => useCoords({ latitude: p.coords.latitude, longitude: p.coords.longitude }, "Current location"),
    () => setStatus("Location permission was unavailable. Enter a city instead.", true)
  );
  $("cityBtn").onclick = async () => {
    const city = $("cityInput").value.trim();
    if (!city) return;
    try { await geocodeCity(city); } catch (e) { setStatus(e.message, true); }
  };
}

function registerPWA() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(console.error);
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault(); state.installPrompt = e; $("installBtn").classList.remove("hidden");
  });
  $("installBtn").onclick = async () => {
    if (!state.installPrompt) return;
    state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null; $("installBtn").classList.add("hidden");
  };
}
init();
