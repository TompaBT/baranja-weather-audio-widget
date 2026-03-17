/* ============================================================
   DIO 1 — GLOBALNI STATE + KONFIGURACIJA
   ============================================================ */

// API PODACI
const apiKey = "";
const lat = 45.77;
const lon = 18.60;

// LINKOVI ZVUKOVA
const sounds = {
    zabe: "https://raw.githubusercontent.com/TompaBT/baranja-audio/main/Zvuk%20zabe.mp3",
    cvrcak: "https://raw.githubusercontent.com/TompaBT/baranja-audio/main/cvrcak.mp3",
    nocni: "https://raw.githubusercontent.com/TompaBT/baranja-audio/main/noc-zvono-lavez.mp3",
    pijetao: "https://raw.githubusercontent.com/TompaBT/baranja-audio/main/pijetao-jutro.mp3",
    grmljavina: "https://raw.githubusercontent.com/TompaBT/baranja-audio/main/grmljavina.mp3",
    kisa: "https://raw.githubusercontent.com/TompaBT/baranja-audio/main/kisa.mp3",
    snijeg: "https://raw.githubusercontent.com/TompaBT/baranja-audio/main/zimski-vjetar1.mp3",
    podne: "https://raw.githubusercontent.com/TompaBT/baranja-audio/main/zvono-podne.mp3",
    ptice: "https://raw.githubusercontent.com/TompaBT/baranja-audio/main/mixkit-forest-birds-ambience-1210.mp3",
    jastreb: "https://raw.githubusercontent.com/TompaBT/baranja-audio/main/jastreb.mp3",
    macka: "https://raw.githubusercontent.com/TompaBT/baranja-audio/main/macka.mp3"
};

// GLOBALNO STANJE
const state = {
    weather: {
        condition: null,
        description: null,
        temperature: null,
        feelsLike: null,
        wind: null,
        lastRainTime: null,
        isRaining: false,
        wasRaining: false,
        forecastData: null
    },

    audio: {
        channels: {},       // više audio kanala (ptice + jastreb + kiša…)
        currentMain: null,  // glavni zvuk (ptice, cvrčci, noćni…)
        frogsTimer: null,
        frogsActive: false,
        userMuted: false
    },

    time: {
        hour: null,
        minute: null,
        day: null,
        month: null,
        year: null,
        season: null
    }
};

// FUNKCIJA ZA GODIŠNJA DOBA
function getSeason(month) {
    if (month === 12 || month === 1 || month === 2) return "winter";
    if (month === 3 || month === 4 || month === 5) return "spring";
    if (month === 6 || month === 7 || month === 8) return "summer";
    if (month === 9 || month === 10 || month === 11) return "autumn";
}
/* ============================================================
   DIO 2 — AUDIO MIXER + ZVUKOVI
   ============================================================ */

/*  
   Ovaj sustav koristi VIŠE audio kanala.
   To znači da može raditi:
   - ptice + jastreb
   - ptice + mačka
   - kiša + grmljavina
   - snijeg + vjetar
   - žabe + ambijent
   Sve istovremeno, bez prekidanja.
*/

// Kreiraj audio kanal
function createChannel(name, volume = 1.0, loop = true) {
    const audio = new Audio();
    audio.loop = loop;
    audio.volume = volume;
    state.audio.channels[name] = audio;
    return audio;
}

// Inicijalizacija svih kanala
function initAudioChannels() {
    createChannel("main", 1.0);      // glavni ambijent (ptice, cvrčci, noćni)
    createChannel("weather", 1.0);   // kiša, snijeg, grmljavina
    createChannel("animals", 1.0);   // jastreb, mačka
    createChannel("effects", 1.0);   // pijetao, zvono, žabe
}

// Glatka promjena zvuka (fade-in/out)
function fadeTo(channelName, newSrc, duration = 1500) {
    const audio = state.audio.channels[channelName];
    if (!audio) return;

    if (audio.src.includes(newSrc)) return;

    const startVolume = audio.volume;
    const steps = 30;
    const stepTime = duration / steps;

    // Fade out
    let fadeOut = setInterval(() => {
        audio.volume -= startVolume / steps;
        if (audio.volume <= 0) {
            clearInterval(fadeOut);
            audio.src = newSrc;
            audio.currentTime = 0;

            if (!state.audio.userMuted) {
                audio.play().catch(() => {});
            }

            // Fade in
            let fadeIn = setInterval(() => {
                audio.volume += startVolume / steps;
                if (audio.volume >= startVolume) {
                    audio.volume = startVolume;
                    clearInterval(fadeIn);
                }
            }, stepTime);
        }
    }, stepTime);
}

