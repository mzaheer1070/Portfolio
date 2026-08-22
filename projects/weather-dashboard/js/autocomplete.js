(() => {
    'use strict';

    const input = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchBtn');
    const suggestions = document.getElementById('citySuggestions');
    const cityName = document.getElementById('cityName');

    if (!input || !searchButton || !suggestions) return;

    let timer;
    let controller;
    let locationRequestId = 0;

    function closeSuggestions() {
        suggestions.replaceChildren();
        suggestions.classList.remove('show');
        input.setAttribute('aria-expanded', 'false');
    }

    function showSuggestions(results) {
        suggestions.replaceChildren();

        results.forEach(place => {
            const item = document.createElement('button');

            item.type = 'button';
            item.className = 'city-suggestion';
            item.setAttribute('role', 'option');

            const region = [place.admin1, place.country_code]
                .filter(Boolean)
                .join(', ');

            item.innerHTML = `
                <strong>${place.name}</strong>
                <span class="city-country">${region}</span>
            `;

            item.addEventListener('click', () => {
                input.value = place.name;
                closeSuggestions();
                searchButton.click();
            });

            suggestions.appendChild(item);
        });

        suggestions.classList.toggle('show', results.length > 0);
        input.setAttribute('aria-expanded', String(results.length > 0));
    }

    async function searchSuggestions(value) {
        controller?.abort();
        controller = new AbortController();

        try {
            const url =
                'https://geocoding-api.open-meteo.com/v1/search' +
                `?name=${encodeURIComponent(value)}&count=10&language=en&format=json`;

            const response = await fetch(url, {
                signal: controller.signal
            });

            if (!response.ok) throw new Error('Suggestions unavailable.');

            const data = await response.json();
            const query = value.toLowerCase();

            const results = (data.results || [])
                .filter(place =>
                    place.name?.toLowerCase().startsWith(query)
                )
                .filter((place, index, list) =>
                    index === list.findIndex(item =>
                        item.name === place.name &&
                        item.country_code === place.country_code
                    )
                );

            showSuggestions(results);
        } catch (error) {
            if (error.name !== 'AbortError') closeSuggestions();
        }
    }

    async function getCityName(latitude, longitude) {
        const requestId = ++locationRequestId;

        try {
            const url =
                'https://nominatim.openstreetmap.org/reverse' +
                `?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10`;

            const response = await fetch(url);

            if (!response.ok || requestId !== locationRequestId) return;

            const result = await response.json();
            const address = result.address || {};
            const city =
                address.city ||
                address.town ||
                address.village ||
                address.municipality ||
                address.county;

            if (!city || !cityName) return;

            const country = address.country_code
                ? address.country_code.toUpperCase()
                : '';

            cityName.textContent = country
                ? `${city}, ${country}`
                : city;
        } catch {
            // Keep the existing location text if reverse geocoding fails.
        }
    }

    input.addEventListener('input', () => {
        const value = input.value.trim();

        clearTimeout(timer);

        if (!value) {
            closeSuggestions();
            return;
        }

        timer = setTimeout(() => searchSuggestions(value), 250);
    });

    input.addEventListener('keydown', event => {
        if (event.key === 'Escape' || event.key === 'Enter') {
            closeSuggestions();
        }
    });

    document.addEventListener('click', event => {
        if (!event.target.closest('.search-section')) {
            closeSuggestions();
        }
    });

    document.addEventListener('weatherchange', event => {
        const { latitude, longitude, city } = event.detail || {};

        if (
            city === 'Your location' &&
            Number.isFinite(latitude) &&
            Number.isFinite(longitude)
        ) {
            getCityName(latitude, longitude);
        }
    });
})();