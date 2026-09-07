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
        clouds: [],
        fog: [],
        drizzle: [
            'sounds/rain/drizzle.mp3',
            'sounds/rain/rain-light.mp3'
        ],
        'light-shower': [
            'sounds/rain/drizzle.mp3',
            'sounds/rain/rain-shower.mp3'
        ],
        shower: [
            'sounds/rain/rain-shower.mp3',
            'sounds/rain/shower.mp3'
        ],
        rain: [
            'sounds/rain/rain-medium.mp3',
            'sounds/rain/rain-steady.mp3'
        ],
        'heavy-rain': ['sounds/rain/rain-heavy.mp3'],
        thunderRain: ['sounds/rain/rain-heavy.mp3'],
        snow: ['sounds/snow/soft-winter-wind.mp3'],
        thunder: ['sounds/thunder/thunder-01.mp3']
    };

    const volumes = {
        idle: .018,
        sun: .075,
        clouds: .065,
        fog: .05,
        drizzle: .085,
        'light-shower': .105,
        shower: .14,
        rain: .18,
        'heavy-rain': .21,
        thunder: .23,
        snow: .065
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
        masterGain.gain.value = .62;
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
                previous * .96 +
                (Math.random() * 2 - 1) * .04;

            data[index] = previous * 1.7;
        }

        ambientSource = audioContext.createBufferSource();
        const filter = audioContext.createBiquadFilter();

        ambientGain = audioContext.createGain();
        ambientGain.gain.value = 0;

        ambientSource.buffer = buffer;
        ambientSource.loop = true;

        filter.type = 'lowpass';
        filter.frequency.value = 1500;

        ambientSource
            .connect(filter)
            .connect(ambientGain)
            .connect(masterGain);

        ambientSource.start();
    }

    function setFallbackVolume(scene) {
        if (!ambientGain || !audioContext) return;

        const sceneVolume = {
            idle: .006,
            sun: .005,
            clouds: .018,
            fog: .012,
            drizzle: .022,
            'light-shower': .029,
            shower: .04,
            rain: .052,
            'heavy-rain': .065,
            thunder: .075,
            snow: .014
        };

        ambientGain.gain.cancelScheduledValues(audioContext.currentTime);
        ambientGain.gain.setTargetAtTime(
            sceneVolume[scene] || .012,
            audioContext.currentTime,
            .8
        );
    }

    function createAudio(src, loop = false) {
        const audio = new Audio(src);

        audio.loop = loop;
        audio.preload = 'auto';
        audio.volume = 0;

        audio.addEventListener('error', () => {
            setFallbackVolume(currentScene);
        });

        return audio;
    }

    function getAudio(src, loop = false) {
        if (!src) return null;

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

    function fadeAudio(audio, target, duration = 1400) {
        if (!audio) return;

        const start = audio.volume;
        const change = target - start;
        const started = performance.now();

        if (target > 0 && audio.paused) {
            playAudio(audio, 0);
        }

        function update(now) {
            const progress = Math.min((now - started) / duration, 1);

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
                .35
            );
        }
    }

    function stopTimers() {
        clearInterval(birdTimer);
        birdTimer = null;
    }

    function backgroundSoundFor(scene) {
        if (scene === 'thunder') {
            return randomItem(files.thunderRain);
        }

        const sceneFiles = files[scene] || files.clouds;
        return sceneFiles.length ? randomItem(sceneFiles) : null;
    }

    function playBackground(scene) {
        stopAllSounds();

        const background = getAudio(
            backgroundSoundFor(scene),
            true
        );

        if (background) {
            playAudio(background, 0);
            fadeAudio(background, volumes[scene] || volumes.clouds, 1500);
        }

        setFallbackVolume(scene);

        if (scene === 'sun') startBirds();
    }

    function playBird() {
        if (!playing || currentScene !== 'sun') return;

        const bird = getAudio(randomItem(files.birds));
        bird.currentTime = 0;
        playAudio(bird, .06);
    }

    function startBirds() {
        clearInterval(birdTimer);

        birdTimer = setInterval(() => {
            if (Math.random() > .3) playBird();
        }, 12000 + Math.random() * 9000);
    }

    function playFallbackThunder() {
        if (!audioContext || !masterGain || !playing) return;

        const duration = 3.2;
        const buffer = audioContext.createBuffer(
            1,
            Math.floor(audioContext.sampleRate * duration),
            audioContext.sampleRate
        );

        const data = buffer.getChannelData(0);
        let previous = 0;

        for (let index = 0; index < data.length; index += 1) {
            const progress = index / data.length;
            const decay = Math.pow(1 - progress, 1.35);

            previous =
                previous * .985 +
                (Math.random() * 2 - 1) * .1;

            data[index] = previous * decay * 1.35;
        }

        const source = audioContext.createBufferSource();
        const filter = audioContext.createBiquadFilter();
        const gain = audioContext.createGain();

        source.buffer = buffer;
        filter.type = 'lowpass';
        filter.frequency.value = 480;

        gain.gain.setValueAtTime(.001, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            .16,
            audioContext.currentTime + .14
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

        if (thunder) {
            thunder.currentTime = 0;
            thunder.volume = .13;
            thunder.play().catch(playFallbackThunder);
        } else {
            playFallbackThunder();
        }

        setTimeout(() => {
            thunderCooldown = false;
        }, 4300);
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