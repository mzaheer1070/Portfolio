(() => {
    'use strict';

    const canvas = document.getElementById('weatherCanvas');
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    let width = innerWidth;
    let height = innerHeight;
    let scene = 'idle';
    let windSpeed = 0;
    let precipitation = 0;
    let cloudCover = 0;
    let particles = [];
    let animationFrame;
    let scrollTimer;
    let stormTimer;
    let animationPaused = false;
    let lightningBolt;

    const rainScenes = [
        'drizzle',
        'light-shower',
        'shower',
        'rain',
        'heavy-rain',
        'thunder'
    ];

    const settings = {
        idle: [18, .2],
        sun: [35, .25],
        clouds: [30, .2],
        fog: [24, .12],
        drizzle: [85, 1.2],
        'light-shower': [125, 1.8],
        shower: [170, 2.8],
        rain: [220, 3.2],
        'heavy-rain': [270, 3.7],
        thunder: [360, 4.8],
        snow: [100, .8]
    };

    const lowEndDevice =
        (navigator.hardwareConcurrency || 4) <= 4 ||
        (window.devicePixelRatio || 1) >= 2.5 ||
        matchMedia('(prefers-reduced-motion: reduce)').matches;

    const performanceScale = lowEndDevice ? .65 : 1;

    function normaliseScene(nextScene, weatherCode) {
        const code = Number(weatherCode);

        if (code >= 80 && code <= 82) return 'shower';
        return nextScene || 'idle';
    }

    function resize() {
        const ratio = Math.min(devicePixelRatio || 1, 2);

        width = innerWidth;
        height = innerHeight;
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        createParticles();
    }

    function particleCount() {
        const [baseCount] = settings[scene] || settings.clouds;

        if (!rainScenes.includes(scene)) {
            return Math.round(baseCount * performanceScale);
        }

        const intensity = Math.min(Math.max(precipitation, .5) / 3, 1);
        const sceneBoost = scene === 'thunder' ? 1.2 : 1;

        return Math.round(
            baseCount * (.85 + intensity * .55) *
            sceneBoost *
            performanceScale
        );
    }

    function createParticles() {
        particles = Array.from({ length: particleCount() }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            speed: Math.random() * 1.8 + .8,
            size: Math.random() * 2 + 1,
            length: Math.random() * 22 + 12,
            drift: Math.random() * 1.2 - .6
        }));
    }

    function updateParticle(particle) {
        if (rainScenes.includes(scene)) {
            const angle = Math.min(windSpeed / 55, 1.7);
            const speed = {
                drizzle: 1,
                'light-shower': 1.35,
                shower: 1.8,
                rain: 2.1,
                'heavy-rain': 2.4,
                thunder: 2.8
            }[scene] || 1;

            particle.y += particle.speed * speed;
            particle.x += angle * 2.5 + windSpeed * .018;

            if (particle.y > height + 30) {
                particle.y = -30;
                particle.x = Math.random() * width;
            }

            return;
        }

        if (scene === 'snow') {
            particle.y += particle.speed;
            particle.x += Math.sin(particle.y * .01) * .4;

            if (particle.y > height + 15) {
                particle.y = -15;
                particle.x = Math.random() * width;
            }

            return;
        }

        particle.x += particle.drift * .2;

        if (particle.x > width + 10) particle.x = -10;
        if (particle.x < -10) particle.x = width + 10;
    }

    function drawParticle(particle) {
        context.beginPath();

        if (rainScenes.includes(scene)) {
            const angle = Math.min(windSpeed / 55, 1.7);
            const multiplier = {
                drizzle: .75,
                'light-shower': .9,
                shower: 1.15,
                rain: 1.3,
                'heavy-rain': 1.45,
                thunder: 1.65
            }[scene] || 1;

            const length = particle.length * multiplier;

            context.moveTo(particle.x, particle.y);
            context.lineTo(
                particle.x + angle * length,
                particle.y + length
            );

            const color = {
                drizzle: 'rgba(200, 230, 255, .48)',
                'light-shower': 'rgba(205, 233, 255, .58)',
                shower: 'rgba(210, 237, 255, .68)',
                rain: 'rgba(215, 240, 255, .74)',
                'heavy-rain': 'rgba(225, 244, 255, .8)',
                thunder: 'rgba(235, 248, 255, .9)'
            }[scene];

            context.strokeStyle = color;
            context.lineWidth = scene === 'drizzle' ? .8 : 1.15;
            context.stroke();
            return;
        }

        context.arc(
            particle.x,
            particle.y,
            scene === 'snow' ? particle.size + 1 : particle.size,
            0,
            Math.PI * 2
        );

        context.fillStyle = scene === 'sun'
            ? 'rgba(255, 220, 120, .25)'
            : 'rgba(255, 255, 255, .2)';

        context.fill();
    }

    function draw() {
        if (animationPaused || document.hidden) return;

        context.clearRect(0, 0, width, height);

        particles.forEach(particle => {
            updateParticle(particle);
            drawParticle(particle);
        });

        animationFrame = requestAnimationFrame(draw);
    }

    function pauseAnimationForScroll() {
        animationPaused = true;
        canvas.style.visibility = 'hidden';
        cancelAnimationFrame(animationFrame);

        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            animationPaused = false;
            canvas.style.visibility = 'visible';
            draw();
        }, 140);
    }

    function handleVisibilityChange() {
        if (document.hidden) {
            cancelAnimationFrame(animationFrame);
        } else if (!animationPaused) {
            draw();
        }
    }

    function updateCloudDetails() {
        const clouds = document.querySelectorAll('.sky-cloud');
        if (!clouds.length) return;

        const cover = Math.max(0, Math.min(100, Number(cloudCover) || 0));
        const cloudScene = [
            'clouds', 'fog', 'rain', 'light-shower', 'shower',
            'heavy-rain', 'drizzle', 'snow', 'thunder'
        ].includes(scene);

        const coverFactor = cover / 100;
        const baseOpacity = cloudScene
            ? Math.min(.95, .04 + coverFactor * .91)
            : coverFactor * .25;

        document.body.style.setProperty('--cloud-cover', `${cover}%`);
        document.body.style.setProperty('--cloud-opacity', String(baseOpacity));

        clouds.forEach((cloud, index) => {
            cloud.style.opacity = String(
                Math.max(0, Math.min(1, baseOpacity * (1 - index * .12)))
            );

            cloud.style.filter = scene === 'thunder'
                ? 'blur(2px) brightness(.58) saturate(.7)'
                : scene === 'shower' || scene === 'heavy-rain'
                    ? 'blur(2px) brightness(.78) saturate(.8)'
                    : 'blur(2px)';
        });
    }

    function randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function createBoltPath(startX, startY = 0, endY = 100) {
        const points = [`M${startX} ${startY}`];
        let x = startX;
        const segments = 7;

        for (let index = 1; index <= segments; index += 1) {
            x += randomBetween(-12, 12);
            points.push(`L${x.toFixed(1)} ${(startY +
                ((endY - startY) / segments) * index).toFixed(1)}`);
        }

        return points.join(' ');
    }

    function createBranchPath(startX, startY, direction) {
        const branchStart = startY + randomBetween(25, 62);
        const branchEnd = branchStart + randomBetween(12, 28);
        const middleX = startX + direction * randomBetween(8, 17);
        const endX = middleX + direction * randomBetween(8, 20);

        return `
            M${startX.toFixed(1)} ${branchStart.toFixed(1)}
            L${middleX.toFixed(1)} ${(branchStart + 7).toFixed(1)}
            L${endX.toFixed(1)} ${branchEnd.toFixed(1)}
        `;
    }

    function createLightningBolt() {
        lightningBolt?.remove();

        lightningBolt = document.createElement('div');
        lightningBolt.id = 'stormLightningBolt';
        lightningBolt.setAttribute('aria-hidden', 'true');

        const startX = randomBetween(18, 82);
        const mainPath = createBoltPath(startX);
        const branches = [
            createBranchPath(startX - 3, 0, -1),
            createBranchPath(startX + 5, 0, 1),
            createBranchPath(startX - 1, 0, Math.random() > .5 ? -1 : 1)
        ].join(' ');

        lightningBolt.innerHTML = `
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                <path class="lightning-glow lightning-branch" d="${branches}"></path>
                <path class="lightning-main lightning-branch" d="${branches}"></path>
                <path class="lightning-glow" d="${mainPath}"></path>
                <path class="lightning-main" d="${mainPath}"></path>
                <path class="lightning-core" d="${mainPath}"></path>
            </svg>
        `;

        Object.assign(lightningBolt.style, {
            position: 'fixed',
            inset: '0',
            zIndex: '0',
            pointerEvents: 'none',
            opacity: '0'
        });

        const style = document.createElement('style');
        style.textContent = `
            #stormLightningBolt svg {
                width: 100%;
                height: 100%;
                overflow: visible;
                filter:
                    drop-shadow(0 0 8px rgba(115, 205, 255, .95))
                    drop-shadow(0 0 24px rgba(90, 155, 255, .75));
            }

            #stormLightningBolt path {
                fill: none;
                stroke-linecap: round;
                stroke-linejoin: round;
                vector-effect: non-scaling-stroke;
            }

            #stormLightningBolt .lightning-glow {
                stroke: rgba(70, 170, 255, .8);
                stroke-width: 24;
                filter: blur(4px);
            }

            #stormLightningBolt .lightning-main {
                stroke: rgba(190, 235, 255, .95);
                stroke-width: 6;
                filter: blur(1px);
            }

            #stormLightningBolt .lightning-core {
                stroke: #ffffff;
                stroke-width: 2.2;
            }

            #stormLightningBolt .lightning-branch {
                opacity: .75;
            }
        `;

        lightningBolt.appendChild(style);
        document.body.appendChild(lightningBolt);
    }

    function triggerLightning() {
        if (scene !== 'thunder') return;

        createLightningBolt();

        const flash = lightningBolt.animate(
            [
                { opacity: 0 },
                { opacity: .95, offset: .06 },
                { opacity: .08, offset: .13 },
                { opacity: .72, offset: .2 },
                { opacity: .05, offset: .28 },
                { opacity: .9, offset: .36 },
                { opacity: .16, offset: .48 },
                { opacity: .65, offset: .57 },
                { opacity: 0, offset: 1 }
            ],
            {
                duration: 1250,
                easing: 'ease-out',
                fill: 'forwards'
            }
        );

        flash.finished.finally(() => {
            if (lightningBolt) {
                lightningBolt.remove();
                lightningBolt = null;
            }
        });
    }

    function startStormLightning() {
        clearInterval(stormTimer);

        if (scene !== 'thunder') return;

        stormTimer = setInterval(() => {
            if (Math.random() < .78) {
                document.dispatchEvent(new CustomEvent('thunder'));
            }
        }, 4200 + Math.random() * 4300);
    }

    function setScene(
        nextScene,
        nextWindSpeed = 0,
        nextPrecipitation = 0,
        nextCloudCover = 0,
        weatherCode = 0
    ) {
        scene = normaliseScene(nextScene, weatherCode);
        windSpeed = Number(nextWindSpeed) || 0;
        precipitation = Number(nextPrecipitation) || 0;
        cloudCover = Number(nextCloudCover) || 0;

        document.body.dataset.scene = scene;
        updateCloudDetails();
        createParticles();
        startStormLightning();

        if (scene !== 'thunder' && lightningBolt) {
            lightningBolt.remove();
            lightningBolt = null;
        }

        if (!animationPaused && !document.hidden) {
            cancelAnimationFrame(animationFrame);
            draw();
        }
    }

    document.addEventListener('weatherchange', event => {
        const detail = event.detail || {};

        setScene(
            detail.scene,
            detail.windSpeed,
            detail.precipitation,
            detail.cloudCover,
            detail.weatherCode
        );
    });

    document.addEventListener('thunder', triggerLightning);

    window.WeatherEffects = { setScene };

    addEventListener('resize', resize);
    addEventListener('scroll', pauseAnimationForScroll, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    resize();
    updateCloudDetails();
    draw();
})();