// Glavna funkcija za promjenu ambijenta
function setMainAmbience(sound) {
    state.audio.currentMain = sound;
    fadeTo("main", sound);
}

// Pokretanje žaba nakon kiše
function startFrogs() {
    if (state.time.season !== "summer") return;
    if (state.weather.temperature < 18) return;

    state.audio.frogsActive = true;

    fadeTo("effects", sounds.zabe);

    clearTimeout(state.audio.frogsTimer);
    state.audio.frogsTimer = setTimeout(() => {
        state.audio.frogsActive = false;
        if (state.audio.currentMain) {
            fadeTo("main", state.audio.currentMain);
        }
    }, 90 * 1000); // 1.5 minute
}

// Random zvukovi (jastreb, mačka)
function playRandomAnimals() {
    if (state.time.hour < 7 || state.time.hour > 20) return; // samo danju

    const chance = Math.random();

    if (chance < 0.005) { // 0.5% šanse svakih 5 sekundi
        fadeTo("animals", sounds.jastreb, false);
        setTimeout(() => fadeTo("animals", ""), 5000);
    }

    if (chance > 0.995) { // 0.5% šanse
        fadeTo("animals", sounds.macka, false);
        setTimeout(() => fadeTo("animals", ""), 5000);
    }
}

// Mute / Unmute
function toggleUserSound() {
    state.audio.userMuted = !state.audio.userMuted;

    Object.values(state.audio.channels).forEach(ch => {
        if (state.audio.userMuted) ch.pause();
        else ch.play().catch(() => {});
    });

    return !state.audio.userMuted;
}

// Prvo pokretanje zvuka (mobiteli zahtijevaju user interaction)
function unlockAudio() {
    Object.values(state.audio.channels).forEach(ch => {
        ch.play().catch(() => {});
    });
}
window.addEventListener("click", unlockAudio, { once: true });
window.addEventListener("touchstart", unlockAudio, { once: true 
});
/* ============================================================
   DIO 3 — DOHVAT VREMENA + PROGNOZA + OSJEĆAJ TEMPERATURE
   ============================================================ */

// Dohvat trenutnog vremena
async function fetchWeather() {
    try {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=hr`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data || !data.weather || !data.weather[0]) return;

        // Spremanje podataka
        state.weather.condition = data.weather[0].main.toLowerCase();
        state.weather.description = data.weather[0].description;
        state.weather.temperature = Math.round(data.main.temp);
        state.weather.feelsLike = Math.round(data.main.feels_like);
        state.weather.wind = data.wind.speed;

        // Kiša logika
        if (state.weather.condition.includes("rain")) {
            state.weather.wasRaining = state.weather.isRaining;
            state.weather.isRaining = true;
            state.weather.lastRainTime = Date.now();
        } else {
            state.weather.wasRaining = state.weather.isRaining;
            state.weather.isRaining = false;
        }

        // Žabe nakon kiše
        if (!state.weather.isRaining && state.weather.wasRaining) {
            const secondsSinceRain = (Date.now() - state.weather.lastRainTime) / 1000;
            if (secondsSinceRain < 40) {
                startFrogs();
            }
        }

    } catch (err) {
        console.error("Greška pri dohvaćanju vremena:", err);
    }
}

// Dohvat 5-dnevne prognoze
async function fetchForecast() {
    try {
        const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=hr`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data || !data.list) return;

        state.weather.forecastData = data;

    } catch (err) {
        console.error("Greška pri dohvaćanju prognoze:", err);
    }
}

// Automatsko osvježavanje
function startWeatherLoop() {
    fetchWeather();
    fetchForecast();

    setInterval(fetchWeather, 60 * 1000);       // svake minute
    setInterval(fetchForecast, 10 * 60 * 1000); // svakih 10 minuta
}
/* ============================================================
   DIO 4 — ANIMACIJE VREMENA (KIŠA, SNIJEG, MAGLA, OLUJA)
   ============================================================ */

// Kreiraj canvas
const weatherCanvas = document.createElement("canvas");
weatherCanvas.id = "weatherCanvas";
weatherCanvas.style.position = "fixed";
weatherCanvas.style.top = "0";
weatherCanvas.style.left = "0";
weatherCanvas.style.width = "100%";
weatherCanvas.style.height = "100%";
weatherCanvas.style.pointerEvents = "none";
weatherCanvas.style.zIndex = "9999";

document.body.appendChild(weatherCanvas);

