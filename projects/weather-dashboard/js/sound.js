(() => {
    'use strict';

    const button = document.getElementById('soundToggle');
    if (!button) return;

    const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

    let audioContext;
    let masterGain;
    let ambientGain;
    let ambientSource;
    let playing = false;
    let currentScene = 'idle';
    let birdTimer = null;
    let thunderCooldown = false;

    const sounds = new Map();

    const files = {
        sun: ['sounds/sunny/nature.mp3'],
        birds: [
            'sounds/sunny/birds-01.mp3',
            'sounds/sunny/birds-02.mp3'
        ],
        clouds: ['sounds/wind/smooth-wind.mp3'],
        fog: ['sounds/wind/smooth-wind.mp3'],
        drizzle: [
            'sounds/rain/rain-light.mp3',
            'sounds/rain/drizzle.mp3'
        ],
        shower: [
            'sounds/rain/rain-shower.mp3',
            'sounds/rain/shower.mp3'
        ],
        rain: [
            'sounds/rain/rain-medium.mp3',
            'sounds/rain/rain-steady.mp3'
        ],
        thunderRain: [
            'sounds/rain/rain-heavy.mp3',
            'sounds/rain/thunder-rain.mp3'
        ],
        snow: ['sounds/snow/soft-winter-wind.mp3'],
        thunder: [
            'sounds/thunder/thunder-01.mp3',
            'sounds/thunder/thunder-02.mp3',
            'sounds/thunder/thunder-03.mp3'
        ]
    };

    const volumes = {
        idle: 0.025,
        sun: 0.14,
        clouds: 0.12,
        fog: 0.09,
        drizzle: 0.11,
        shower: 0.15,
        rain: 0.19,
        thunder: 0.12,
        snow: 0.12
    };

    function normaliseScene(scene, weatherCode) {
        const code = Number(weatherCode);

        if (code >= 80 && code <= 82) return 'shower';
        return scene || 'idle';
    }

    function setupAudioContext() {
        if (!AudioContextClass || audioContext) return;

        audioContext = new AudioContextClass();
        masterGain = audioContext.createGain();
        masterGain.gain.value = 0.8;
        masterGain.connect(audioContext.destination);

        createFallbackAmbient();
    }

    function createFallbackAmbient() {
        const duration = 10;
        const buffer = audioContext.createBuffer(
            1,
            audioContext.sampleRate * duration,
            audioContext.sampleRate
        );

        const data = buffer.getChannelData(0);
        let previous = 0;

        for (let index = 0; index < data.length; index += 1) {
            previous =
                previous * 0.96 +
                (Math.random() * 2 - 1) * 0.04;

            data[index] = previous * 2.5;
        }

        ambientSource = audioContext.createBufferSource();
        const filter = audioContext.createBiquadFilter();

        ambientGain = audioContext.createGain();
        ambientGain.gain.value = 0;

        ambientSource.buffer = buffer;
        ambientSource.loop = true;

        filter.type = 'lowpass';
        filter.frequency.value = 1600;

        ambientSource
            .connect(filter)
            .connect(ambientGain)
            .connect(masterGain);

        ambientSource.start();
    }

    function setFallbackVolume(scene) {
        if (!ambientGain || !audioContext) return;

        const sceneVolume = {
            idle: 0.01,
            sun: 0.008,
            clouds: 0.035,
            fog: 0.025,
            drizzle: 0.032,
            shower: 0.055,
            rain: 0.075,
            thunder: 0.065,
            snow: 0.02
        };

        ambientGain.gain.cancelScheduledValues(audioContext.currentTime);
        ambientGain.gain.setTargetAtTime(
            sceneVolume[scene] || 0.02,
            audioContext.currentTime,
            1
        );
    }

    function createAudio(src, loop = false) {
        const audio = new Audio(src);

        audio.loop = loop;
        audio.preload = 'auto';
        audio.volume = 0;

        audio.addEventListener('error', () => {
            console.warn(`Audio file unavailable: ${src}`);
            setFallbackVolume(currentScene);
        });

        return audio;
    }

    function getAudio(src, loop = false) {
        if (!sounds.has(src)) {
            sounds.set(src, createAudio(src, loop));
        }

        return sounds.get(src);
    }

    function randomItem(list) {
        return list[Math.floor(Math.random() * list.length)];
    }

    function playAudio(audio, volume) {
        if (!audio || !playing) return;

        audio.volume = volume;

        return audio.play().catch(() => {
            setFallbackVolume(currentScene);
        });
    }

    function fadeAudio(audio, target, duration = 900) {
        if (!audio) return;

        const start = audio.volume;
        const change = target - start;
        const started = performance.now();

        if (target > 0 && audio.paused) {
            playAudio(audio, 0);
        }

        function update(now) {
            const progress = Math.min(
                (now - started) / duration,
                1
            );

            audio.volume = Math.max(
                0,
                Math.min(1, start + change * progress)
            );

            if (progress < 1) {
                requestAnimationFrame(update);
            } else if (target === 0) {
                audio.pause();
                audio.currentTime = 0;
            }
        }

        requestAnimationFrame(update);
    }

    function stopAllSounds() {
        sounds.forEach(audio => fadeAudio(audio, 0));

        if (ambientGain && audioContext) {
            ambientGain.gain.setTargetAtTime(
                0,
                audioContext.currentTime,
                0.4
            );
        }
    }

    function stopTimers() {
        clearInterval(birdTimer);
        birdTimer = null;
    }

    function backgroundSoundFor(scene) {
        if (scene === 'thunder') return randomItem(files.thunderRain);
        return randomItem(files[scene] || files.clouds);
    }

    function playBackground(scene) {
        stopAllSounds();

        const background = getAudio(
            backgroundSoundFor(scene),
            true
        );

        playAudio(background, 0);
        fadeAudio(background, volumes[scene] || volumes.clouds, 1200);
        setFallbackVolume(scene);

        if (scene === 'sun') startBirds();
    }

    function playBird() {
        if (!playing || currentScene !== 'sun') return;

        const bird = getAudio(randomItem(files.birds));
        bird.currentTime = 0;
        playAudio(bird, 0.12);
    }

    function startBirds() {
        clearInterval(birdTimer);

        birdTimer = setInterval(() => {
            if (Math.random() > .3) playBird();
        }, 12000 + Math.random() * 9000);
    }

    function playFallbackThunder() {
        if (!audioContext || !masterGain || !playing) return;

        const duration = 2.4;
        const buffer = audioContext.createBuffer(
            1,
            Math.floor(audioContext.sampleRate * duration),
            audioContext.sampleRate
        );

        const data = buffer.getChannelData(0);
        let previous = 0;

        for (let index = 0; index < data.length; index += 1) {
            const progress = index / data.length;
            const decay = Math.pow(1 - progress, 1.8);

            previous =
                previous * 0.985 +
                (Math.random() * 2 - 1) * 0.08;

            data[index] = previous * decay * 1.4;
        }

        const source = audioContext.createBufferSource();
        const filter = audioContext.createBiquadFilter();
        const gain = audioContext.createGain();

        source.buffer = buffer;
        filter.type = 'lowpass';
        filter.frequency.value = 420;

        gain.gain.setValueAtTime(.001, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            .11,
            audioContext.currentTime + .12
        );
        gain.gain.exponentialRampToValueAtTime(
            .001,
            audioContext.currentTime + duration
        );

        source.connect(filter).connect(gain).connect(masterGain);
        source.start();
    }

    function playThunderSound() {
        if (!playing || currentScene !== 'thunder' || thunderCooldown) {
            return;
        }

        thunderCooldown = true;

        const thunder = getAudio(randomItem(files.thunder));
        thunder.currentTime = 0;
        thunder.volume = 0.1;

        thunder.play().catch(playFallbackThunder);

        setTimeout(() => {
            thunderCooldown = false;
        }, 6500);
    }

    function updateScene(scene, weatherCode) {
        currentScene = normaliseScene(scene, weatherCode);
        stopTimers();

        if (playing) {
            playBackground(currentScene);
        }
    }

    async function startSound() {
        setupAudioContext();

        if (!audioContext) {
            throw new Error('Web Audio is not supported.');
        }

        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        playing = true;
        playBackground(currentScene);

        button.textContent = '🔊 Ambient sound on';
        button.setAttribute('aria-pressed', 'true');
        document.body.classList.add('sound-active');
    }

    function stopSound() {
        playing = false;
        stopTimers();
        stopAllSounds();

        button.textContent = '🔇 Ambient sound off';
        button.setAttribute('aria-pressed', 'false');
        document.body.classList.remove('sound-active');
    }

    button.addEventListener('click', () => {
        if (playing) {
            stopSound();
        } else {
            startSound().catch(error => {
                console.error('Sound could not start:', error);
                button.textContent = '🔇 Sound unavailable';
            });
        }
    });

    document.addEventListener('weatherchange', event => {
        const detail = event.detail || {};
        updateScene(detail.scene, detail.weatherCode);
    });

    document.addEventListener('thunder', playThunderSound);
})();