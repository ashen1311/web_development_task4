# web_development_task4
# Ashen Paul — Task 4: Asynchronous JavaScript & RESTful APIs

A real-time Weather Dashboard built with vanilla JavaScript.
Fetches live data from the OpenWeatherMap REST API using the Fetch API and async/await.

---

## Features

| Feature | Detail |
|---|---|
| **Fetch API + async/await** | Both current weather and 5-day forecast fetched in parallel with `Promise.all` |
| **Error handling** | 404 city not found, 401 bad API key, network offline, generic HTTP errors |
| **Complex JSON parsing** | Nested objects parsed and rendered — temp, humidity, wind, pressure, clouds, sun times |
| **City search** | Input with live autocomplete suggestions (arrow key navigation) |
| **Recent searches** | Last 6 cities saved in localStorage, clickable chips |
| **5-Day forecast** | Midday reading per day, icon + description + high/low |
| **°C / °F toggle** | Converts all temps instantly without re-fetching |
| **Sunrise/sunset arc** | SVG arc with live sun position |
| **Live clock** | Local time in searched city updates every second |
| **Raw JSON viewer** | Collapsible panel shows the full API response |
| **AbortController** | Cancels in-flight requests when user searches again |
| **Dark / light theme** | Toggle saved to localStorage |
| **Accessibility** | ARIA live regions, skip link, keyboard nav, focus management |

---

## Setup — Get Your Free API Key (2 minutes)

1. Go to **https://openweathermap.org/api**
2. Click **Sign Up** (it's free)
3. After signing in, go to **API Keys** in your dashboard
4. Copy your default key (or generate a new one)
5. Open `app.js` — find line 3 at the top:

```js
const API_KEY = 'YOUR_API_KEY_HERE';
```

6. Replace `YOUR_API_KEY_HERE` with your key:

```js
const API_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
```

7. Save the file — done. The app works immediately.

> **Note:** New API keys take up to 10 minutes to activate after signup.

---

## Files

```
task4-weather/
├── index.html   Markup — semantic HTML5, ARIA, search form, metric cards
├── style.css    Styles — dark/light tokens, Grid, Flexbox, animations
├── app.js       All JS — Fetch API, async/await, error handling, DOM render
└── README.md    This file
```

---

## How to upload to GitHub

### First time — configure Git (once per machine)

```bash
git config --global user.name "Ashen Paul"
git config --global user.email "hello@ashenpaul.dev"
```

---

### Option A — New repo (Task 4 only)

```bash
cd path/to/task4-weather

git init
git add .
git commit -m "task 4: async JS and RESTful APIs — weather dashboard"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/weather-dashboard.git
git push -u origin main
```

---

### Option B — Add to your existing portfolio repo

```bash
cd path/to/portfolio

# copy the task4-weather folder in, then:
git add task4-weather/
git commit -m "task 4: weather dashboard — Fetch API, async/await, error handling"
git push
```

---

### Enable GitHub Pages

1. Repo → **Settings → Pages**
2. Source: **main** / folder: **/ (root)**
3. Save — live at `https://YOUR_USERNAME.github.io/weather-dashboard/`

---

### Every future update

```bash
git add .
git commit -m "describe what changed"
git push
```

---

## Useful Git commands

```bash
git status          # what files changed
git log --oneline   # commit history
git diff            # changes before staging
```

---

## Licence

MIT
