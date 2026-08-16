console.info('Weather Dashboard build: forecast-fix2');
// Weather API Configuration
const API_KEY = '6fe4a62464026753c081e103b5dfaf96';
const BASE_URL = 'https://api.openweathermap.org';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const locationBtn = document.getElementById('locationBtn');
const weatherDashboard = document.getElementById('weatherDashboard');
const emptyState = document.getElementById('emptyState');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMessage = document.getElementById('errorMessage');
const forecastContainer = document.getElementById('forecastContainer');

// Weather Icon Mapping
const weatherIcons = {
    'Clear': '☀️',
    'Clouds': '☁️',
    'Rain': '🌧️',
    'Drizzle': '🌦️',
    'Thunderstorm': '⛈️',
    'Snow': '❄️',
    'Mist': '🌫️',
    'Smoke': '💨',
    'Haze': '🌫️',
    'Dust': '🌪️',
    'Fog': '🌫️',
    'Sand': '🌪️',
    'Ash': '💨',
    'Squall': '💨',
    'Tornado': '🌪️'
};

// Event Listeners
searchBtn.addEventListener('click', () => {
    const city = searchInput.value.trim();
    if (city) {
        fetchWeather(city);
    }
});

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const city = searchInput.value.trim();
        if (city) {
            fetchWeather(city);
        }
    }
});

locationBtn.addEventListener('click', getLocationWeather);

// Fetch Weather Data
async function fetchWeather(city) {
    try {
        showLoading(true);
        clearError();

        // Get coordinates from city name
        const geoResponse = await fetch(
            `${BASE_URL}/geo/1.0/direct?q=${city}&limit=1&appid=${API_KEY}`
        );

        if (!geoResponse.ok) {
            throw new Error('City not found');
        }

        const geoData = await geoResponse.json();

        if (geoData.length === 0) {
            throw new Error('City not found');
        }

        const { lat, lon, name, country } = geoData[0];

        // Get weather data
        const weatherResponse = await fetch(
            `${BASE_URL}/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
        );

        if (!weatherResponse.ok) {
            throw new Error('Failed to fetch weather data');
        }

        const weatherData = await weatherResponse.json();

        // Get forecast data
        const forecastResponse = await fetch(
            `${BASE_URL}/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
        );

        if (!forecastResponse.ok) {
            throw new Error('Failed to fetch forecast data');
        }

        const forecastData = await forecastResponse.json();

        // Request extended forecast when the account supports One Call 3.0.
        const extendedForecast = await fetchExtendedForecast(lat, lon);

        // Display data
        displayWeather(weatherData, name, country);
        displayForecast(extendedForecast || forecastData);
        applyWeatherAtmosphere(weatherData);
        updateMap(lat, lon);

        showLoading(false);
        showDashboard();

    } catch (error) {
        showLoading(false);
        showError(error.message);
    }
}

// Get Weather by Geolocation
function getLocationWeather() {
    console.log('🔍 Location button clicked');
    
    if (!navigator.geolocation) {
        console.error('❌ Geolocation not supported');
        showError('❌ Geolocation is not supported by your browser. Please search for a city instead.');
        return;
    }

    showLoading(true);
    showError('📍 Requesting your location... Please allow location access in the permission popup.');
    
    console.log('📍 Starting geolocation request with high accuracy...');
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            console.log('✅ Position success callback triggered');
            console.log('Position object:', position);
            
            const { latitude, longitude, accuracy } = position.coords;
            console.log(`✅ Location received - Lat: ${latitude}, Lon: ${longitude}, Accuracy: ${accuracy}m`);
            
            // Use OpenWeatherMap reverse geocoding (more accurate)
            reverseGeocodeAndFetchWeather(latitude, longitude);
        },
        (error) => {
            console.error('❌ Position error callback triggered');
            console.error('Geolocation error:', error);
            console.error('Error code:', error.code);
            
            showLoading(false);
            
            let errorMsg = '❌ Unable to get your location. ';
            
            if (error.code === 1) { // PERMISSION_DENIED
                errorMsg = '🔒 Permission denied! Please enable location access in your browser settings and try again.';
            } else if (error.code === 2) { // POSITION_UNAVAILABLE
                errorMsg = '📍 Location information unavailable. Please ensure location services are enabled on your device.';
            } else if (error.code === 3) { // TIMEOUT
                errorMsg = '⏱️ Location request timed out. Please try again or search for a city.';
            } else {
                errorMsg += 'Please search for a city instead.';
            }
            
            showError(errorMsg);
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        }
    );
}

