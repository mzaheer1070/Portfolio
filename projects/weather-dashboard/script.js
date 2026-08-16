console.info('Weather Dashboard build: open-meteo-4');

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const locationBtn = document.getElementById('locationBtn');
const weatherDashboard = document.getElementById('weatherDashboard');
const emptyState = document.getElementById('emptyState');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMessage = document.getElementById('errorMessage');
const forecastContainer = document.getElementById('forecastContainer');

const conditionInfo = {
  0: ['Clear', '☀️', 'sun'], 1: ['Mainly clear', '🌤️', 'sun'], 2: ['Partly cloudy', '⛅', 'clouds'],
  3: ['Overcast', '☁️', 'clouds'], 45: ['Fog', '🌫️', 'fog'], 48: ['Rime fog', '🌫️', 'fog'],
  51: ['Light drizzle', '🌦️', 'drizzle'], 53: ['Drizzle', '🌦️', 'drizzle'], 55: ['Heavy drizzle', '🌧️', 'rain'],
  56: ['Freezing drizzle', '🌧️', 'rain'], 57: ['Heavy freezing drizzle', '🌧️', 'rain'],
  61: ['Light rain', '🌦️', 'rain'], 63: ['Rain', '🌧️', 'rain'], 65: ['Heavy rain', '🌧️', 'rain'],
  66: ['Freezing rain', '🌧️', 'rain'], 67: ['Heavy freezing rain', '🌧️', 'rain'],
  71: ['Light snow', '❄️', 'snow'], 73: ['Snow', '❄️', 'snow'], 75: ['Heavy snow', '❄️', 'snow'],
  77: ['Snow grains', '❄️', 'snow'], 80: ['Rain showers', '🌦️', 'rain'], 81: ['Heavy showers', '🌧️', 'rain'],
  82: ['Violent showers', '🌧️', 'rain'], 85: ['Snow showers', '❄️', 'snow'], 86: ['Heavy snow showers', '❄️', 'snow'],
  95: ['Thunderstorm', '⛈️', 'thunder'], 96: ['Thunderstorm with hail', '⛈️', 'thunder'], 99: ['Severe thunderstorm', '⛈️', 'thunder']
};
function condition(code) { return conditionInfo[code] || ['Unknown conditions', '🌤️', 'clouds']; }

searchBtn.addEventListener('click', function () { const city = searchInput.value.trim(); if (city) findCity(city); });
searchInput.addEventListener('keydown', function (event) { if (event.key === 'Enter') { const city = searchInput.value.trim(); if (city) findCity(city); } });
locationBtn.addEventListener('click', useLocation);

async function findCity(city) {
  try {
    showLoading(true); clearError();
    const response = await fetch(GEOCODING_URL + '?name=' + encodeURIComponent(city) + '&count=1&language=en&format=json');
    const result = await response.json();
    if (!response.ok || !result.results || !result.results.length) throw new Error('City not found');
    const place = result.results[0];
    await loadWeather(place.latitude, place.longitude, place.name, place.country_code || '');
  } catch (error) { showLoading(false); showError(error.message); }
}

function useLocation() {
  if (!navigator.geolocation) return showError('Geolocation is not supported by your browser.');
  showLoading(true); clearError();
  navigator.geolocation.getCurrentPosition(async function (position) {
    try {
      const latitude = position.coords.latitude, longitude = position.coords.longitude;
      const response = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + latitude + '&lon=' + longitude + '&zoom=10&addressdetails=1');
      const result = await response.json();
      const address = result.address || {};
      const rawCity = address.city || address.town || address.village || address.municipality || address.county || result.display_name || 'Your location';
      // GPS services often return administrative names such as "Faisalabad City Tehsil".
      const city = rawCity.replace(/\\s+(City\\s+)?Tehsil$/i, '').replace(/\\s+District$/i, '');
      const country = address.country_code ? address.country_code.toUpperCase() : '';
      await loadWeather(latitude, longitude, city, country);
    } catch (error) { await loadWeather(position.coords.latitude, position.coords.longitude, 'Your location', ''); }
  }, function () { showLoading(false); showError('Location access was denied. Search for a city instead.'); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 });
}

async function loadWeather(latitude, longitude, city, country) {
  const parameters = new URLSearchParams({
    latitude: latitude, longitude: longitude, timezone: 'auto', forecast_days: '10',
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,visibility,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,uv_index_max'
  });
  const response = await fetch(FORECAST_URL + '?' + parameters.toString());
  if (!response.ok) throw new Error('Weather service is temporarily unavailable.');
  const data = await response.json();
  displayWeather(data, city, country);
  displayForecast(data.daily);
  const details = condition(data.current.weather_code);
  const scene = data.current.is_day ? details[2] : 'night';
  document.body.dataset.scene = scene;
  document.body.classList.toggle('windy', data.current.wind_speed_10m >= 28);
  activeSoundScene = scene;
  refreshAmbientSound();
  updateMap(latitude, longitude, city);
  updateMapInsights(data.current);
  showLoading(false); showDashboard();
}

