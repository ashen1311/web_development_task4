'use strict';
/* ================================================================
   ASHEN PAUL — app.js  (Task 4: Async JavaScript & RESTful APIs)
   ----------------------------------------------------------------
   Features:
   1.  Fetch API + async/await — current weather + 5-day forecast
   2.  Comprehensive error handling — network, 404, API key
   3.  Complex nested JSON parsing + dynamic DOM rendering
   4.  City search with search history (localStorage)
   5.  °C / °F unit toggle (converts without re-fetching)
   6.  Sunrise/sunset arc + daylight hours
   7.  Autocomplete suggestions (popular Indian cities)
   8.  Live clock for searched city (using timezone offset)
   9.  Dark/light theme toggle
   10. Raw JSON viewer panel
   ================================================================

   HOW TO GET YOUR FREE API KEY
   ─────────────────────────────
   1. Go to https://openweathermap.org/api
   2. Sign up (free)
   3. Go to API Keys in your dashboard
   4. Copy your key and paste it below
   ================================================================ */


/* ── YOUR API KEY ────────────────────────────────────────────── */
/* ⚠  Replace the string below with your OpenWeatherMap API key  */
const API_KEY = 'YOUR_API_KEY_HERE';

const BASE_URL      = 'https://api.openweathermap.org/data/2.5';
const GEOCODE_URL   = 'https://api.openweathermap.org/geo/1.0';
const ICON_URL      = 'https://openweathermap.org/img/wn';
const STORAGE_KEY   = 'ap-weather-recent';
const THEME_KEY     = 'ap-theme';
const MAX_RECENT    = 6;


/* ── STATE ───────────────────────────────────────────────────── */
let state = {
  unit:        'metric',    // 'metric' | 'imperial'
  lastCity:    null,        // last searched city string
  currentData: null,        // raw current weather JSON
  forecastData:null,        // raw forecast JSON
  clockTimer:  null,        // setInterval id for live clock
  abortCtrl:   null,        // AbortController for in-flight requests
};


/* ── DOM REFS ────────────────────────────────────────────────── */
const searchForm     = document.getElementById('search-form');
const cityInput      = document.getElementById('city-input');
const searchErr      = document.getElementById('search-err');
const btnSearch      = document.getElementById('btn-search');
const suggestionList = document.getElementById('suggestions-list');
const recentWrap     = document.getElementById('recent-wrap');
const recentList     = document.getElementById('recent-list');
const btnClearRecent = document.getElementById('btn-clear-recent');
const liveAnnounce   = document.getElementById('live-announce');

const loadingEl      = document.getElementById('loading');
const errorState     = document.getElementById('error-state');
const errorTitle     = document.getElementById('error-title');
const errorMsg       = document.getElementById('error-msg');
const btnRetry       = document.getElementById('btn-retry');
const weatherOutput  = document.getElementById('weather-output');
const welcomeState   = document.getElementById('welcome-state');

/* Current weather */
const cityName       = document.getElementById('city-name');
const countryCode    = document.getElementById('country-code');
const currentCoords  = document.getElementById('current-coords');
const currentTime    = document.getElementById('current-time');
const weatherIcon    = document.getElementById('weather-icon');
const weatherDesc    = document.getElementById('weather-desc');
const tempMain       = document.getElementById('temp-main');
const tempFeels      = document.getElementById('temp-feels');
const tempHigh       = document.getElementById('temp-high');
const tempLow        = document.getElementById('temp-low');
const humidity       = document.getElementById('humidity');
const humidityBar    = document.getElementById('humidity-bar');
const windSpeed      = document.getElementById('wind-speed');
const windDir        = document.getElementById('wind-dir');
const pressure       = document.getElementById('pressure');
const pressureTrend  = document.getElementById('pressure-trend');
const visibility     = document.getElementById('visibility');
const cloudiness     = document.getElementById('cloudiness');
const uvIndex        = document.getElementById('uv-index');
const uvLevel        = document.getElementById('uv-level');
const sunrise        = document.getElementById('sunrise');
const sunset         = document.getElementById('sunset');
const daylightHours  = document.getElementById('daylight-hours');
const sunPos         = document.getElementById('sun-pos');
const forecastList   = document.getElementById('forecast-list');
const unitBtns       = document.querySelectorAll('.unit-btn');
const jsonToggle     = document.getElementById('json-toggle');
const jsonPanel      = document.getElementById('json-panel');
const jsonOutput     = document.getElementById('json-output');