// Reverse Geocode using OpenWeatherMap and fetch weather
async function reverseGeocodeAndFetchWeather(lat, lon) {
    try {
        console.log(`🌤️ Fetching weather for coordinates: ${lat}, ${lon}`);
        
        // Use OpenWeatherMap reverse geocoding (more accurate than Nominatim)
        console.log('📍 Getting city name from coordinates using OpenWeatherMap...');
        const geoUrl = `${BASE_URL}/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`;
        const geoResponse = await fetch(geoUrl);

        if (!geoResponse.ok) {
            throw new Error(`Failed to get location name: ${geoResponse.status}`);
        }

        const geoData = await geoResponse.json();

        if (geoData.length === 0) {
            throw new Error('Location not found');
        }

        const cityName = geoData[0].name;
        const countryCode = geoData[0].country || 'PK';

        console.log(`🏙️ City from OpenWeatherMap: ${cityName}, ${countryCode}`);

        // Now fetch weather
        console.log(`📡 Fetching weather from OpenWeatherMap...`);
        const weatherUrl = `${BASE_URL}/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
        const weatherResponse = await fetch(weatherUrl);

        if (!weatherResponse.ok) {
            throw new Error(`Failed to fetch weather data: ${weatherResponse.status}`);
        }

        const weatherData = await weatherResponse.json();
        console.log('✅ Weather API Response received:');
        console.log('   API City:', weatherData.name);
        console.log('   API Country:', weatherData.sys.country);

        // Get forecast data
        const forecastUrl = `${BASE_URL}/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
        const forecastResponse = await fetch(forecastUrl);

        if (!forecastResponse.ok) {
            throw new Error('Failed to fetch forecast data');
        }

        const forecastData = await forecastResponse.json();

        // Display data
        console.log(`📍 Displaying weather for: ${cityName}, ${countryCode}`);
        const extendedForecast = await fetchExtendedForecast(lat, lon);
        displayWeather(weatherData, cityName, countryCode);
        displayForecast(extendedForecast || forecastData);
        applyWeatherAtmosphere(weatherData);
        updateMap(lat, lon);

        showLoading(false);
        showDashboard();
        clearError();

    } catch (error) {
        console.error('Error in reverseGeocodeAndFetchWeather:', error);
        showLoading(false);
        showError('❌ Error fetching weather: ' + error.message + '. Please try searching for a city instead.');
    }
}

// Display Current Weather
function displayWeather(data, city, country) {
    const { main, weather, wind, clouds, sys, visibility } = data;
    const weatherMain = weather[0].main;
    const icon = weatherIcons[weatherMain] || '🌤️';

    // Update DOM
    document.getElementById('cityName').textContent = `${city}, ${country}`;
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    document.getElementById('temperature').textContent = `${Math.round(main.temp)}°C`;
    document.getElementById('weatherIcon').textContent = icon;
    document.getElementById('weatherDescription').textContent = weather[0].description;
    document.getElementById('feelsLike').textContent = `${Math.round(main.feels_like)}°C`;
    document.getElementById('humidity').textContent = `${main.humidity}%`;
    document.getElementById('windSpeed').textContent = `${wind.speed} m/s`;
    document.getElementById('pressure').textContent = `${main.pressure} hPa`;
    document.getElementById('visibility').textContent = `${(visibility / 1000).toFixed(1)} km`;
    document.getElementById('sunrise').textContent = formatTime(sys.sunrise);
    document.getElementById('sunset').textContent = formatTime(sys.sunset);
    document.getElementById('cloudCover').textContent = `${clouds?.all ?? 0}%`;
    const rainMm = data.rain?.['1h'] ?? data.snow?.['1h'] ?? 0;
    document.getElementById('precipitation').textContent = `${rainMm.toFixed(1)} mm/h`;
}