function displayWeather(data, city, country) {
  const now = data.current, daily = data.daily, details = condition(now.weather_code);
  document.getElementById('cityName').textContent = city + (country ? ', ' + country : '');
  document.getElementById('currentDate').textContent = new Date(now.time).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('temperature').textContent = Math.round(now.temperature_2m) + '°C';
  document.getElementById('weatherIcon').textContent = details[1];
  document.getElementById('weatherDescription').textContent = details[0];
  document.getElementById('feelsLike').textContent = Math.round(now.apparent_temperature) + '°C';
  document.getElementById('humidity').textContent = now.relative_humidity_2m + '%';
  document.getElementById('windSpeed').textContent = Math.round(now.wind_speed_10m) + ' km/h';
  document.getElementById('pressure').textContent = Math.round(now.pressure_msl) + ' hPa';
  document.getElementById('visibility').textContent = (now.visibility / 1000).toFixed(1) + ' km';
  document.getElementById('sunrise').textContent = formatClock(daily.sunrise[0]);
  document.getElementById('sunset').textContent = formatClock(daily.sunset[0]);
  document.getElementById('cloudCover').textContent = now.cloud_cover + '%';
  document.getElementById('precipitation').textContent = now.precipitation.toFixed(1) + ' mm/h';
}

function displayForecast(daily) {
  forecastContainer.innerHTML = '';
  daily.time.slice(0, 8).forEach(function (date, index) {
    const details = condition(daily.weather_code[index]);
    const card = document.createElement('div'); card.className = 'forecast-card';
    const label = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    card.innerHTML = '<div class="forecast-date">' + label + '</div><div class="forecast-icon">' + details[1] + '</div><div class="forecast-temp">' + Math.round((daily.temperature_2m_max[index] + daily.temperature_2m_min[index]) / 2) + '°C</div><div class="forecast-temp-range">' + Math.round(daily.temperature_2m_max[index]) + '° / ' + Math.round(daily.temperature_2m_min[index]) + '° · 💧 ' + Math.round(daily.precipitation_probability_max[index] || 0) + '%</div>';
    forecastContainer.appendChild(card);
  });
}

function updateMapInsights(now) {
  document.getElementById('mapCloud').textContent = now.cloud_cover + '%';
  document.getElementById('mapRain').textContent = now.precipitation.toFixed(1) + ' mm/h';
  document.getElementById('mapWind').textContent = Math.round(now.wind_speed_10m) + ' km/h';
  document.getElementById('mapVisibility').textContent = (now.visibility / 1000).toFixed(1) + ' km';
}
function formatClock(value) { return new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); }
function showLoading(show) { loadingSpinner.classList.toggle('hidden', !show); }
function showDashboard() { weatherDashboard.classList.remove('hidden'); emptyState.classList.add('hidden'); }
function showError(message) { errorMessage.textContent = message; errorMessage.classList.add('show'); setTimeout(clearError, 5000); }
function clearError() { errorMessage.classList.remove('show'); errorMessage.textContent = ''; }