const wctx = weatherCanvas.getContext("2d");

let W = window.innerWidth;
let H = window.innerHeight;

weatherCanvas.width = W;
weatherCanvas.height = H;

window.addEventListener("resize", () => {
    W = window.innerWidth;
    H = window.innerHeight;
    weatherCanvas.width = W;
    weatherCanvas.height = H;
});

/* ============================================================
   KIŠA
   ============================================================ */

let rainDrops = [];

function createRain(intensity = 150) {
    rainDrops = [];
    for (let i = 0; i < intensity; i++) {
        rainDrops.push({
            x: Math.random() * W,
            y: Math.random() * H,
            length: 10 + Math.random() * 20,
            speed: 4 + Math.random() * 4,
            wind: 0
        });
    }
}

function drawRain() {
    wctx.strokeStyle = "rgba(180,180,255,0.6)";
    wctx.lineWidth = 2;

    rainDrops.forEach(drop => {
        wctx.beginPath();
        wctx.moveTo(drop.x, drop.y);
        wctx.lineTo(drop.x + drop.wind, drop.y + drop.length);
        wctx.stroke();

        drop.y += drop.speed;
        drop.x += drop.wind * 0.2;

        if (drop.y > H) {
            drop.y = -20;
            drop.x = Math.random() * W;
        }
    });
}

/* ============================================================
   SNIJEG
   ============================================================ */

let snowFlakes = [];

function createSnow(intensity = 120) {
    snowFlakes = [];
    for (let i = 0; i < intensity; i++) {
        snowFlakes.push({
            x: Math.random() * W,
            y: Math.random() * H,
            radius: 1 + Math.random() * 3,
            speed: 0.5 + Math.random() * 1.5,
            drift: Math.random() * 1 - 0.5
        });
    }
}

function drawSnow() {
    wctx.fillStyle = "rgba(255,255,255,0.9)";

    snowFlakes.forEach(flake => {
        wctx.beginPath();
        wctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
        wctx.fill();

        flake.y += flake.speed;
        flake.x += flake.drift;

        if (flake.y > H) {
            flake.y = -10;
            flake.x = Math.random() * W;
        }
    });
}

/* ============================================================
   MAGLA
   ============================================================ */

let fogLayers = [];

function createFog() {
    fogLayers = [
        { opacity: 0.15, speed: 0.2, offset: 0 },
        { opacity: 0.25, speed: 0.1, offset: 200 },
        { opacity: 0.35, speed: 0.05, offset: 400 }
    ];
}

function drawFog() {
    fogLayers.forEach(layer => {
        wctx.fillStyle = `rgba(200,200,200,${layer.opacity})`;
        wctx.fillRect(-layer.offset, 0, W + 400, H);
        layer.offset += layer.speed;
        if (layer.offset > 400) layer.offset = 0;
    });
}

/* ============================================================
   MUNJE (BLJESKOVI)
   ============================================================ */

let lightningFlash = 0;

function triggerLightning() {
    if (Math.random() < 0.01) { // 1% šanse svaki frame
        lightningFlash = 1;
    }
}

function drawLightning() {
    if (lightningFlash > 0) {
        wctx.fillStyle = `rgba(255,255,255,${lightningFlash})`;
        wctx.fillRect(0, 0, W, H);
        lightningFlash -= 0.05;
    }
}

/* ============================================================
   GLAVNA PETLJA ANIMACIJA
   ============================================================ */

function startWeatherEffects() {
    createRain();
    createSnow();
    createFog();

    function animate() {
        wctx.clearRect(0, 0, W, H);

        const cond = state.weather.condition || "";
        const wind = state.weather.wind || 0;

        // Kiša
        if (cond.includes("rain")) {
            rainDrops.forEach(d => d.wind = wind * 1.5);
            drawRain();
        }

        // Snijeg
        if (cond.includes("snow")) {
            snowFlakes.forEach(f => f.drift = wind * 0.2);
            drawSnow();
        }

        // Magla
        if (cond.includes("fog") || cond.includes("mist")) {
            drawFog();
        }

        // Oluja
        if (cond.includes("thunder")) {
            triggerLightning();
            drawLightning();
        }

        requestAnimationFrame(animate);
    }

    animate();
}
/* ============================================================
   DIO 5 — UI ZA VRIJEME + PROGNOZA + PRAZNICI
   ============================================================ */

/* -------------------------------------------
   HRVATSKI PRAZNICI + IZRAČUN USKRSA
------------------------------------------- */