// Display daily forecast (up to 8 days with One Call; otherwise 5-day fallback)
function displayForecast(data) {
    forecastContainer.innerHTML = '';
    if (data.daily) {
        data.daily.slice(0, 8).forEach(day => {
            const weather = day.weather[0];
            const card = document.createElement('div');
            card.className = 'forecast-card';
            card.innerHTML = `<div class="forecast-date">${new Date(day.dt * 1000).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div><div class="forecast-icon">${weatherIcons[weather.main] || '🌤️'}</div><div class="forecast-temp">${Math.round(day.temp.day)}°C</div><div class="forecast-temp-range">${Math.round(day.temp.max)}° / ${Math.round(day.temp.min)}° · 💧 ${Math.round((day.pop || 0) * 100)}%</div>`;
            forecastContainer.appendChild(card);
        });
        return;
    }
    const timezone = data.city?.timezone || 0;
    const forecasts = {};
    data.list.forEach(item => {
        // A stable ISO key avoids parsing localized date strings such as 16/08/2026.
        const dateKey = new Date((item.dt + timezone) * 1000).toISOString().slice(0, 10);
        (forecasts[dateKey] ||= []).push(item);
    });

    Object.values(forecasts).slice(0, 5).forEach(items => {
        const forecast = items[Math.floor(items.length / 2)];
        const weather = forecast.weather[0];
        const displayDate = new Date((forecast.dt + timezone) * 1000);
        const low = Math.min(...items.map(item => item.main.temp_min));
        const high = Math.max(...items.map(item => item.main.temp_max));
        const chanceOfRain = Math.max(...items.map(item => item.pop || 0));
        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.innerHTML =
            '<div class="forecast-date">' + displayDate.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }) + '</div>' +
            '<div class="forecast-icon">' + (weatherIcons[weather.main] || '🌤️') + '</div>' +
            '<div class="forecast-temp">' + Math.round(forecast.main.temp) + '°C</div>' +
            '<div class="forecast-temp-range">' + Math.round(high) + '° / ' + Math.round(low) + '° · 💧 ' + Math.round(chanceOfRain * 100) + '%</div>';
        forecastContainer.appendChild(card);
    });
}

function applyWeatherAtmosphere(data) {
    const weatherMain = data.weather?.[0]?.main || 'Clear';
    const windSpeed = data.wind?.speed || 0;
    const now = Math.floor(Date.now() / 1000);
    const isNight = data.sys
        ? now < data.sys.sunrise || now > data.sys.sunset
        : false;

    let scene = 'clouds';

    switch (weatherMain) {
        case 'Clear':
            scene = isNight ? 'night' : 'sun';
            break;
        case 'Clouds':
            scene = 'clouds';
            break;
        case 'Rain':
            scene = 'rain';
            break;
        case 'Drizzle':
            scene = 'drizzle';
            break;
        case 'Thunderstorm':
            scene = 'thunder';
            break;
        case 'Snow':
            scene = 'snow';
            break;
        case 'Mist':
        case 'Fog':
        case 'Haze':
        case 'Smoke':
            scene = 'fog';
            break;
        case 'Dust':
        case 'Sand':
        case 'Ash':
        case 'Squall':
        case 'Tornado':
            scene = 'wind';
            break;
        default:
            scene = 'clouds';
    }

    document.body.dataset.scene = scene;
    document.body.classList.toggle('windy', windSpeed >= 8);
}