const themeBtn       = document.getElementById('theme-btn');


/* ================================================================
   THEME
   ================================================================ */
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  if (themeBtn) themeBtn.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}
(function initTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
})();
themeBtn && themeBtn.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
});


/* ================================================================
   HELPERS
   ================================================================ */
function announce(msg) {
  liveAnnounce.textContent = '';
  requestAnimationFrame(() => { liveAnnounce.textContent = msg; });
}

function degToCompass(deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function msToTime(ms, tzOffset) {
  /* tzOffset from OWM is in seconds, UTC offset */
  const utc  = ms + tzOffset * 1000;
  const d    = new Date(utc);
  return d.toUTCString().slice(17, 22); // HH:MM
}

function formatLocalTime(tzOffset) {
  const now    = Date.now();
  const local  = now + tzOffset * 1000;
  const d      = new Date(local);
  return d.toUTCString().slice(5, 22); // "DD Mon YYYY HH:MM"
}

function daylightDuration(sunriseMs, sunsetMs) {
  const diff   = sunsetMs - sunriseMs;
  const hrs    = Math.floor(diff / 3600000);
  const mins   = Math.round((diff % 3600000) / 60000);
  return `${hrs}h ${mins}m`;
}

function sunArcPosition(sunriseMs, sunsetMs, tzOffset) {
  const now    = Date.now() + tzOffset * 1000;
  const total  = sunsetMs - sunriseMs;
  const elapsed= now - sunriseMs;
  const pct    = Math.max(0, Math.min(1, elapsed / total));
  /* Parametric point along arc path Q(t) = (1-t)^2 * P0 + 2t(1-t)*P1 + t^2 * P2 */
  const t  = pct;
  const p0 = { x: 10, y: 90 }, p1 = { x: 100, y: 10 }, p2 = { x: 190, y: 90 };
  const x  = (1-t)*(1-t)*p0.x + 2*t*(1-t)*p1.x + t*t*p2.x;
  const y  = (1-t)*(1-t)*p0.y + 2*t*(1-t)*p1.y + t*t*p2.y;
  return { x: x.toFixed(1), y: y.toFixed(1) };
}

function uvDescription(index) {
  if (index <= 2)  return 'Low';
  if (index <= 5)  return 'Moderate';
  if (index <= 7)  return 'High';
  if (index <= 10) return 'Very High';
  return 'Extreme';
}

function tempDisplay(kelvin, unit) {
  if (unit === 'metric')   return `${Math.round(kelvin - 273.15)}°C`;
  if (unit === 'imperial') return `${Math.round((kelvin - 273.15) * 9/5 + 32)}°F`;
  return `${Math.round(kelvin - 273.15)}°C`;
}

function windDisplay(mps, unit) {
  if (unit === 'imperial') return `${Math.round(mps * 2.237)} mph`;
  return `${Math.round(mps * 3.6)} km/h`;
}

function visDisplay(m) {
  const km = m / 1000;
  return km >= 10 ? '10+ km' : `${km.toFixed(1)} km`;
}


/* ================================================================
   RECENT SEARCHES
   ================================================================ */
function getRecent() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveRecent(city) {
  let list = getRecent();
  list = [city, ...list.filter(c => c.toLowerCase() !== city.toLowerCase())].slice(0, MAX_RECENT);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  renderRecent();
}

function renderRecent() {
  const list = getRecent();
  if (list.length === 0) { recentWrap.hidden = true; return; }
  recentWrap.hidden  = false;
  recentList.innerHTML = list.map(c =>
    `<button class="recent-tag" type="button" data-city="${c}" aria-label="Search ${c} again">${c}</button>`
  ).join('');
}

btnClearRecent && btnClearRecent.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  renderRecent();
  announce('Recent searches cleared.');
});

recentList && recentList.addEventListener('click', e => {
  const btn = e.target.closest('.recent-tag');
  if (!btn) return;
  cityInput.value = btn.dataset.city;
  fetchWeather(btn.dataset.city);
});


/* ================================================================
   AUTOCOMPLETE SUGGESTIONS
   ================================================================ */