const fixedHolidays = {
    "1-1": "Nova godina",
    "1-6": "Sveta tri kralja",
    "5-1": "Praznik rada",
    "5-30": "Dan državnosti",
    "6-22": "Dan antifašističke borbe",
    "8-5": "Dan pobjede i domovinske zahvalnosti",
    "8-15": "Velika Gospa",
    "11-1": "Svi sveti",
    "11-18": "Dan sjećanja",
    "12-25": "Božić",
    "12-26": "Sveti Stjepan"
};

function getEasterDate(year) {
    const f = Math.floor;
    const G = year % 19;
    const C = f(year / 100);
    const H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30;
    const I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11));
    const J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7;
    const L = I - J;
    const month = 3 + f((L + 40) / 44);
    const day = L + 28 - 31 * f(month / 4);
    return { day, month };
}

function getHolidayName(day, month, year) {
    const key = `${day}-${month}`;
    if (fixedHolidays[key]) return fixedHolidays[key];

    const easter = getEasterDate(year);
    const easterMonday = new Date(year, easter.month - 1, easter.day + 1);

    if (day === easter.day && month === easter.month) return "Uskrs";
    if (day === easterMonday.getDate() && month === easterMonday.getMonth() + 1)
        return "Uskrsni ponedjeljak";

    return null;
}

function getDateColor(day, month, year) {
    const date = new Date(year, month - 1, day);
    const dow = date.getDay(); // 0 = nedjelja, 6 = subota

    if (dow === 0) return "red";
    if (dow === 6) return "blue";

    if (getHolidayName(day, month, year)) return "green";

    return "white";
}

/* -------------------------------------------
   UI ZA TRENUTNO VRIJEME
------------------------------------------- */

function startWeatherUI() {
    updateWeatherUI();
    setInterval(updateWeatherUI, 2000);
}

function updateWeatherUI() {
    const temp = state.weather.temperature;
    const feels = state.weather.feelsLike;
    const cond = state.weather.condition;
    const desc = state.weather.description;
    const season = state.time.season;

    if (temp == null || !cond) return;

    const ikoneVrijeme = {
        clear: "☀️",
        clouds: "☁️",
        rain: "🌧️",
        snow: "❄️",
        mist: "🌫️",
        fog: "🌫️",
        drizzle: "🌦️",
        thunderstorm: "⛈️"
    };

    const prijevodVrijeme = {
        clear: "Vedro",
        clouds: "Oblačno",
        rain: "Kiša",
        snow: "Snijeg",
        mist: "Magla",
        fog: "Magla",
        drizzle: "Rosulja",
        thunderstorm: "Grmljavina"
    };

    const ikoneSezona = {
        winter: "❄️",
        spring: "🌸",
        summer: "☀️",
        autumn: "🍂"
    };

    const iconEl = document.querySelector(".weather-icon");
    const tempEl = document.querySelector(".weather-temp");
    const descEl = document.querySelector(".weather-desc");
    const locEl = document.querySelector(".weather-location");
    const extraEl = document.querySelector(".weather-extra");

    iconEl.textContent = ikoneVrijeme[cond] || "🌤️";
    tempEl.textContent = `${temp}° (osjećaj ${feels}°)`;
    descEl.textContent = `${prijevodVrijeme[cond] || desc}`;
    locEl.textContent = "Baranja";
    extraEl.textContent = `${ikoneSezona[season]} ${season.toUpperCase()}`;

    const box = document.querySelector(".weather-box");
    if (box) {
        box.classList.remove("winter", "spring", "summer", "autumn");
        box.classList.add(season);
    }

    if (state.weather.forecastData) {
        updateForecastUI(state.weather.forecastData);
    }
}

/* -------------------------------------------
   UI ZA 3-DNEVNU PROGNOZU
------------------------------------------- */

function updateForecastUI(data) {
    const days = document.querySelectorAll(".forecast-day");
    if (!days.length) return;

    const list = data.list;
    const grouped = {};

    list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const day = date.getDate();
        if (!grouped[day]) grouped[day] = [];
        grouped[day].push(item);
    });

    const keys = Object.keys(grouped).slice(1, 4);

    keys.forEach((dayKey, i) => {
        const items = grouped[dayKey];
        const date = new Date(items[0].dt * 1000);

        const avgTemp = Math.round(
            items.reduce((sum, item) => sum + item.main.temp, 0) / items.length
        );

        const icon = items[0].weather[0].icon;
        const cond = items[0].weather[0].main.toLowerCase();

        const dayName = date.toLocaleDateString("hr-HR", { weekday: "short" });
        const holiday = getHolidayName(date.getDate(), date.getMonth() + 1, date.getFullYear());
        const color = getDateColor(date.getDate(), date.getMonth() + 1, date.getFullYear());

        days[i].querySelector(".f-day-name").textContent =
            holiday ? `${dayName} (${holiday})` : dayName;

        days[i].querySelector(".f-day-icon").textContent = getEmoji(icon);
        days[i].querySelector(".f-day-temp").textContent = `${avgTemp}°`;

        days[i].style.color = color;
    });
}