function createParticles() {
    const stars = document.getElementById('stars');
    const clouds = document.getElementById('clouds');
    const rain = document.getElementById('rain');
    const snow = document.getElementById('snow');
    const wind = document.getElementById('wind');

    if (!stars || stars.childElementCount) return;

    for (let i = 0; i < 70; i += 1) {
        const star = document.createElement('span');
        star.className = 'star';
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 70}%`;
        star.style.animationDelay = `${Math.random() * 4}s`;
        star.style.animationDuration = `${2 + Math.random() * 3}s`;
        stars.appendChild(star);
    }

    for (let i = 0; i < 8; i += 1) {
        const cloud = document.createElement('div');
        cloud.className = `cloud cloud-${(i % 4) + 1}`;
        cloud.style.top = `${6 + (i * 9)}%`;
        cloud.style.animationDuration = `${28 + i * 8}s`;
        cloud.style.animationDelay = `${-i * 6}s`;
        cloud.style.opacity = `${0.35 + (i % 3) * 0.15}`;
        clouds.appendChild(cloud);
    }

    for (let i = 0; i < 90; i += 1) {
        const drop = document.createElement('span');
        drop.className = 'drop';
        drop.style.left = `${Math.random() * 100}%`;
        drop.style.animationDuration = `${0.45 + Math.random() * 0.55}s`;
        drop.style.animationDelay = `${Math.random() * 2}s`;
        drop.style.height = `${12 + Math.random() * 18}px`;
        rain.appendChild(drop);
    }

    for (let i = 0; i < 55; i += 1) {
        const flake = document.createElement('span');
        flake.className = 'flake';
        flake.style.left = `${Math.random() * 100}%`;
        flake.style.animationDuration = `${6 + Math.random() * 8}s`;
        flake.style.animationDelay = `${Math.random() * 6}s`;
        flake.style.width = flake.style.height = `${3 + Math.random() * 6}px`;
        snow.appendChild(flake);
    }

    for (let i = 0; i < 24; i += 1) {
        const streak = document.createElement('span');
        streak.className = 'gust';
        streak.style.top = `${Math.random() * 100}%`;
        streak.style.animationDuration = `${1.4 + Math.random() * 2.2}s`;
        streak.style.animationDelay = `${Math.random() * 3}s`;
        streak.style.width = `${80 + Math.random() * 160}px`;
        wind.appendChild(streak);
    }
}

// Format Time
function formatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// UI Helper Functions
function showLoading(show) {
    loadingSpinner.classList.toggle('hidden', !show);
}

function showDashboard() {
    weatherDashboard.classList.remove('hidden');
    emptyState.classList.add('hidden');
}

function showEmpty() {
    weatherDashboard.classList.add('hidden');
    emptyState.classList.remove('hidden');
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add('show');
    showEmpty();
    setTimeout(() => {
        errorMessage.classList.remove('show');
    }, 5000);
}

function clearError() {
    errorMessage.classList.remove('show');
    errorMessage.textContent = '';
}

// Initialize
createParticles();
showEmpty();

// One Call is optional: the free 5-day forecast remains available if the account has not enabled it.
async function fetchExtendedForecast(lat, lon) {
    try {
        const response = await fetch(`${BASE_URL}/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly,alerts&appid=${API_KEY}&units=metric`);
        return response.ok ? await response.json() : null;
    } catch { return null; }
}

let weatherMap, weatherLayer, activeMapLayer = 'precipitation_new';
function updateMap(lat, lon) {
    if (!window.L) return;
    if (!weatherMap) {
        weatherMap = L.map('weatherMap', { zoomControl: true }).setView([lat, lon], 8);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap contributors' }).addTo(weatherMap);
        document.querySelectorAll('.map-layer-btn').forEach(button => button.addEventListener('click', () => {
            activeMapLayer = button.dataset.layer;
            document.querySelectorAll('.map-layer-btn').forEach(item => item.classList.toggle('active', item === button));
            addWeatherLayer();
        }));
    } else { weatherMap.setView([lat, lon], 8); }
    addWeatherLayer();
    setTimeout(() => weatherMap.invalidateSize(), 150);
}
function addWeatherLayer() {
    if (weatherLayer) weatherMap.removeLayer(weatherLayer);
    weatherLayer = L.tileLayer(`https://tile.openweathermap.org/map/${activeMapLayer}/{z}/{x}/{y}.png?appid=${API_KEY}`, { opacity: .66, maxZoom: 18 });
    weatherLayer.addTo(weatherMap);
}

// Synthesised ambience avoids large media files. It starts only after a deliberate click.
let audioContext, ambienceNode, ambienceGain;
document.getElementById('soundToggle').addEventListener('click', () => {
    const button = document.getElementById('soundToggle');
    if (ambienceGain) { ambienceGain.disconnect(); ambienceGain = null; ambienceNode?.stop(); ambienceNode = null; button.textContent = '🔇 Ambient sound off'; button.setAttribute('aria-pressed', 'false'); return; }
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate);
    const channel = buffer.getChannelData(0); for (let i = 0; i < channel.length; i += 1) channel[i] = Math.random() * 2 - 1;
    ambienceNode = audioContext.createBufferSource(); ambienceNode.buffer = buffer; ambienceNode.loop = true;
    const filter = audioContext.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 850;
    ambienceGain = audioContext.createGain(); ambienceGain.gain.value = .045;
    ambienceNode.connect(filter).connect(ambienceGain).connect(audioContext.destination); ambienceNode.start();
    button.textContent = '🔊 Ambient sound on'; button.setAttribute('aria-pressed', 'true');
});
