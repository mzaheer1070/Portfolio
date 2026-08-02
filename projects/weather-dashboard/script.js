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

        // Display data
        displayWeather(weatherData, name, country);
        displayForecast(forecastData);

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
        displayWeather(weatherData, cityName, countryCode);
        displayForecast(forecastData);

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
}

// Display 5-Day Forecast
function displayForecast(data) {
    const forecasts = {};

    // Group forecasts by day
    data.list.forEach(item => {
        const date = new Date(item.dt * 1000).toLocaleDateString();
        if (!forecasts[date]) {
            forecasts[date] = [];
        }
        forecasts[date].push(item);
    });

    // Get unique days (every 24 hours)
    const days = Object.keys(forecasts).slice(0, 5);

    forecastContainer.innerHTML = '';

    days.forEach(date => {
        const dayForecasts = forecasts[date];
        const middleIndex = Math.floor(dayForecasts.length / 2);
        const forecast = dayForecasts[middleIndex];

        const main = forecast.main;
        const weather = forecast.weather[0];
        const icon = weatherIcons[weather.main] || '🌤️';

        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.innerHTML = `
            <div class="forecast-date">${new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
            <div class="forecast-icon">${icon}</div>
            <div class="forecast-temp">${Math.round(main.temp)}°C</div>
            <div class="forecast-temp-range">
                ${Math.round(main.temp_max)}° / ${Math.round(main.temp_min)}°
            </div>
        `;

        forecastContainer.appendChild(card);
    });
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
showEmpty();