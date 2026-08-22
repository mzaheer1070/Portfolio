(() => {
    'use strict';

    const mapElement = document.getElementById('weatherMap');

    if (!mapElement || !window.L) return;

    const map = L.map(mapElement, {
        zoomControl: true,
        attributionControl: true
    }).setView([20, 0], 2);

    const lightTiles = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
        }
    );

    const darkTiles = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }
    );

    const baseLayers = {
        'Light map': lightTiles,
        'Dark map': darkTiles
    };

    let activeBaseLayer;
    let marker;
    let rainLayer;
    let cloudLayer;
    let radarReady = false;
    let satelliteReady = false;

    const markerStyle = document.createElement('style');
    markerStyle.textContent = `
        .weather-marker {
            width: 22px;
            height: 22px;
            border: 3px solid #fff;
            border-radius: 50%;
            background: #6f8cff;
            box-shadow:
                0 0 0 0 rgba(111, 140, 255, .7),
                0 4px 14px rgba(0, 0, 0, .4);
            animation: weatherMarkerPulse 2s infinite;
        }

        @keyframes weatherMarkerPulse {
            0% {
                box-shadow:
                    0 0 0 0 rgba(111, 140, 255, .7),
                    0 4px 14px rgba(0, 0, 0, .4);
            }

            70% {
                box-shadow:
                    0 0 0 16px rgba(111, 140, 255, 0),
                    0 4px 14px rgba(0, 0, 0, .4);
            }

            100% {
                box-shadow:
                    0 0 0 0 rgba(111, 140, 255, 0),
                    0 4px 14px rgba(0, 0, 0, .4);
            }
        }

        @media (prefers-reduced-motion: reduce) {
            .weather-marker {
                animation: none;
            }
        }
    `;
    document.head.appendChild(markerStyle);

    function selectBaseLayer() {
        const theme = document.body.dataset.theme === 'light'
            ? 'light'
            : 'dark';

        const nextLayer = theme === 'light' ? lightTiles : darkTiles;

        if (activeBaseLayer === nextLayer) return;

        if (activeBaseLayer) map.removeLayer(activeBaseLayer);

        nextLayer.addTo(map);
        activeBaseLayer = nextLayer;
    }

    function addLayerControl() {
        L.control.layers(
            baseLayers,
            {
                'Rain radar': rainLayer,
                'Cloud satellite': cloudLayer
            },
            { collapsed: true }
        ).addTo(map);
    }

    async function loadWeatherOverlays() {
        try {
            const response = await fetch(
                'https://api.rainviewer.com/public/weather-maps.json'
            );

            if (!response.ok) throw new Error('Weather overlays unavailable.');

            const data = await response.json();
            const radar = data.radar?.past?.at(-1);
            const satellite = data.satellite?.infrared?.at(-1);

            if (radar && !radarReady) {
                rainLayer = L.tileLayer(
                    `https://tilecache.rainviewer.com${radar.path}/256/{z}/{x}/{y}/2/1_1.png`,
                    {
                        opacity: .48,
                        maxNativeZoom: 7,
                        maxZoom: 19,
                        attribution: 'Radar &copy; RainViewer'
                    }
                );

                radarReady = true;
            }

            if (satellite && !satelliteReady) {
                cloudLayer = L.tileLayer(
                    `https://tilecache.rainviewer.com${satellite.path}/256/{z}/{x}/{y}/0/0_0.png`,
                    {
                        opacity: .25,
                        maxNativeZoom: 7,
                        maxZoom: 19,
                        attribution: 'Satellite &copy; RainViewer'
                    }
                );

                satelliteReady = true;
            }

            if (rainLayer && cloudLayer && !map.hasLayer(rainLayer) &&
                !map.hasLayer(cloudLayer)) {
                addLayerControl();
            }
        } catch {
            // The map remains usable if the public overlay service is unavailable.
        }
    }

    function markerIcon() {
        return L.divIcon({
            className: '',
            html: '<div class="weather-marker"></div>',
            iconSize: [22, 22],
            iconAnchor: [11, 11],
            popupAnchor: [0, -12]
        });
    }

    function updateMap(latitude, longitude, city = 'Selected location') {
        const coordinates = [latitude, longitude];

        map.setView(coordinates, 10, { animate: true });

        if (marker) {
            marker.setLatLng(coordinates);
        } else {
            marker = L.marker(coordinates, {
                icon: markerIcon(),
                riseOnHover: true
            }).addTo(map);
        }

        marker.bindPopup(city).setPopupContent(city).openPopup();

        setTimeout(() => map.invalidateSize(), 100);
    }

    map.on('click', event => {
        const { lat, lng } = event.latlng;

        updateMap(lat, lng, 'Loading weather...');

        document.dispatchEvent(new CustomEvent('maplocationchange', {
            detail: {
                latitude: lat,
                longitude: lng
            }
        }));
    });

    document.addEventListener('weatherchange', event => {
        const { latitude, longitude, city } = event.detail || {};

        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
            updateMap(latitude, longitude, city);
        }
    });

    const themeObserver = new MutationObserver(selectBaseLayer);
    themeObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ['data-theme']
    });

    selectBaseLayer();
    loadWeatherOverlays();
})();