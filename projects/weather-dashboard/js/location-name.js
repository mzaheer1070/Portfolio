(() => {
    'use strict';

    const cityName = document.getElementById('cityName');
    let requestId = 0;

    async function getCityName(latitude, longitude) {
        const currentRequest = ++requestId;

        try {
            const url =
                'https://nominatim.openstreetmap.org/reverse' +
                `?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10`;

            const response = await fetch(url);

            if (!response.ok) return;

            const result = await response.json();
            if (currentRequest !== requestId) return;

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