const POPULAR_CITIES = [
  'Mumbai','Delhi','Bengaluru','Chennai','Hyderabad','Kolkata',
  'Pune','Ahmedabad','Jaipur','Surat','Lucknow','Kanpur',
  'Nagpur','Indore','Bhopal','Visakhapatnam','Patna','Vadodara',
  'London','New York','Tokyo','Dubai','Singapore','Sydney',
  'Paris','Berlin','Toronto','Los Angeles','Chicago'
];

function showSuggestions(query) {
  if (!query || query.length < 1) {
    hideSuggestions(); return;
  }
  const matches = POPULAR_CITIES.filter(c =>
    c.toLowerCase().startsWith(query.toLowerCase())
  ).slice(0, 5);

  if (matches.length === 0) { hideSuggestions(); return; }

  suggestionList.innerHTML = matches.map(c =>
    `<li class="suggestion-item" role="option" aria-selected="false" tabindex="-1">${c}</li>`
  ).join('');
  suggestionList.hidden = false;
}

function hideSuggestions() {
  suggestionList.hidden = true;
  suggestionList.innerHTML = '';
}

cityInput.addEventListener('input', () => showSuggestions(cityInput.value));
cityInput.addEventListener('blur', () => setTimeout(hideSuggestions, 150));

suggestionList.addEventListener('click', e => {
  const item = e.target.closest('.suggestion-item');
  if (!item) return;
  cityInput.value = item.textContent;
  hideSuggestions();
  fetchWeather(item.textContent);
});

/* Arrow keys navigate suggestions */
cityInput.addEventListener('keydown', e => {
  const items = Array.from(suggestionList.querySelectorAll('.suggestion-item'));
  if (!items.length) return;
  const focused = suggestionList.querySelector('[aria-selected="true"]');
  let idx = items.indexOf(focused);

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (focused) focused.setAttribute('aria-selected', 'false');
    idx = (idx + 1) % items.length;
    items[idx].setAttribute('aria-selected', 'true');
    items[idx].focus();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (focused) focused.setAttribute('aria-selected', 'false');
    idx = (idx - 1 + items.length) % items.length;
    items[idx].setAttribute('aria-selected', 'true');
    items[idx].focus();
  } else if (e.key === 'Escape') {
    hideSuggestions();
    cityInput.focus();
  }
});

suggestionList.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const focused = suggestionList.querySelector('[aria-selected="true"]');
    if (focused) { cityInput.value = focused.textContent; hideSuggestions(); fetchWeather(focused.textContent); }
  }
});


/* ================================================================
   UI STATE HELPERS
   ================================================================ */
function showLoading() {
  loadingEl.hidden     = false;
  errorState.hidden    = true;
  weatherOutput.hidden = true;
  welcomeState.hidden  = true;
  btnSearch.disabled   = true;
}

function showError(title, msg) {
  loadingEl.hidden     = true;
  weatherOutput.hidden = true;
  welcomeState.hidden  = true;
  errorState.hidden    = false;
  errorTitle.textContent = title;
  errorMsg.textContent   = msg;
  btnSearch.disabled     = false;
  announce(`Error: ${title}. ${msg}`);
}

function showWeather() {
  loadingEl.hidden     = true;
  errorState.hidden    = true;
  welcomeState.hidden  = true;
  weatherOutput.hidden = false;
  btnSearch.disabled   = false;
}


/* ================================================================
   FETCH — current weather
   ================================================================ */
async function fetchCurrentWeather(city, signal) {
  const url = `${BASE_URL}/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=kelvin`;
  const res  = await fetch(url, { signal });

  if (!res.ok) {
    if (res.status === 404) throw new Error('404');
    if (res.status === 401) throw new Error('401');
    throw new Error(`HTTP_${res.status}`);
  }

  return res.json();
}


/* ================================================================
   FETCH — 5-day forecast
   ================================================================ */
async function fetchForecast(city, signal) {
  const url = `${BASE_URL}/forecast?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=kelvin`;
  const res  = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return res.json();
}


/* ================================================================
   MAIN FETCH ORCHESTRATOR
   ================================================================ */