function getEmoji(icon) {
    if (icon.includes("01")) return "☀️";
    if (icon.includes("02")) return "🌤️";
    if (icon.includes("03")) return "⛅";
    if (icon.includes("04")) return "☁️";
    if (icon.includes("09")) return "🌧️";
    if (icon.includes("10")) return "🌦️";
    if (icon.includes("11")) return "⛈️";
    if (icon.includes("13")) return "❄️";
    if (icon.includes("50")) return "🌫️";
    return "⛅";
}
/* ============================================================
   DIO 6 — SAT + DATUM + INICIJALIZACIJA SUSTAVA
   ============================================================ */

/* -------------------------------------------
   SAT I DATUM (BING STIL)
------------------------------------------- */

function startClockUI() {
    updateClockUI();
    setInterval(updateClockUI, 1000);
}

function updateClockUI() {
    const now = new Date();

    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");

    const day = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const days = ["Nedjelja","Ponedjeljak","Utorak","Srijeda","Četvrtak","Petak","Subota"];
    const months = ["Siječnja","Veljače","Ožujka","Travnja","Svibnja","Lipnja","Srpnja","Kolovoza","Rujna","Listopada","Studenoga","Prosinca"];

    const timeEl = document.querySelector(".clock-time");
    const dateEl = document.querySelector(".clock-date");

    if (!timeEl || !dateEl) return;

    timeEl.textContent = `${hh}:${mm}`;

    const holiday = getHolidayName(day, month, year);
    const color = getDateColor(day, month, year);

    dateEl.textContent = holiday
        ? `${days[now.getDay()]}, ${day}. ${months[now.getMonth()]} ${year}. (${holiday})`
        : `${days[now.getDay()]}, ${day}. ${months[now.getMonth()]} ${year}.`;

    dateEl.style.color = color;
}

/* -------------------------------------------
   AŽURIRANJE VREMENA (SAT, MINUTA, SEZONA)
------------------------------------------- */

function updateTime() {
    const now = new Date();

    state.time.hour = now.getHours();
    state.time.minute = now.getMinutes();
    state.time.day = now.getDate();
    state.time.month = now.getMonth() + 1;
    state.time.year = now.getFullYear();
    state.time.season = getSeason(state.time.month);
}

function startTimeLoop() {
    updateTime();
    setInterval(updateTime, 30 * 1000);
}

/* -------------------------------------------
   POSEBNI DOGAĐAJI (PIJETAO, PODNE, NOĆNI)
------------------------------------------- */

function checkTimeEvents() {
    const hour = state.time.hour;
    const minute = state.time.minute;

    // Pijetao (05:55 – 06:05)
    if (hour === 5 && minute >= 55 && minute <= 59) {
        fadeTo("effects", sounds.pijetao);
    }
    if (hour === 6 && minute <= 5) {
        fadeTo("effects", sounds.pijetao);
    }

    // Podnevno zvono (12:00 – 12:05)
    if (hour === 12 && minute <= 5) {
        fadeTo("effects", sounds.podne);
    }

    // Noćni ambijent (22:00 – 05:55)
    if (hour >= 22 || hour < 6) {
        if (!state.audio.frogsActive) {
            setMainAmbience(sounds.nocni);
        }
        return;
    }

    // Dnevni ambijent (ptice)
    if (!state.audio.frogsActive) {
        setMainAmbience(sounds.ptice);
    }
}

/* -------------------------------------------
   GLAVNA PETLJA SUSTAVA
------------------------------------------- */

function startMainLoop() {
    setInterval(() => {
        checkTimeEvents();
        playRandomAnimals();
    }, 5000);
}

/* -------------------------------------------
   INICIJALIZACIJA CIJELOG WIDGETA
------------------------------------------- */

function startWidget() {
    initAudioChannels();
    startWeatherEffects();
    startWeatherLoop();
    startWeatherUI();
    startClockUI();
    startTimeLoop();
    startMainLoop();

    console.log("Baranja Widget pokrenut ✔");
}

// Pokreni widget nakon učitavanja stranice
window.addEventListener("load", startWidget);
