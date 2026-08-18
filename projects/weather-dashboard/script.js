(() => {
    'use strict';

    const API = {
        geo: 'https://geocoding-api.open-meteo.com/v1/search',
        weather: 'https://api.open-meteo.com/v1/forecast'
    };

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
        canvas: $('weatherCanvas'),
        windEffect: $('windEffect'),
        flash: $('lightningFlash'),
        city: $('cityName'),
        date: $('currentDate'),
        temp: $('temperature'),
        icon: $('weatherIcon'),
        description: $('weatherDescription'),
        feels: $('feelsLike'),
        theme: $('themeToggle')
    };

    const info = {
        0: ['Clear', '☀️', 'sun'],
        1: ['Mainly clear', '🌤️', 'sun'],
        2: ['Partly cloudy', '⛅', 'clouds'],
        3: ['Overcast', '☁️', 'clouds'],
        45: ['Fog', '🌫️', 'fog'],
        48: ['Rime fog', '🌫️', 'fog'],
        51: ['Light drizzle', '🌦️', 'drizzle'],
        53: ['Drizzle', '🌦️', 'drizzle'],
        55: ['Heavy drizzle', '🌧️', 'rain'],
        56: ['Freezing drizzle', '🌧️', 'rain'],
        57: ['Heavy freezing drizzle', '🌧️', 'rain'],
        61: ['Light rain', '🌦️', 'rain'],
        63: ['Rain', '🌧️', 'rain'],
        65: ['Heavy rain', '🌧️', 'rain'],
        66: ['Freezing rain', '🌧️', 'rain'],
        67: ['Heavy freezing rain', '🌧️', 'rain'],
        71: ['Light snow', '❄️', 'snow'],
        73: ['Snow', '❄️', 'snow'],
        75: ['Heavy snow', '❄️', 'snow'],
        77: ['Snow grains', '❄️', 'snow'],
        80: ['Rain showers', '🌦️', 'rain'],
        81: ['Heavy showers', '🌧️', 'rain'],
        82: ['Violent showers', '🌧️', 'rain'],
        85: ['Snow showers', '❄️', 'snow'],
        86: ['Heavy snow showers', '❄️', 'snow'],
        95: ['Thunderstorm', '⛈️', 'thunder'],
        96: ['Thunderstorm with hail', '⛈️', 'thunder'],
        99: ['Severe thunderstorm', '⛈️', 'thunder']
    };

    const reducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
    ).matches;

    const gsapReady = typeof window.gsap !== 'undefined';
    const cache = new Map();

    let controller;
    let map;
    let marker;
    let scene = 'idle';
    let particles = [];
    let width = window.innerWidth;
    let height = window.innerHeight;
    let lastThunder = 0;

    const condition = code =>
        info[code] || ['Unknown conditions', '🌤️', 'clouds'];

    function tween(target, vars) {
        if (!gsapReady || reducedMotion) return;

        gsap.killTweensOf(target);
        gsap.to(target, vars);
    }

    function showError(message) {
        dom.error.textContent = message;
        dom.error.classList.add('show');

        tween(dom.error, {
            opacity: 1,
            y: 0,
            duration: 0.4,
            ease: 'back.out(1.5)'
        });

        clearTimeout(showError.timer);
        showError.timer = setTimeout(() => {
            dom.error.classList.remove('show');
        }, 5000);
    }

    async function getJson(url, options = {}) {
        const response = await fetch(url, options);

        if (!response.ok) {
            throw new Error('Weather service is unavailable.');
        }

        return response.json();
    }

    function loading(value) {
        dom.loading.classList.toggle('hidden', !value);

        if (value) {
            tween(dom.loading, {
                opacity: 1,
                scale: 1,
                duration: 0.4
            });
        }
    }

    function clock(value) {
        return new Date(value).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    async function searchCity(name) {
        controller?.abort();
        controller = new AbortController();

        const key = name.toLowerCase();

        try {
            loading(true);
            dom.error.classList.remove('show');

            let result = cache.get(key);

            if (!result) {
                result = await getJson(
                    `${API.geo}?name=${encodeURIComponent(name)}&count=1&language=en&format=json`,
                    { signal: controller.signal }
                );

                cache.set(key, result);
            }

            if (!result.results?.length) {
                throw new Error('City not found.');
            }

            const place = result.results[0];

            await loadWeather(
                place.latitude,
                place.longitude,
                place.name,
                place.country_code?.toUpperCase() || ''
            );
        } catch (error) {
            if (error.name !== 'AbortError') {
                showError(error.message);
            }
        } finally {
            loading(false);
        }
    }

    function useLocation() {
        if (!navigator.geolocation) {
            showError('Geolocation is not supported by this browser.');
            return;
        }

        loading(true);

        navigator.geolocation.getCurrentPosition(
            async position => {
                const { latitude, longitude } = position.coords;
                let city = 'Your location';
                let country = '';

                try {
                    const result = await getJson(
                        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10`
                    );

                    const address = result.address || {};

                    city =
                        address.city ||
                        address.town ||
                        address.village ||
                        address.municipality ||
                        address.county ||
                        city;

                    country = address.country_code?.toUpperCase() || '';
                } catch {
                    // Weather still loads if reverse geocoding fails.
                }

                try {
                    await loadWeather(latitude, longitude, city, country);
                } finally {
                    loading(false);
                }
            },
            () => {
                loading(false);
                showError(
                    'Location access was denied. Search for a city instead.'
                );
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 300000
            }
        );
    }

    async function loadWeather(latitude, longitude, city, country) {
        const params = new URLSearchParams({
            latitude,
            longitude,
            timezone: 'auto',
            forecast_days: 10,
            current:
                'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,cloud_cover,pressure_msl,wind_speed_10m,precipitation,visibility,is_day',
            daily:
                'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset'
        });

        const data = await getJson(`${API.weather}?${params}`);

        renderWeather(data, city, country);
        updateMap(latitude, longitude, city);

        dom.dashboard.classList.remove('hidden');
        dom.empty.classList.add('hidden');

        animateDashboard();
    }

    function number(element, value, suffix = '') {
        const end = Number(value) || 0;

        if (!gsapReady || reducedMotion) {
            element.textContent = `${Math.round(end)}${suffix}`;
            return;
        }

        const counter = {
            value: Number.parseFloat(element.dataset.value) || 0
        };

        element.dataset.value = end;

        gsap.killTweensOf(counter);

        gsap.to(counter, {
            value: end,
            duration: 1.2,
            ease: 'power3.out',
            onUpdate: () => {
                element.textContent = `${Math.round(counter.value)}${suffix}`;
            },
            onComplete: () => {
                gsap.fromTo(
                    element,
                    { scale: 1.18 },
                    {
                        scale: 1,
                        duration: 0.35,
                        ease: 'back.out(2)'
                    }
                );
            }
        });
    }

    function swapText(element, value) {
        if (!gsapReady || reducedMotion) {
            element.textContent = value;
            return;
        }

        gsap.to(element, {
            opacity: 0,
            y: -8,
            duration: 0.18,
            onComplete: () => {
                element.textContent = value;

                gsap.to(element, {
                    opacity: 1,
                    y: 0,
                    duration: 0.35
                });
            }
        });
    }

    function swapIcon(value) {
        if (!gsapReady || reducedMotion) {
            dom.icon.textContent = value;
            return;
        }

        gsap.timeline()
            .to(dom.icon, {
                opacity: 0,
                scale: 0.3,
                rotation: 360,
                duration: 0.35
            })
            .call(() => {
                dom.icon.textContent = value;
            })
            .to(dom.icon, {
                opacity: 1,
                scale: 1,
                rotation: 0,
                duration: 0.7,
                ease: 'elastic.out(1, .45)'
            });
    }

    function renderWeather(data, city, country) {
        const { current, daily } = data;
        const details = condition(current.weather_code);
        const nextScene = current.is_day ? details[2] : 'night';
        const windSpeed = Number(current.wind_speed_10m) || 0;

        dom.city.textContent = `${city}${country ? `, ${country}` : ''}`;

        dom.date.textContent = new Date(
            current.time
        ).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        number(dom.temp, current.temperature_2m, '°C');
        number(dom.feels, current.apparent_temperature, '°C');
        swapIcon(details[1]);
        swapText(dom.description, details[0]);

        const values = {
            humidity: `${Math.round(current.relative_humidity_2m)}%`,
            windSpeed: `${Math.round(windSpeed)} km/h`,
            pressure: `${Math.round(current.pressure_msl)} hPa`,
            visibility: `${(current.visibility / 1000).toFixed(1)} km`,
            sunrise: clock(daily.sunrise[0]),
            sunset: clock(daily.sunset[0]),
            cloudCover: `${Math.round(current.cloud_cover)}%`,
            precipitation: `${Number(current.precipitation || 0).toFixed(1)} mm/h`
        };

        Object.entries(values).forEach(([id, value], index) => {
            const element = $(id);

            swapText(element, value);

            if (gsapReady && !reducedMotion) {
                gsap.fromTo(
                    element,
                    { opacity: 0, y: 12 },
                    {
                        opacity: 1,
                        y: 0,
                        delay: index * 0.05,
                        duration: 0.45,
                        ease: 'back.out(1.6)'
                    }
                );
            }
        });

        $('mapCloud').textContent = `${Math.round(current.cloud_cover)}%`;
        $('mapRain').textContent =
            `${Number(current.precipitation || 0).toFixed(1)} mm/h`;
        $('mapWind').textContent = `${Math.round(windSpeed)} km/h`;
        $('mapVisibility').textContent =
            `${(current.visibility / 1000).toFixed(1)} km`;

        updateWindEffect(windSpeed);

        if (scene !== nextScene) {
            scene = nextScene;
            dom.body.dataset.scene = scene;

            if (dom.canvas?.setScene) {
                dom.canvas.setScene(scene);
            }
        }

        document.dispatchEvent(
            new CustomEvent('weatherchange', {
                detail: { scene }
            })
        );

        renderForecast(daily);
    }

    function renderForecast(daily) {
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
                    <div class="forecast-temp">${Math.round(
                        (max + min) / 2
                    )}°C</div>
                    <div class="forecast-temp-range">
                        ${max}° / ${min}° · 💧 ${rain}%
                    </div>
                `;

                return card;
            })
        );

        if (gsapReady && !reducedMotion) {
            gsap.fromTo(
                '.forecast-card',
                {
                    opacity: 0,
                    y: 28,
                    rotationX: -35
                },
                {
                    opacity: 1,
                    y: 0,
                    rotationX: 0,
                    duration: 0.65,
                    stagger: 0.08,
                    ease: 'back.out(1.5)'
                }
            );
        }
    }

    function animateDashboard() {
        if (!gsapReady || reducedMotion) return;

        gsap.fromTo(
            '.glass-panel',
            {
                opacity: 0,
                y: 30,
                scale: 0.97
            },
            {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: 0.75,
                stagger: 0.12,
                ease: 'power3.out'
            }
        );

        gsap.fromTo(
            '.stat-card',
            {
                opacity: 0,
                y: 18,
                scale: 0.9
            },
            {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: 0.5,
                delay: 0.25,
                stagger: 0.05,
                ease: 'back.out(1.7)'
            }
        );
    }

    function createWindEffect() {
        if (!dom.windEffect) return;

        const style = document.createElement('style');

        style.textContent = `
            #windEffect {
                position: fixed;
                z-index: 0;
                inset: 0;
                overflow: hidden;
                opacity: 0;
                pointer-events: none;
                transition: opacity 1.8s ease;
            }

            body[data-windy="true"] #windEffect {
                opacity: 1;
            }

            .wind-line {
                position: absolute;
                width: 130px;
                height: 1px;
                border-radius: 999px;
                background: linear-gradient(
                    90deg,
                    transparent,
                    rgba(210, 235, 255, .42),
                    transparent
                );
                filter: blur(.3px);
                animation: smoothWind linear infinite;
            }

            .wind-line:nth-child(3n) {
                width: 210px;
                opacity: .55;
            }

            .wind-line:nth-child(4n) {
                width: 80px;
                opacity: .3;
            }

            @keyframes smoothWind {
                from {
                    transform: translateX(-260px) translateY(20px) rotate(-8deg);
                }

                to {
                    transform: translateX(calc(100vw + 300px))
                        translateY(-70px) rotate(-8deg);
                }
            }

            @media (prefers-reduced-motion: reduce) {
                .wind-line {
                    animation: none;
                    opacity: .18;
                }
            }
        `;

        document.head.appendChild(style);

        for (let index = 0; index < 22; index += 1) {
            const line = document.createElement('span');

            line.className = 'wind-line';
            line.style.top = `${Math.random() * 100}%`;
            line.style.left = `${Math.random() * 100}%`;
            line.style.animationDuration = `${9 + Math.random() * 10}s`;
            line.style.animationDelay = `${Math.random() * -18}s`;

            dom.windEffect.appendChild(line);
        }
    }

    function updateWindEffect(speed) {
        if (!dom.windEffect) return;

        const windSpeed = Number(speed) || 0;
        const isWindy = windSpeed >= 25;

        dom.body.dataset.windy = String(isWindy);

        if (isWindy) {
            dom.windEffect.setAttribute(
                'aria-label',
                `Animated background showing wind at ${Math.round(windSpeed)} km/h`
            );

            const intensity = Math.min(1.8, 0.8 + windSpeed / 70);
            dom.windEffect.style.setProperty('--wind-intensity', intensity);
        } else {
            dom.windEffect.removeAttribute('aria-label');
        }
    }

    function createCanvasSystem() {
        if (!dom.canvas) return;

        const ctx = dom.canvas.getContext('2d');
        if (!ctx) return;

        const settings = {
            rain: 260,
            drizzle: 150,
            thunder: 320,
            snow: 170,
            sun: 90,
            night: 90,
            clouds: 45,
            fog: 55,
            idle: 35
        };

        class Particle {
            constructor() {
                this.reset(true);
            }

            reset(initial = false) {
                this.x = Math.random() * width;
                this.y = initial ? Math.random() * height : -30;
                this.size = Math.random() * 3 + 1;
                this.speed = Math.random() * 1.8 + 0.5;
                this.alpha = Math.random() * 0.55 + 0.15;
                this.wobble = Math.random() * Math.PI * 2;
                this.drift = Math.random() * 1.4 - 0.7;
            }

            update() {
                if (['rain', 'drizzle', 'thunder'].includes(scene)) {
                    this.y += this.speed * (scene === 'thunder' ? 8 : 5);
                    this.x += scene === 'thunder' ? 2.4 : 1.2;

                    if (this.y > height + 30) this.reset();
                } else if (scene === 'snow') {
                    this.y += this.speed;
                    this.x += Math.sin(this.wobble) * 0.7;
                    this.wobble += 0.025;

                    if (this.y > height + 20) this.reset();
                } else {
                    this.x += this.drift * 0.25;
                    this.wobble += 0.03;

                    if (this.x > width + 20) this.x = -20;
                    if (this.x < -20) this.x = width + 20;
                }
            }

            draw() {
                ctx.save();

                if (['rain', 'drizzle', 'thunder'].includes(scene)) {
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y);
                    ctx.lineTo(
                        this.x + 5,
                        this.y + (scene === 'thunder' ? 27 : 20)
                    );
                    ctx.strokeStyle = `rgba(190,220,255,${this.alpha})`;
                    ctx.lineWidth = this.size;
                    ctx.stroke();
                } else if (scene === 'snow') {
                    ctx.beginPath();
                    ctx.arc(
                        this.x,
                        this.y,
                        this.size + 1,
                        0,
                        Math.PI * 2
                    );
                    ctx.fillStyle = `rgba(255,255,255,${this.alpha})`;
                    ctx.shadowBlur = 12;
                    ctx.shadowColor = '#fff';
                    ctx.fill();
                } else {
                    const twinkle = 0.5 + Math.sin(this.wobble) * 0.5;

                    ctx.beginPath();
                    ctx.arc(
                        this.x,
                        this.y,
                        this.size * twinkle,
                        0,
                        Math.PI * 2
                    );

                    ctx.fillStyle = scene === 'sun'
                        ? `rgba(255,220,120,${this.alpha})`
                        : `rgba(255,255,255,${this.alpha})`;

                    ctx.fill();
                }

                ctx.restore();
            }
        }

        function resetParticles() {
            particles = Array.from(
                { length: settings[scene] || 40 },
                () => new Particle()
            );
        }

        function resize() {
            const ratio = Math.min(window.devicePixelRatio || 1, 2);

            width = window.innerWidth;
            height = window.innerHeight;

            dom.canvas.width = width * ratio;
            dom.canvas.height = height * ratio;
            dom.canvas.style.width = `${width}px`;
            dom.canvas.style.height = `${height}px`;

            ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            resetParticles();
        }

        function lightning() {
            if (
                scene !== 'thunder' ||
                Date.now() - lastThunder < 4000
            ) {
                return;
            }

            if (Math.random() < 0.006) {
                lastThunder = Date.now();

                if (gsapReady && !reducedMotion) {
                    gsap.timeline()
                        .to(dom.flash, {
                            opacity: 0.75,
                            duration: 0.04
                        })
                        .to(dom.flash, {
                            opacity: 0,
                            duration: 0.12
                        })
                        .to(dom.flash, {
                            opacity: 0.5,
                            duration: 0.05
                        })
                        .to(dom.flash, {
                            opacity: 0,
                            duration: 0.35
                        });
                }

                document.dispatchEvent(new CustomEvent('thunder'));
            }
        }

        function draw() {
            ctx.clearRect(0, 0, width, height);

            if (scene === 'sun') {
                const glow = ctx.createRadialGradient(
                    width * 0.75,
                    height * 0.1,
                    0,
                    width * 0.75,
                    height * 0.1,
                    width * 0.7
                );

                glow.addColorStop(0, 'rgba(255,220,100,.22)');
                glow.addColorStop(1, 'rgba(255,220,100,0)');

                ctx.fillStyle = glow;
                ctx.fillRect(0, 0, width, height);
            }

            particles.forEach(particle => {
                particle.update();
                particle.draw();
            });

            lightning();
            requestAnimationFrame(draw);
        }

        dom.canvas.setScene = nextScene => {
            scene = nextScene;

            if (gsapReady && !reducedMotion) {
                gsap.fromTo(
                    dom.canvas,
                    { opacity: 0.25 },
                    {
                        opacity: 1,
                        duration: 1.5,
                        ease: 'power2.out'
                    }
                );

                gsap.fromTo(
                    '.current-weather',
                    { scale: 0.985 },
                    {
                        scale: 1,
                        duration: 1.2,
                        ease: 'sine.inOut'
                    }
                );
            }

            resetParticles();
        };

        window.addEventListener('resize', resize);
        resize();
        draw();
    }

    function updateMap(latitude, longitude, city) {
        if (!window.L) return;

        if (!map) {
            map = L.map('weatherMap').setView(
                [latitude, longitude],
                8
            );

            L.tileLayer(
                'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                {
                    maxZoom: 18,
                    attribution: '&copy; OpenStreetMap contributors'
                }
            ).addTo(map);
        } else {
            map.setView([latitude, longitude], 8);
        }

        marker?.remove();

        marker = L.marker([latitude, longitude])
            .addTo(map)
            .bindPopup(city)
            .openPopup();

        requestAnimationFrame(() => map.invalidateSize());
    }

    function setTheme(theme) {
        dom.body.dataset.theme = theme;

        const light = theme === 'light';

        dom.theme.textContent = light
            ? '🌙 Dark mode'
            : '☀️ Light mode';

        dom.theme.setAttribute('aria-pressed', String(light));

        try {
            localStorage.setItem('weather-theme', theme);
        } catch {
            // Storage may be unavailable.
        }
    }

    dom.search.addEventListener('click', () => {
        const value = dom.input.value.trim();

        if (value) searchCity(value);
    });

    dom.input.addEventListener('keydown', event => {
        if (event.key === 'Enter') dom.search.click();
    });

    dom.location.addEventListener('click', useLocation);

    dom.theme.addEventListener('click', () => {
        setTheme(
            dom.body.dataset.theme === 'light'
                ? 'dark'
                : 'light'
        );
    });

    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', () => {
            if (gsapReady && !reducedMotion) {
                gsap.fromTo(
                    button,
                    { scale: 0.94 },
                    {
                        scale: 1,
                        duration: 0.35,
                        ease: 'back.out(3)'
                    }
                );
            }
        });
    });

    try {
        setTheme(localStorage.getItem('weather-theme') || 'dark');
    } catch {
        setTheme('dark');
    }

    createWindEffect();
    createCanvasSystem();
    searchCity('London');
})();