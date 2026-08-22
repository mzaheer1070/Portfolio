(() => {
    'use strict';

    const API = {
        geo: 'https://geocoding-api.open-meteo.com/v1/search',
        weather: 'https://api.open-meteo.com/v1/forecast'
    };

    const CACHE_KEY = 'weather-dashboard-cache-v1';
    const $ = id => document.getElementById(id);

    const dom = {
        body: document.body,
        input: $('searchInput'),
        search: $('searchBtn'),
        location: $('locationBtn'),
        dashboard: $('weatherDashboard'),
        empty: $('emptyState'),
        loading: $('loadingSpinner'),
        error: $('errorMessage'),
        forecast: $('forecastContainer'),
        theme: $('themeToggle'),
        mapSection: $('mapSection')
    };

    const conditions = {
        0: ['Clear', '☀️', 'sun'],
        1: ['Mainly clear', '🌤️', 'sun'],
        2: ['Partly cloudy', '⛅', 'clouds'],
        3: ['Overcast', '☁️', 'clouds'],
        45: ['Fog', '🌫️', 'fog'],
        48: ['Rime fog', '🌫️', 'fog'],
        51: ['Light drizzle', '🌦️', 'drizzle'],
        53: ['Drizzle', '🌦️', 'drizzle'],
        55: ['Heavy drizzle', '🌧️', 'rain'],
        61: ['Light rain', '🌦️', 'rain'],
        63: ['Rain', '🌧️', 'rain'],
        65: ['Heavy rain', '🌧️', 'rain'],
        71: ['Light snow', '❄️', 'snow'],
        73: ['Snow', '❄️', 'snow'],
        75: ['Heavy snow', '❄️', 'snow'],
        80: ['Rain showers', '🌦️', 'rain'],
        81: ['Heavy showers', '🌧️', 'rain'],
        82: ['Violent showers', '🌧️', 'rain'],
        95: ['Thunderstorm', '⛈️', 'thunder'],
        96: ['Thunderstorm with hail', '⛈️', 'thunder'],
        99: ['Severe thunderstorm', '⛈️', 'thunder']
    };

    let locationLocked = false;
    let mapLoading = false;
    let hourlyMode = true;
    let lastWeatherData = null;
    let activeRequest = null;

    function condition(code) {
        return conditions[code] || ['Unknown conditions', '🌤️', 'clouds'];
    }

    function setText(id, value) {
        const element = $(id);
        if (element) element.textContent = value;
    }

    function animateNumber(id, target, formatter = value => String(Math.round(value))) {
        const element = $(id);
        const numericTarget = Number(target);

        if (!element || !Number.isFinite(numericTarget)) return;

        const start = Number(element.dataset.value || 0);
        const startTime = performance.now();
        element.dataset.value = String(numericTarget);

        function frame(now) {
            const progress = Math.min((now - startTime) / 600, 1);
            const eased = 1 - Math.pow(1 - progress, 3);

            element.textContent = formatter(
                start + (numericTarget - start) * eased
            );

            if (progress < 1) requestAnimationFrame(frame);
        }

        requestAnimationFrame(frame);
    }

    function setLoading(value) {
        dom.loading.classList.toggle('hidden', !value);
    }

    function showError(message) {
        dom.error.textContent = message;
        dom.error.classList.add('show');
    }

    async function getJson(url, signal) {
        const response = await fetch(url, { signal });

        if (!response.ok) {
            throw new Error('Weather service is unavailable.');
        }

        return response.json();
    }

    function cacheKey(latitude, longitude) {
        return `${Number(latitude).toFixed(3)},${Number(longitude).toFixed(3)}`;
    }

    function readCache() {
        try {
            return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
        } catch {
            return [];
        }
    }

    function writeCache(entry) {
        try {
            const cache = readCache().filter(item => item.key !== entry.key);

            cache.unshift({
                ...entry,
                savedAt: Date.now()
            });

            localStorage.setItem(
                CACHE_KEY,
                JSON.stringify(cache.slice(0, 5))
            );
        } catch {
            // Local storage may be unavailable.
        }
    }

    function cachedWeather(latitude, longitude) {
        const item = readCache().find(entry =>
            entry.key === cacheKey(latitude, longitude)
        );

        return item && Date.now() - item.savedAt < 600000 ? item : null;
    }

    function clock(value) {
        return new Date(value).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function periodFromTime(value) {
        const hour = Number(String(value).split('T')[1]?.slice(0, 2));

        if (!Number.isFinite(hour) || hour < 6 || hour >= 20) return 'night';
        if (hour < 10) return 'morning';
        if (hour < 16) return 'noon';

        return 'sunset';
    }

    function celestialState(code, clouds) {
        if (![0, 1].includes(Number(code))) return 'hidden';
        if (clouds <= 10) return 'full';
        if (clouds <= 35) return 'partial';

        return 'hidden';
    }

    function weatherIcon(scene) {
        const cloud =
            '<path class="cloud-shape" d="M25 55h68a16 16 0 0 0 2-32 27 27 0 0 0-51-5A20 20 0 0 0 25 55Z"/>';

        const icons = {
            sun: '<svg class="weather-svg" viewBox="0 0 100 100"><circle class="sun-core" cx="50" cy="50" r="22"/><g class="sun-rays"><path d="M50 8v15M50 77v15M8 50h15M77 50h15M20 20l11 11M69 69l11 11M80 20L69 31M31 69L20 80"/></g></svg>',
            clouds: `<svg class="weather-svg" viewBox="0 0 120 90">${cloud}</svg>`,
            rain: `<svg class="weather-svg" viewBox="0 0 120 100">${cloud}<path class="rain-drops" d="m38 68-6 18m26-18-6 18m26-18-6 18"/></svg>`,
            drizzle: `<svg class="weather-svg" viewBox="0 0 120 100">${cloud}<path class="rain-drops" d="m42 70-3 10m20-10-3 10m20-10-3 10"/></svg>`,
            thunder: `<svg class="weather-svg" viewBox="0 0 120 105">${cloud}<path class="bolt" d="M62 57 46 82h13l-5 18 21-29H62Z"/></svg>`,
            snow: `<svg class="weather-svg" viewBox="0 0 120 100">${cloud}<g class="snowflakes"><circle cx="40" cy="75" r="4"/><circle cx="60" cy="84" r="4"/><circle cx="80" cy="75" r="4"/></g></svg>`
        };

        return icons[scene] || icons.clouds;
    }

    function weatherVibe(temperature, wind, rain, scene) {
        if (scene === 'thunder') return 'Stormy skies and deep rumbles — stay cozy indoors.';

        if (rain > 0 || ['rain', 'drizzle'].includes(scene)) {
            return wind > 20
                ? 'Rain and a lively breeze — a dramatic day for staying in.'
                : 'A gentle rainy atmosphere — perfect for a quiet moment.';
        }

        if (scene === 'snow') {
            return 'Quiet snowy air and a crisp chill — a beautiful winter scene.';
        }

        if (temperature >= 24) {
            return wind > 18
                ? 'Bright skies with a refreshing breeze — ideal for getting outside.'
                : 'Mostly sunny and warm — perfect for a walk.';
        }

        if (temperature >= 15) {
            return wind > 20
                ? 'Comfortable air with a noticeable breeze — layers will help.'
                : 'Mild weather and calm air — a lovely time to explore.';
        }

        return 'Cool, calm air — a warm layer will make the day comfortable.';
    }

    function clothingSuggestion(temperature, rain, scene) {
        if (['rain', 'drizzle', 'thunder'].includes(scene) || rain > 0.2) {
            return temperature < 16
                ? 'Waterproof jacket and an umbrella recommended.'
                : 'Umbrella needed — choose water-resistant shoes.';
        }

        if (scene === 'snow' || temperature <= 5) {
            return 'Warm coat, gloves, and insulated footwear recommended.';
        }

        if (temperature <= 12) return 'Light jacket recommended.';
        if (temperature <= 18) return 'A light layer should feel comfortable.';
        if (temperature >= 28) {
            return 'Breathable clothing recommended — stay hydrated.';
        }

        return 'Comfortable everyday clothing should be perfect.';
    }

    function renderHourlyTimeline(hourly) {
        const timeline = $('hourlyTimeline');

        if (!timeline || !hourly?.time?.length) return;

        timeline.replaceChildren();

        hourly.time.slice(0, 24).forEach((time, index) => {
            const details = condition(hourly.weather_code[index]);
            const card = document.createElement('article');

            card.className = 'hour-card';
            card.innerHTML = `
                <time datetime="${time}">
                    ${new Date(time).toLocaleTimeString('en-US', {
                        hour: 'numeric'
                    })}
                </time>
                <div class="hour-icon" aria-label="${details[0]}">${details[1]}</div>
                <strong class="hour-temp">
                    ${Math.round(hourly.temperature_2m[index])}°C
                </strong>
            `;

            timeline.appendChild(card);
        });
    }

    function updateHourlyVisibility() {
        const timeline = $('hourlyTimeline');
        const toggle = $('hourlyToggle');

        if (!timeline || !toggle) return;

        hourlyMode = toggle.checked;
        timeline.classList.toggle('hidden', !hourlyMode);

        if (hourlyMode && lastWeatherData?.hourly) {
            renderHourlyTimeline(lastWeatherData.hourly);
        }
    }

    function createPremiumFeatures() {
        if ($('weatherFeatures')) return;

        const features = document.createElement('section');

        features.id = 'weatherFeatures';
        features.className = 'glass-panel';
        features.innerHTML = `
            <div class="feature-grid">
                <article class="feature-card">
                    <p class="feature-label">WEATHER VIBE</p>
                    <p id="weatherVibe" class="feature-text"></p>
                </article>

                <article class="feature-card">
                    <p class="feature-label">WHAT TO WEAR</p>
                    <p id="wearSuggestion" class="feature-text"></p>
                </article>
            </div>

            <div class="feature-card hourly-feature">
                <div class="hourly-controls">
                    <div>
                        <p class="feature-label">WEATHER TIMELINE</p>
                        <h3 class="section-title">Hourly Forecast</h3>
                    </div>

                    <label class="forecast-switch">
                        <span>24 hours</span>
                        <input id="hourlyToggle" type="checkbox"
                            aria-label="Show hourly forecast" checked>
                    </label>
                </div>

                <div id="hourlyTimeline" class="hourly-timeline"></div>
            </div>
        `;

        const forecastSection = document.querySelector('.forecast-section');
        dom.dashboard.insertBefore(features, forecastSection);

        $('hourlyToggle').addEventListener(
            'change',
            updateHourlyVisibility
        );

        const fullscreen = document.createElement('button');

        fullscreen.id = 'fullscreenButton';
        fullscreen.type = 'button';
        fullscreen.className = 'fullscreen-button';
        fullscreen.textContent = '⛶ Cinematic mode';
        document.querySelector('.header-controls')?.appendChild(fullscreen);

        fullscreen.addEventListener('click', toggleFullscreen);

        document.addEventListener('fullscreenchange', () => {
            const active = Boolean(document.fullscreenElement);

            document.body.classList.toggle('cinematic-fullscreen', active);
            fullscreen.textContent = active
                ? '⛶ Exit cinematic mode'
                : '⛶ Cinematic mode';
        });
    }

    function renderFeatures(data, temperature, wind, rain, scene) {
        createPremiumFeatures();

        setText(
            'weatherVibe',
            weatherVibe(temperature, wind, rain, scene)
        );

        setText(
            'wearSuggestion',
            clothingSuggestion(temperature, rain, scene)
        );

        const timeline = $('hourlyTimeline');
        const toggle = $('hourlyToggle');

        if (timeline && toggle) {
            toggle.checked = hourlyMode;
            timeline.classList.toggle('hidden', !hourlyMode);

            if (hourlyMode) {
                renderHourlyTimeline(data.hourly);
            }
        }
    }

    function renderForecast(daily) {
        if (!daily?.time) return;

        dom.forecast.replaceChildren(
            ...daily.time.slice(0, 8).map((date, index) => {
                const details = condition(daily.weather_code[index]);
                const max = Math.round(daily.temperature_2m_max[index]);
                const min = Math.round(daily.temperature_2m_min[index]);
                const rain = Math.round(
                    daily.precipitation_probability_max[index] || 0
                );

                const card = document.createElement('article');

                card.className = 'forecast-card';
                card.innerHTML = `
                    <div>${new Date(`${date}T12:00:00`).toLocaleDateString(
                        'en-US',
                        {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                        }
                    )}</div>
                    <div class="forecast-icon">${details[1]}</div>
                    <div class="forecast-temp">
                        ${Math.round((max + min) / 2)}°C
                    </div>
                    <div class="forecast-temp-range">
                        ${max}° / ${min}° · 💧 ${rain}%
                    </div>
                `;

                return card;
            })
        );
    }

    async function searchCity(name) {
        activeRequest?.abort();
        activeRequest = new AbortController();

        try {
            setLoading(true);
            dom.error.classList.remove('show');

            const result = await getJson(
                `${API.geo}?name=${encodeURIComponent(name)}&count=1&language=en&format=json`,
                activeRequest.signal
            );

            if (!result.results?.length) {
                throw new Error('City not found.');
            }

            const place = result.results[0];

            await loadWeather(
                place.latitude,
                place.longitude,
                place.name,
                place.country_code?.toUpperCase() || '',
                activeRequest.signal
            );
        } catch (error) {
            if (error.name !== 'AbortError') showError(error.message);
        } finally {
            setLoading(false);
            activeRequest = null;
        }
    }

    async function loadWeather(
        latitude,
        longitude,
        city,
        country,
        signal
    ) {
        const cached = cachedWeather(latitude, longitude);

        if (cached) {
            renderWeather(
                cached.data,
                cached.city,
                cached.country,
                latitude,
                longitude
            );
            dom.dashboard.classList.remove('hidden');
            dom.empty.classList.add('hidden');
            return;
        }

        const params = new URLSearchParams({
            latitude,
            longitude,
            timezone: 'auto',
            forecast_days: 10,
            current: [
                'temperature_2m',
                'relative_humidity_2m',
                'apparent_temperature',
                'weather_code',
                'cloud_cover',
                'pressure_msl',
                'wind_speed_10m',
                'precipitation',
                'visibility',
                'is_day'
            ].join(','),
            hourly: 'temperature_2m,weather_code',
            daily: [
                'weather_code',
                'temperature_2m_max',
                'temperature_2m_min',
                'precipitation_probability_max',
                'sunrise',
                'sunset'
            ].join(',')
        });

        const data = await getJson(
            `${API.weather}?${params}`,
            signal
        );

        writeCache({
            key: cacheKey(latitude, longitude),
            data,
            city,
            country
        });

        renderWeather(data, city, country, latitude, longitude);
        dom.dashboard.classList.remove('hidden');
        dom.empty.classList.add('hidden');
    }

    function renderWeather(data, city, country, latitude, longitude) {
        const { current, daily } = data;
        const details = condition(current.weather_code);
        const temperature = Number(current.temperature_2m);
        const clouds = Number(current.cloud_cover ?? 100);
        const wind = Number(current.wind_speed_10m || 0);
        const visibility = Number(current.visibility || 0) / 1000;
        const rain = Number(current.precipitation || 0);
        const scene = details[2];

        lastWeatherData = data;

        dom.body.dataset.scene = scene;
        dom.body.dataset.daytime = Number(current.is_day) === 1
            ? 'day'
            : 'night';
        dom.body.dataset.period = periodFromTime(current.time);
        dom.body.dataset.celestial = celestialState(
            current.weather_code,
            clouds
        );
        dom.body.dataset.tempBand = temperature >= 24
            ? 'hot'
            : temperature <= 10
                ? 'cold'
                : 'mild';

        setText(
            'cityName',
            `${city}${country ? `, ${country}` : ''}`
        );

        setText(
            'currentDate',
            new Date(current.time).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })
        );

        const icon = $('weatherIcon');
        if (icon) icon.innerHTML = weatherIcon(scene);

        animateNumber(
            'temperature',
            temperature,
            value => `${Math.round(value)}°C`
        );

        animateNumber(
            'feelsLike',
            current.apparent_temperature,
            value => `${Math.round(value)}°C`
        );

        animateNumber(
            'humidity',
            current.relative_humidity_2m,
            value => `${Math.round(value)}%`
        );

        animateNumber(
            'windSpeed',
            wind,
            value => `${Math.round(value)} km/h`
        );

        animateNumber(
            'pressure',
            current.pressure_msl,
            value => `${Math.round(value)} hPa`
        );

        animateNumber(
            'visibility',
            visibility,
            value => `${value.toFixed(1)} km`
        );

        animateNumber(
            'cloudCover',
            clouds,
            value => `${Math.round(value)}%`
        );

        animateNumber(
            'precipitation',
            rain,
            value => `${value.toFixed(1)} mm/h`
        );

        setText('weatherDescription', details[0]);
        setText('sunrise', clock(daily.sunrise[0]));
        setText('sunset', clock(daily.sunset[0]));
        setText('mapCloud', `${Math.round(clouds)}%`);
        setText('mapRain', `${rain.toFixed(1)} mm/h`);
        setText('mapWind', `${Math.round(wind)} km/h`);
        setText('mapVisibility', `${visibility.toFixed(1)} km`);

        renderFeatures(data, temperature, wind, rain, scene);
        renderForecast(daily);

        document.dispatchEvent(new CustomEvent('weatherchange', {
            detail: {
                scene,
                daytime: dom.body.dataset.daytime,
                period: dom.body.dataset.period,
                celestial: dom.body.dataset.celestial,
                windSpeed: wind,
                precipitation: rain,
                weatherCode: Number(current.weather_code),
                cloudCover: clouds,
                latitude: Number(latitude),
                longitude: Number(longitude),
                city: `${city}${country ? `, ${country}` : ''}`
            }
        }));
    }

    function useLocation() {
        if (locationLocked) return;

        if (!navigator.geolocation) {
            showError('Geolocation is not supported.');
            return;
        }

        locationLocked = true;
        dom.location.disabled = true;
        dom.error.classList.remove('show');

        navigator.geolocation.getCurrentPosition(
            async position => {
                const { latitude, longitude } = position.coords;

                try {
                    setLoading(true);

                    await loadWeather(
                        latitude,
                        longitude,
                        'Your location',
                        ''
                    );

                    dom.dashboard.classList.remove('hidden');
                    dom.empty.classList.add('hidden');
                } catch (error) {
                    showError(error.message);
                } finally {
                    setLoading(false);
                    locationLocked = false;
                    dom.location.disabled = false;
                }
            },
            error => {
                locationLocked = false;
                dom.location.disabled = false;

                showError(
                    error.code === 1
                        ? 'Location access was denied. Please allow location permission.'
                        : 'Unable to determine your location.'
                );
            },
            {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 300000
            }
        );
    }

    async function toggleFullscreen() {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            } else {
                await document.documentElement.requestFullscreen();
            }
        } catch {
            document.body.classList.toggle('cinematic-fullscreen');
        }
    }

    function setTheme(theme) {
        dom.body.dataset.theme = theme;

        const light = theme === 'light';
        dom.theme.textContent = light
            ? '🌙 Dark mode'
            : '☀️ Light mode';
        dom.theme.setAttribute('aria-pressed', String(light));
    }

    function loadMapWhenVisible() {
        if (mapLoading || window.L) return;

        mapLoading = true;

        const leafletCss = document.createElement('link');
        leafletCss.rel = 'stylesheet';
        leafletCss.href =
            'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(leafletCss);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

        script.onload = () => {
            const cinematic = document.createElement('script');
            cinematic.src = 'js/cinematic.js';
            document.body.appendChild(cinematic);
        };

        document.body.appendChild(script);
    }

    dom.search.addEventListener('click', () => {
        const value = dom.input.value.trim();
        if (value) searchCity(value);
    });

    dom.input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            dom.search.click();
        }
    });

    dom.location.addEventListener('click', useLocation);

    dom.theme.addEventListener('click', () => {
        setTheme(
            dom.body.dataset.theme === 'light'
                ? 'dark'
                : 'light'
        );
    });

    document.addEventListener('maplocationchange', async event => {
        const { latitude, longitude } = event.detail || {};

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return;
        }

        try {
            setLoading(true);

            await loadWeather(
                latitude,
                longitude,
                `Map location (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`,
                ''
            );

            dom.dashboard.classList.remove('hidden');
            dom.empty.classList.add('hidden');
        } catch (error) {
            showError(error.message);
        } finally {
            setLoading(false);
        }
    });

    if (dom.mapSection && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) {
                loadMapWhenVisible();
                observer.disconnect();
            }
        }, { rootMargin: '300px' });

        observer.observe(dom.mapSection);
    }

    createPremiumFeatures();
    setTheme('dark');
})();