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

    const settings = {
        idle: [18, .2],
        sun: [35, .25],
        clouds: [30, .2],
        fog: [24, .12],
        drizzle: [55, 1.2],
        shower: [105, 2.8],
        rain: [145, 2.2],
        thunder: [220, 4],
        snow: [100, .8]
    };

    const lowEndDevice =
        (navigator.hardwareConcurrency || 4) <= 4 ||
        (window.devicePixelRatio || 1) >= 2.5 ||
        matchMedia('(prefers-reduced-motion: reduce)').matches;

    const performanceScale = lowEndDevice ? .5 : 1;

    function normaliseScene(nextScene, weatherCode) {
        const code = Number(weatherCode);

        if (code >= 80 && code <= 82) return 'shower';
        return nextScene || 'idle';
    }

    function addSceneStyles() {
        if (document.getElementById('weatherEffectsSceneStyles')) return;

        const style = document.createElement('style');
        style.id = 'weatherEffectsSceneStyles';
        style.textContent = `
            body[data-scene="shower"] {
                --scene-glow: rgba(80, 175, 255, .3);
            }

            body[data-scene="shower"] .sky-cloud {
                filter: blur(2px) brightness(.82) saturate(.85);
            }

            body[data-scene="sun"] .sky-sun {
                top: 10%;
                left: 84%;
                transform: translateX(-50%);
            }

            body[data-scene="sun"] .sky-rays {
                opacity: .58;
                filter: blur(7px);
                transform: scale(1.12);
                transform-origin: 84% 13%;
                background: repeating-conic-gradient(
                    from 205deg at 84% 13%,
                    rgba(255, 231, 160, .14) 0deg 8deg,
                    transparent 8deg 21deg
                );
            }

            body[data-scene="sun"] .sky-gradient {
                background:
                    radial-gradient(
                        circle at 84% 13%,
                        rgba(255, 220, 125, .28),
                        transparent 27%
                    ),
                    linear-gradient(
                        180deg,
                        rgba(255, 255, 255, .08),
                        transparent 75%
                    );
            }

            /* Keep the moon toward the upper-right, but away from the edge. */
            .sky-moon {
                top: 11%;
                left: 83%;
                right: auto;
                transform: translateX(-50%);
                filter:
                    drop-shadow(0 0 8px rgba(205, 225, 255, .72))
                    drop-shadow(0 0 24px rgba(150, 190, 255, .34));
            }

            /* Supports either a dedicated moon-ray element or shared ray markup. */
            .sky-moon-rays,
            .sky-moon .moon-rays {
                top: 11%;
                left: 83%;
                opacity: .3;
                filter: blur(10px);
                transform: translate(-50%, -50%) scale(1.18);
                transform-origin: center;
                background: repeating-conic-gradient(
                    from 8deg at 50% 50%,
                    rgba(190, 220, 255, .12) 0deg 9deg,
                    transparent 9deg 25deg
                );
            }

            .sky-moon::before {
                filter: blur(12px);
                opacity: .55;
            }

            @media (max-width: 600px) {
                body[data-scene="sun"] .sky-sun {
                    top: 9%;
                    left: 79%;
                }

                body[data-scene="sun"] .sky-rays {
                    transform-origin: 79% 12%;
                    background: repeating-conic-gradient(
                        from 205deg at 79% 12%,
                        rgba(255, 231, 160, .13) 0deg 8deg,
                        transparent 8deg 21deg
                    );
                }

                .sky-moon {
                    top: 10%;
                    left: 78%;
                }

                .sky-moon-rays,
                .sky-moon .moon-rays {
                    top: 10%;
                    left: 78%;
                    transform: translate(-50%, -50%) scale(1.08);
                }
            }
        `;

        document.head.appendChild(style);
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

        if (!['drizzle', 'shower', 'rain', 'thunder'].includes(scene)) {
            return Math.round(baseCount * performanceScale);
        }

        const intensity = Math.min(Math.max(precipitation, .3) / 3, 1);
        const stormBoost = scene === 'thunder' ? 1.25 : 1;

        return Math.round(
            baseCount * (.55 + intensity * .75) *
            stormBoost *
            performanceScale
        );
    }

    function createParticles() {
        particles = Array.from({ length: particleCount() }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            speed: Math.random() * 1.5 + .5,
            size: Math.random() * 2 + 1,
            length: Math.random() * 18 + 8,
            drift: Math.random() * 1.2 - .6
        }));
    }

    function updateParticle(particle) {
        const rain = ['drizzle', 'shower', 'rain', 'thunder'].includes(scene);

        if (rain) {
            const angle = Math.min(windSpeed / 65, 1.4);
            const speed =
                scene === 'drizzle' ? 1 :
                scene === 'shower' ? 1.8 :
                scene === 'thunder' ? 2.4 : 1.45;

            particle.y += particle.speed * speed;
            particle.x += angle * 2.2 + windSpeed * .015;

            if (particle.y > height + 25) {
                particle.y = -25;
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

        const rain = ['drizzle', 'shower', 'rain', 'thunder'].includes(scene);

        if (rain) {
            const angle = Math.min(windSpeed / 65, 1.4);
            const lengthMultiplier =
                scene === 'drizzle' ? .55 :
                scene === 'shower' ? 1.15 :
                scene === 'thunder' ? 1.35 : 1;

            const length = particle.length * lengthMultiplier;

            context.moveTo(particle.x, particle.y);
            context.lineTo(
                particle.x + angle * length,
                particle.y + length
            );

            context.strokeStyle =
                scene === 'drizzle'
                    ? 'rgba(190, 225, 255, .3)'
                    : scene === 'shower'
                        ? 'rgba(200, 232, 255, .48)'
                        : scene === 'thunder'
                            ? 'rgba(225, 240, 255, .58)'
                            : 'rgba(205, 232, 255, .45)';

            context.lineWidth = scene === 'drizzle' ? .6 : 1;
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
            return;
        }

        if (!animationPaused) draw();
    }

    function updateCloudDetails() {
        const clouds = document.querySelectorAll('.sky-cloud');

        if (!clouds.length) return;

        const cover = Math.max(0, Math.min(100, Number(cloudCover) || 0));
        const cloudScene = [
            'clouds',
            'fog',
            'rain',
            'shower',
            'drizzle',
            'snow',
            'thunder'
        ].includes(scene);

        const coverFactor = cover / 100;
        const baseOpacity = cloudScene
            ? Math.min(.95, .04 + coverFactor * .91)
            : coverFactor * .25;

        document.body.style.setProperty('--cloud-cover', `${cover}%`);
        document.body.style.setProperty(
            '--cloud-opacity',
            String(baseOpacity)
        );

        clouds.forEach((cloud, index) => {
            const layerOpacity = Math.max(
                0,
                Math.min(1, baseOpacity * (1 - index * .12))
            );

            cloud.style.opacity = String(layerOpacity);
            cloud.style.background = `
                radial-gradient(
                    ellipse at 28% 35%,
                    rgba(245, 250, 255, ${.35 + coverFactor * .43}),
                    rgba(190, 210, 235, ${.25 + coverFactor * .33}) 42%,
                    rgba(65, 85, 120, ${.25 + coverFactor * .45}) 100%
                )
            `;

            cloud.style.boxShadow = `
                inset -20px -14px 28px rgba(20, 35, 65, ${.12 + coverFactor * .3}),
                inset 18px 12px 24px rgba(255, 255, 255, ${.08 + coverFactor * .18}),
                0 14px 30px rgba(5, 15, 35, ${.08 + coverFactor * .2})
            `;

            cloud.style.filter =
                scene === 'thunder'
                    ? 'blur(2px) brightness(.68) saturate(.75)'
                    : scene === 'shower'
                        ? 'blur(2px) brightness(.82) saturate(.85)'
                        : 'blur(2px)';
        });
    }

    function createLightningBolt() {
        lightningBolt?.remove();

        lightningBolt = document.createElement('div');
        lightningBolt.id = 'stormLightningBolt';
        lightningBolt.setAttribute('aria-hidden', 'true');

        const startX = 25 + Math.random() * 50;

        const boltPath = `
            M${startX} 0
            L${startX - 4} 14
            L${startX + 7} 27
            L${startX - 8} 42
            L${startX + 4} 56
            L${startX - 6} 72
            L${startX + 2} 88
            L${startX - 2} 100
        `;

        const leftBranch = `
            M${startX - 8} 42
            L${startX - 22} 50
            L${startX - 31} 47
            M${startX - 22} 50
            L${startX - 25} 60
        `;

        const rightBranch = `
            M${startX + 4} 56
            L${startX + 20} 63
            L${startX + 31} 58
            M${startX + 20} 63
            L${startX + 25} 74
        `;

        const upperFork = `
            M${startX + 7} 27
            L${startX + 19} 34
            L${startX + 27} 30
        `;

        lightningBolt.innerHTML = `
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                <path class="lightning-glow" d="${boltPath}"></path>
                <path class="lightning-main" d="${boltPath}"></path>
                <path class="lightning-branch" d="${leftBranch}"></path>
                <path class="lightning-branch" d="${rightBranch}"></path>
                <path class="lightning-fork" d="${upperFork}"></path>
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
            #stormLightningBolt {
                isolation: isolate;
            }

            #stormLightningBolt svg {
                width: 100%;
                height: 100%;
                overflow: visible;
                filter: drop-shadow(0 0 9px rgba(175, 220, 255, .95));
            }

            #stormLightningBolt path {
                fill: none;
                stroke-linecap: round;
                stroke-linejoin: round;
                vector-effect: non-scaling-stroke;
            }

            #stormLightningBolt .lightning-glow {
                stroke: rgba(115, 190, 255, .8);
                stroke-width: 15;
                opacity: .5;
            }

            #stormLightningBolt .lightning-main {
                stroke: #f8fcff;
                stroke-width: 3;
            }

            #stormLightningBolt .lightning-branch {
                stroke: #d9efff;
                stroke-width: 2;
            }

            #stormLightningBolt .lightning-fork {
                stroke: #bfe3ff;
                stroke-width: 1.5;
            }
        `;

        lightningBolt.appendChild(style);
        document.body.appendChild(lightningBolt);
    }

    function triggerLightning() {
        if (scene !== 'thunder') return;

        createLightningBolt();

        lightningBolt.animate(
            [
                { opacity: 0 },
                { opacity: .95, offset: .12 },
                { opacity: .18, offset: .24 },
                { opacity: .82, offset: .38 },
                { opacity: .3, offset: .48 },
                { opacity: 0, offset: 1 }
            ],
            {
                duration: 1050,
                easing: 'ease-out'
            }
        );
    }

    function startStormLightning() {
        clearInterval(stormTimer);

        if (scene !== 'thunder') return;

        stormTimer = setInterval(() => {
            if (Math.random() > .3) {
                document.dispatchEvent(new CustomEvent('thunder'));
            }
        }, 9000 + Math.random() * 10000);
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

    addSceneStyles();
    resize();
    updateCloudDetails();
    draw();
})();