let weatherMap, locationMarker;
function updateMap(latitude, longitude, city) {
  if (!window.L) return;
  if (!weatherMap) {
    weatherMap = L.map('weatherMap', { zoomControl: true }).setView([latitude, longitude], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap contributors' }).addTo(weatherMap);
  } else weatherMap.setView([latitude, longitude], 8);
  if (locationMarker) locationMarker.remove();
  locationMarker = L.marker([latitude, longitude]).addTo(weatherMap).bindPopup(city).openPopup();
  setTimeout(function () { weatherMap.invalidateSize(); }, 150);
}

function createParticles() {
  const stars = document.getElementById('stars'), clouds = document.getElementById('clouds'), rain = document.getElementById('rain'), snow = document.getElementById('snow'), wind = document.getElementById('wind');
  for (let i = 0; i < 70; i++) { const el = document.createElement('span'); el.className = 'star'; el.style.left = Math.random() * 100 + '%'; el.style.top = Math.random() * 70 + '%'; el.style.animationDelay = Math.random() * 4 + 's'; stars.appendChild(el); }
  for (let i = 0; i < 8; i++) { const el = document.createElement('div'); el.className = 'cloud cloud-' + (i % 4 + 1); el.style.top = 6 + i * 9 + '%'; el.style.animationDuration = 28 + i * 8 + 's'; el.style.animationDelay = -i * 6 + 's'; clouds.appendChild(el); }
  for (let i = 0; i < 90; i++) { const el = document.createElement('span'); el.className = 'drop'; el.style.left = Math.random() * 100 + '%'; el.style.animationDuration = .45 + Math.random() * .55 + 's'; el.style.height = 12 + Math.random() * 18 + 'px'; rain.appendChild(el); }
  for (let i = 0; i < 55; i++) { const el = document.createElement('span'); el.className = 'flake'; el.style.left = Math.random() * 100 + '%'; el.style.animationDuration = 6 + Math.random() * 8 + 's'; snow.appendChild(el); }
  for (let i = 0; i < 24; i++) { const el = document.createElement('span'); el.className = 'gust'; el.style.top = Math.random() * 100 + '%'; el.style.width = 80 + Math.random() * 160 + 'px'; el.style.animationDuration = 1.4 + Math.random() * 2.2 + 's'; wind.appendChild(el); }
}

let audioContext, ambienceGain, birdTimer, thunderTimer, ambienceTimer, activeSources = [];
let activeSoundScene = 'idle';

function stopAmbientSound() {
  [birdTimer, thunderTimer, ambienceTimer].forEach(function (timer) { if (timer) clearInterval(timer); });
  birdTimer = thunderTimer = ambienceTimer = null;
  activeSources.forEach(function (source) { try { source.stop(); } catch {} });
  activeSources = [];
  if (ambienceGain) ambienceGain.disconnect();
  ambienceGain = null;
}
function playNoiseLayer(duration, frequency, volume) {
  if (!audioContext || !ambienceGain) return;
  const buffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (0.65 + Math.random() * .35);
  const source = audioContext.createBufferSource(), filter = audioContext.createBiquadFilter(), gain = audioContext.createGain();
  source.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = .55; gain.gain.value = volume;
  source.connect(filter).connect(gain).connect(ambienceGain); source.start(); activeSources.push(source);
  source.addEventListener('ended', function () { activeSources = activeSources.filter(function (item) { return item !== source; }); });
}
function chirp() {
  if (!audioContext || !ambienceGain) return;
  const oscillator = audioContext.createOscillator(), gain = audioContext.createGain(), now = audioContext.currentTime;
  oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(1200 + Math.random() * 800, now); oscillator.frequency.exponentialRampToValueAtTime(2200 + Math.random() * 1100, now + .16);
  gain.gain.setValueAtTime(.028, now); gain.gain.exponentialRampToValueAtTime(.001, now + .28);
  oscillator.connect(gain).connect(ambienceGain); oscillator.start(); oscillator.stop(now + .3);
}
function thunderRumble() {
  if (!audioContext || !ambienceGain) return;
  const oscillator = audioContext.createOscillator(), gain = audioContext.createGain(), now = audioContext.currentTime;
  oscillator.type = 'sawtooth'; oscillator.frequency.setValueAtTime(42 + Math.random() * 35, now); oscillator.frequency.exponentialRampToValueAtTime(25, now + 2.4);
  gain.gain.setValueAtTime(.045, now); gain.gain.exponentialRampToValueAtTime(.001, now + 2.5);
  oscillator.connect(gain).connect(ambienceGain); oscillator.start(); oscillator.stop(now + 2.6);
}
function startAmbientSound() {
  audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
  ambienceGain = audioContext.createGain(); ambienceGain.gain.value = .75; ambienceGain.connect(audioContext.destination);
  if (activeSoundScene === 'sun') { chirp(); birdTimer = setInterval(chirp, 950 + Math.random() * 1400); return; }
  const profile = activeSoundScene === 'wind' ? [420, .045] : activeSoundScene === 'thunder' ? [300, .035] : [1550, .05];
  const play = function () { playNoiseLayer(5 + Math.random() * 4, profile[0] + Math.random() * 250, profile[1]); };
  play(); ambienceTimer = setInterval(play, 5200);
  if (activeSoundScene === 'thunder') { thunderRumble(); thunderTimer = setInterval(thunderRumble, 6000 + Math.random() * 6500); }
}
function refreshAmbientSound() { if (!ambienceGain) return; stopAmbientSound(); startAmbientSound(); }
document.getElementById('soundToggle').addEventListener('click', function () {
  const button = document.getElementById('soundToggle');
  if (ambienceGain) { stopAmbientSound(); button.textContent = '🔇 Ambient sound off'; button.setAttribute('aria-pressed', 'false'); return; }
  startAmbientSound();
  const labels = { sun: 'Birds on', rain: 'Rain sound on', drizzle: 'Rain sound on', wind: 'Wind sound on', thunder: 'Thunder sound on' };
  button.textContent = '🔊 ' + (labels[activeSoundScene] || 'Ambient sound on'); button.setAttribute('aria-pressed', 'true');
});

// Respect the visitor's saved appearance preference.
const themeToggle = document.getElementById('themeToggle');
function setTheme(theme) { document.body.dataset.theme = theme; const light = theme === 'light'; themeToggle.textContent = light ? '🌙 Dark mode' : '☀️ Light mode'; themeToggle.setAttribute('aria-pressed', String(light)); localStorage.setItem('weather-theme', theme); }
setTheme(localStorage.getItem('weather-theme') || 'dark');
themeToggle.addEventListener('click', function () { setTheme(document.body.dataset.theme === 'light' ? 'dark' : 'light'); });

createParticles();