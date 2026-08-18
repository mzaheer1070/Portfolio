(() => {
    'use strict';

    const button = document.getElementById('soundToggle');
    if (!button) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;

    let context;
    let master;
    let fallback;
    let playing = false;
    let currentScene = 'idle';
    let ambienceTimer;
    let thunderTimer;
    const audio = new Map();

    const files = {
        sun: [
            'sounds/sunny/nature.mp3'
        ],
        birds: [
            'sounds/sunny/birds-01.mp3',
            'sounds/sunny/birds-02.mp3'
        ],
        clouds: [
            'sounds/wind/smooth-wind.mp3'
        ],
        fog: [
            'sounds/wind/smooth-wind.mp3'
        ],
        drizzle: [
            'sounds/rain/rain-light.mp3'
        ],
        rain: [
            'sounds/rain/rain-medium.mp3'
        ],
        thunderRain: [
            'sounds/rain/rain-heavy.mp3'
        ],
        snow: [
            'sounds/snow/soft-winter-wind.mp3'
        ],
        thunder: [
            'sounds/thunder/thunder-01.mp3',
            'sounds/thunder/thunder-02.mp3',
            'sounds/thunder/thunder-03.mp3'
        ]
    };

    function createAudio(src, loop = false) {
        const sound = new Audio(src);
        sound.loop = loop;
        sound.preload = 'auto';
        sound.volume = 0;
        sound.addEventListener('error', () => {
            console.warn(`Audio file not found: ${src}`);
        });
        return sound;
    }

    function getAudio(src, loop = false) {
        if (!audio.has(src)) {
            audio.set(src, createAudio(src, loop));
        }

        return audio.get(src);
    }

    function randomItem(list) {
        return list[Math.floor(Math.random() * list.length)];
    }

    function fadeAudio(sound, volume, duration = 1400) {
        if (!sound) return;

        const start = sound.volume;
        const difference = volume - start;
        const started = performance.now();

        if (volume > 0 && sound.paused) {
            sound.play().catch(() => {});
        }

        function animate(now) {
            const progress = Math.min((now - started) / duration, 1);
            sound.volume = Math.max(
                0,
                Math.min(1, start + difference * progress)
            );

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else if (volume === 0) {
                sound.pause();
                sound.currentTime = 0;
            }
        }

        requestAnimationFrame(animate);
    }

    function stopAudioFiles() {
        audio.forEach(sound => fadeAudio(sound, 0, 900));
    }

    function playBackground(scene) {
        stopAudioFiles();

        let list;
        let volume = 0.2;

        if (scene === 'thunder') {
            list = files.thunderRain;
            volume = 0.3;
        } else {
            list = files[scene] || files.clouds;
        }

        const source = getAudio(list[0], true);
        fadeAudio(source, volume, 1800);

        if (scene === 'sun') {
            startBirds();
        }
    }

    function playBird() {
        if (!playing || currentScene !== 'sun') return;

        const source = getAudio(randomItem(files.birds));
        source.currentTime = 0;
        source.volume = 0.18;
        source.play().catch(() => {});
    }

    function startBirds() {
        clearInterval(ambienceTimer);

        ambienceTimer = setInterval(() => {
            if (Math.random() > 0.25) {
                playBird();
            }
        }, 12000 + Math.random() * 9000);
    }

    function playThunderFile() {
        if (!playing || currentScene !== 'thunder') return;

        const source = getAudio(randomItem(files.thunder));
        source.currentTime = 0;
        source.volume = 0.55;
        source.play().catch(() => {});
    }

    function startThunder() {
        clearInterval(thunderTimer);

        thunderTimer = setInterval(() => {
            if (Math.random() > 0.25) {
                playThunderFile();
            }
        }, 18000 + Math.random() * 22000);
    }

    function createFallback() {
        if (!AudioContext || context) return;

        context = new AudioContext();
        master = context.createGain();
        master.gain.value = 0;
        master.connect(context.destination);

        const noise = context.createBuffer(
            1,
            context.sampleRate * 12,
            context.sampleRate
        );
        const data = noise.getChannelData(0);

        let previous = 0;

        for (let i = 0; i < data.length; i++) {
            previous = previous * 0.96 + (Math.random() * 2 - 1) * 0.04;
            data[i] = previous * 2;
        }

        const source = context.createBufferSource();
        const filter = context.createBiquadFilter();
        const gain = context.createGain();

        source.buffer = noise;
        source.loop = true;
        filter.type = 'lowpass';
        filter.frequency.value = 1800;
        gain.gain.value = 0;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        source.start();

        fallback = gain;
    }

    function playFallback(scene) {
        if (!context || !fallback) return;

        const volume = {
            idle: 0.015,
            sun: 0.01,
            clouds: 0.035,
            fog: 0.025,
            drizzle: 0.045,
            rain: 0.08,
            thunder: 0.1,
            snow: 0.02,
            night: 0.01
        };

        fallback.gain.cancelScheduledValues(context.currentTime);
        fallback.gain.setTargetAtTime(
            volume[scene] || 0.02,
            context.currentTime,
            1.5
        );
    }

    function sceneSound(scene) {
        currentScene = scene;

        if (!playing) return;

        playBackground(scene);
        playFallback(scene);

        if (scene === 'thunder') {
            startThunder();
        } else {
            clearInterval(thunderTimer);
        }
    }

    async function start() {
        if (AudioContext) {
            createFallback();

            if (context.state === 'suspended') {
                await context.resume();
            }

            master.gain.setTargetAtTime(
                0.7,
                context.currentTime,
                0.8
            );
        }

        playing = true;
        sceneSound(currentScene);

        button.textContent = '🔊 Ambient sound on';
        button.setAttribute('aria-pressed', 'true');
        document.body.classList.add('sound-active');
    }

    function stop() {
        playing = false;

        clearInterval(ambienceTimer);
        clearInterval(thunderTimer);
        stopAudioFiles();

        if (context && master) {
            master.gain.setTargetAtTime(
                0,
                context.currentTime,
                0.4
            );
        }

        button.textContent = '🔇 Ambient sound off';
        button.setAttribute('aria-pressed', 'false');
        document.body.classList.remove('sound-active');
    }

    button.addEventListener('click', () => {
        const action = playing ? stop() : start();

        if (action?.catch) {
            action.catch(() => {
                button.textContent = '🔇 Sound unavailable';
            });
        }
    });

    document.addEventListener('weatherchange', event => {
        sceneSound(event.detail.scene);
    });

    document.addEventListener('thunder', playThunderFile);
})();