async function fetchWeather(city) {
  if (!city.trim()) return;

  /* Cancel any in-flight request */
  if (state.abortCtrl) state.abortCtrl.abort();
  state.abortCtrl = new AbortController();
  const { signal } = state.abortCtrl;

  /* Clear live clock */
  if (state.clockTimer) clearInterval(state.clockTimer);

  showLoading();
  announce(`Fetching weather for ${city}...`);

  try {
    /* Parallel fetch — both requests fire at once */
    const [current, forecast] = await Promise.all([
      fetchCurrentWeather(city, signal),
      fetchForecast(city, signal),
    ]);

    state.currentData  = current;
    state.forecastData = forecast;
    state.lastCity     = city;

    renderCurrentWeather(current);
    renderForecast(forecast);
    renderJsonPanel(current, forecast);

    showWeather();
    saveRecent(current.name);
    announce(`Weather loaded for ${current.name}, ${current.sys.country}.`);

    /* Start live clock */
    state.clockTimer = setInterval(() => {
      currentTime.textContent = formatLocalTime(current.timezone);
    }, 1000);
    currentTime.textContent = formatLocalTime(current.timezone);

  } catch (err) {
    if (err.name === 'AbortError') return; /* User started new search */

    if (err.message === '404') {
      showError('City not found', `"${city}" doesn't match any city in the database. Check the spelling and try again.`);
    } else if (err.message === '401') {
      showError('Invalid API key', 'Your OpenWeatherMap API key is missing or invalid. See the README for setup instructions.');
    } else if (!navigator.onLine) {
      showError('No internet connection', 'Check your network and try again.');
    } else {
      showError('Request failed', `Something went wrong fetching weather data. (${err.message})`);
    }
  }
}


/* ================================================================
   RENDER — current weather
   ================================================================ */
function renderCurrentWeather(d) {
  /* Header */
  cityName.textContent    = d.name;
  countryCode.textContent = d.sys.country;
  currentCoords.textContent =
    `${Math.abs(d.coord.lat).toFixed(2)}°${d.coord.lat >= 0 ? 'N' : 'S'}, ` +
    `${Math.abs(d.coord.lon).toFixed(2)}°${d.coord.lon >= 0 ? 'E' : 'W'}`;

  /* Icon */
  const icon = d.weather[0].icon;
  weatherIcon.src = `${ICON_URL}/${icon}@2x.png`;
  weatherIcon.alt = d.weather[0].description;
  weatherDesc.textContent = d.weather[0].description;

  /* Temps — store raw Kelvin, convert on render */
  renderTemps(d);

  /* Metrics */
  humidity.textContent = `${d.main.humidity}%`;
  humidityBar.style.width = `${d.main.humidity}%`;

  windSpeed.textContent = windDisplay(d.wind.speed, state.unit);
  windDir.textContent   = d.wind.deg != null
    ? `${degToCompass(d.wind.deg)} (${d.wind.deg}°)`
    : '';

  pressure.textContent    = `${d.main.pressure} hPa`;
  pressureTrend.textContent = d.main.pressure > 1013
    ? 'Above average — likely clear'
    : d.main.pressure < 1000
    ? 'Low — possible rain'
    : 'Near average';

  visibility.textContent  = visDisplay(d.visibility || 10000);
  cloudiness.textContent  = `${d.clouds.all}%`;

  /* UV — not in current weather endpoint; show placeholder */
  uvIndex.textContent = '—';
  uvLevel.textContent = 'Not available';

  /* Sunrise / Sunset */
  const srMs = d.sys.sunrise * 1000;
  const ssMs = d.sys.sunset  * 1000;
  sunrise.textContent     = msToTime(srMs, d.timezone);
  sunset.textContent      = msToTime(ssMs, d.timezone);
  daylightHours.textContent = daylightDuration(srMs, ssMs);

  /* Sun arc position */
  if (sunPos) {
    const pos = sunArcPosition(srMs, ssMs, d.timezone);
    sunPos.setAttribute('cx', pos.x);
    sunPos.setAttribute('cy', pos.y);
  }
}

function renderTemps(d) {
  tempMain.textContent   = tempDisplay(d.main.temp,       state.unit);
  tempFeels.textContent  = tempDisplay(d.main.feels_like, state.unit);
  tempHigh.textContent   = tempDisplay(d.main.temp_max,   state.unit);
  tempLow.textContent    = tempDisplay(d.main.temp_min,   state.unit);
  windSpeed.textContent  = windDisplay(d.wind.speed,      state.unit);
}


