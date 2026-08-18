(() => {
    'use strict';

    const input = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchBtn');
    const suggestions = document.getElementById('citySuggestions');

    if (!input || !searchButton || !suggestions) return;

    const style = document.createElement('style');
    style.textContent = `
        .search-section {
            position: relative;
        }

        .city-suggestions {
            position: absolute;
            z-index: 10;
            left: 0;
            right: 0;
            display: none;
            max-height: 300px;
            overflow-y: auto;
            margin-top: 8px;
            border: 1px solid rgba(255, 255, 255, .2);
            border-radius: 16px;
            background: rgba(14, 28, 60, .96);
            box-shadow: 0 14px 35px rgba(0, 0, 0, .3);
            backdrop-filter: blur(18px);
        }

        .city-suggestions.show {
            display: block;
        }

        .city-suggestion {
            display: block;
            width: 100%;
            padding: 13px 17px;
            color: #f8fbff;
            text-align: left;
            border: 0;
            border-bottom: 1px solid rgba(255, 255, 255, .1);
            border-radius: 0;
            background: transparent;
        }

        .city-suggestion:last-child {
            border-bottom: 0;
        }

        .city-suggestion:hover,
        .city-suggestion:focus {
            background: rgba(142, 167, 255, .25);
            outline: none;
        }

        .city-country {
            display: block;
            margin-top: 3px;
            color: rgba(239, 246, 255, .65);
            font-size: .8rem;
        }
    `;
    document.head.appendChild(style);

    let timer;
    let controller;

    function closeSuggestions() {
        suggestions.replaceChildren();
        suggestions.classList.remove('show');
        input.setAttribute('aria-expanded', 'false');
    }

    function selectCity(place) {
        input.value = place.name;
        closeSuggestions();
        searchButton.click();
    }

    function showSuggestions(results) {
        suggestions.replaceChildren();

        results.forEach((place, index) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'city-suggestion';
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', String(index === 0));

            const region = [place.admin1, place.country_code]
                .filter(Boolean)
                .join(', ');

            item.innerHTML = `
                <strong>${place.name}</strong>
                <span class="city-country">${region}</span>
            `;

            item.addEventListener('click', () => selectCity(place));
            suggestions.appendChild(item);
        });

        suggestions.classList.toggle('show', results.length > 0);
        input.setAttribute('aria-expanded', String(results.length > 0));
    }

    async function searchSuggestions(value) {
        controller?.abort();
        controller = new AbortController();

        try {
            const response = await fetch(
                `https://geocoding-api.open-meteo.com/v1/search?name=${
                    encodeURIComponent(value)
                }&count=10&language=en&format=json`,
                { signal: controller.signal }
            );

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
        if (event.key === 'Escape') {
            closeSuggestions();
        }

        if (event.key === 'Enter') {
            closeSuggestions();
        }
    });

    document.addEventListener('click', event => {
        if (!event.target.closest('.search-section')) {
            closeSuggestions();
        }
    });
})();