/* ================================================================
   RENDER — 5-day forecast
   Forecast gives readings every 3h. We pick one per day (noon).
   ================================================================ */
function renderForecast(d) {
  /* Group by date, pick midday reading (or first of day) */
  const days = {};
  d.list.forEach(item => {
    const date = item.dt_txt.slice(0, 10);
    const hour = parseInt(item.dt_txt.slice(11, 13), 10);
    if (!days[date] || Math.abs(hour - 12) < Math.abs(parseInt(days[date].dt_txt.slice(11, 13), 10) - 12)) {
      days[date] = item;
    }
  });

  const entries = Object.values(days).slice(0, 5);

  forecastList.innerHTML = entries.map(item => {
    const date = new Date(item.dt * 1000);
    const day  = date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    const icon = item.weather[0].icon;
    const desc = item.weather[0].description;
    const hi   = tempDisplay(item.main.temp_max, state.unit);
    const lo   = tempDisplay(item.main.temp_min, state.unit);

    return `
      <li class="forecast-item" role="listitem">
        <span class="forecast-day">${day}</span>
        <img class="forecast-icon" src="${ICON_URL}/${icon}.png" alt="${desc}" width="40" height="40" />
        <span class="forecast-desc">${desc}</span>
        <div class="forecast-temps">
          <span class="forecast-high" aria-label="High ${hi}">${hi}</span>
          <span class="forecast-low"  aria-label="Low ${lo}">${lo}</span>
        </div>
      </li>
    `;
  }).join('');
}


/* ================================================================
   UNIT TOGGLE
   ================================================================ */
unitBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    state.unit = btn.dataset.unit;

    unitBtns.forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');

    /* Re-render with new unit — no new fetch needed */
    if (state.currentData)  renderTemps(state.currentData);
    if (state.forecastData) renderForecast(state.forecastData);

    announce(`Temperature unit changed to ${state.unit === 'metric' ? 'Celsius' : 'Fahrenheit'}.`);
  });
});


/* ================================================================
   JSON PANEL
   ================================================================ */
function renderJsonPanel(current, forecast) {
  const combined = { current, forecast };
  jsonOutput.textContent = JSON.stringify(combined, null, 2);
}

jsonToggle && jsonToggle.addEventListener('click', () => {
  const open = jsonToggle.getAttribute('aria-expanded') === 'true';
  jsonToggle.setAttribute('aria-expanded', String(!open));
  jsonPanel.hidden = open;
  if (!open) jsonOutput.focus();
});


/* ================================================================
   SEARCH FORM
   ================================================================ */
searchForm.addEventListener('submit', e => {
  e.preventDefault();
  const city = cityInput.value.trim();

  if (!city) {
    searchErr.textContent = 'Please enter a city name.';
    searchErr.hidden = false;
    cityInput.focus();
    return;
  }
  searchErr.hidden = true;
  hideSuggestions();
  fetchWeather(city);
});

/* Clear error on typing */
cityInput.addEventListener('input', () => {
  if (!searchErr.hidden) searchErr.hidden = true;
});


/* ================================================================
   QUICK CITIES & RETRY
   ================================================================ */
document.addEventListener('click', e => {
  const qc = e.target.closest('.quick-city');
  if (qc) { cityInput.value = qc.dataset.city; fetchWeather(qc.dataset.city); }
});

btnRetry && btnRetry.addEventListener('click', () => {
  if (state.lastCity) fetchWeather(state.lastCity);
});


/* ================================================================
   BOOT
   ================================================================ */
(function init() {
  renderRecent();

  /* If API key is placeholder, show a helpful notice */
  if (API_KEY === 'YOUR_API_KEY_HERE') {
    welcomeState.innerHTML = `
      <span class="welcome-icon" aria-hidden="true">🔑</span>
      <p class="welcome-title">Add your API key to get started</p>
      <p class="welcome-sub" style="max-width:38ch;margin-inline:auto;">
        Open <code>app.js</code> and replace <code>YOUR_API_KEY_HERE</code>
        with a free key from
        <a href="https://openweathermap.org/api" target="_blank" rel="noopener noreferrer">openweathermap.org</a>.
        It takes about 2 minutes to sign up.
      </p>
    `;
  }
})();