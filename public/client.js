const socket = io();

const textDiv = document.getElementById("text");
const hiddenInput = document.getElementById("hiddenInput");

const caret = document.getElementById("caret");

const countdown = document.getElementById("countdown");

const wpmText = document.getElementById("wpm");
const accuracyText = document.getElementById("accuracy");
const errorsText = document.getElementById("errors");

const playersDiv = document.getElementById("players");

const winnerDiv = document.getElementById("winner");

const popup = document.getElementById("popup");

const joinBtn = document.getElementById("joinBtn");

const nameInput = document.getElementById("nameInput");

const passwordInput = document.getElementById("passwordInput");

const startBtn = document.getElementById("startBtn");

const masterPanel = document.getElementById("masterPanel");

const customText = document.getElementById("customText");

const victorySound = new Audio("/victory.mp3");
victorySound.volume = 0.5;

let raceText = "";
let myName = "";

let totalTyped = 0;
let started = false;
let startTime = 0;
let isMaster = false;
let totalErrorsMade = 0;
let lastInput = "";

hiddenInput.addEventListener("paste", (e) => {
    e.preventDefault();
});

hiddenInput.addEventListener("copy", (e) => {
    e.preventDefault();
});

hiddenInput.addEventListener("cut", (e) => {
    e.preventDefault();
});

hiddenInput.addEventListener("contextmenu", (e) => {
    e.preventDefault();
});

hiddenInput.addEventListener("keydown", (e) => {

    if (!started) {
        e.preventDefault();
    }
});

document.addEventListener("visibilitychange", () => {

    if (document.visibilityState === "visible") {

        if (started && !isMaster) {
            hiddenInput.focus();
        }
    }
});

window.addEventListener("focus", () => {

    if (started && !isMaster) {
        hiddenInput.focus();
    }
});

document.addEventListener("click", () => {

    if (started && !isMaster) {
        hiddenInput.focus();
    }
});

nameInput.addEventListener("input", () => {

    nameInput.value = nameInput.value
        .replace(/[\u{1F600}-\u{1F6FF}]/gu, '') // emoticonos
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // símbolos varios
        .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // extensiones
        .replace(/[\u{2600}-\u{26FF}]/gu, '')   // símbolos misceláneos
        .replace(/[\u{2700}-\u{27BF}]/gu, '');  // dingbats
});

joinBtn.onclick = () => {

    let cleanName = nameInput.value
        .replace(/[\u{1F600}-\u{1F6FF}]/gu, '')
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
        .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
        .replace(/[\u{2600}-\u{26FF}]/gu, '')
        .replace(/[\u{2700}-\u{27BF}]/gu, '')
        .trim()
        .slice(0, 26);

    myName = cleanName;
    if (!cleanName) {
        alert("Escribe un nombre válido");
        return;
    }
    socket.emit("join", {
        name: cleanName,
        password: passwordInput.value
    });

    popup.style.display = "none";

    hiddenInput.focus();
};

socket.on("kicked", () => {

    alert("Has sido expulsado del juego.");

    window.location.reload();
});

socket.on("master", () => {

    isMaster = true;

    masterPanel.style.display = "block";

    hiddenInput.style.display = "none";
    document.getElementById("stats").style.display = "none";
    document.getElementById("textContainer").style.display = "none";


});

customText.addEventListener("input", () => {

    socket.emit("setText", customText.value);
});

startBtn.onclick = () => {

    socket.emit("startGame");
};

socket.on("text", (text) => {

    raceText = text;
    caret.style.display = "block";
    renderText();

    hiddenInput.value = "";

    winnerDiv.innerText = "";

    totalTyped = 0;
    totalErrorsMade = 0;
    lastInput = "";

    started = false;

    wpmText.innerText = "0 PPM";
    accuracyText.innerText = "100%";
    errorsText.innerText = "0 errores";

    caret.style.left = "0px";
    caret.style.top = "0px";
});

socket.on("countdown", (count) => {

    countdown.innerText = count > 0 ? count : "¡AHORA!";
});

socket.on("startRace", () => {

    if (isMaster) return;

    hiddenInput.value = "";

    lastInput = "";

    totalTyped = 0;

    totalErrorsMade = 0;

    started = true;

    startTime = Date.now();

    hiddenInput.focus();
});

hiddenInput.addEventListener("input", () => {

    if (!started) return;

    const value = hiddenInput.value;

    if (value.length > raceText.length) {

        hiddenInput.value = value.slice(0, raceText.length);

        return;
    }
    
    if (value.length > lastInput.length) {

        const index = value.length - 1;

        if (raceText[index] && value[index] !== raceText[index]) {
            totalErrorsMade++;
        }
    }

    lastInput = value;
    totalTyped++;

    let html = "";
    let correctProgress = 0;

    for (let i = 0; i < value.length; i++) {
    
        if (value[i] === raceText[i]) {
            correctProgress++;
        } else {
            break;
        }
    }
    let correctChars = 0;

    for (let i = 0; i < raceText.length; i++) {

        const char = raceText[i];

        if (i < value.length) {

            if (value[i] === char) {

                html += `<span class="correct">${char}</span>`;

                correctChars++;

            } else {

                html += `<span class="incorrect">${char}</span>`;
            }

        } else if (i === value.length) {

            html += `<span class="current">${char}</span>`;
        } else {

            html += char;
        }
    }

    textDiv.innerHTML = html;

    const spans = document.querySelectorAll("#text span");

    if (spans[value.length]) {

        const rect = spans[value.length].getBoundingClientRect();

        const container = textDiv.getBoundingClientRect();

        caret.style.left = rect.left - container.left + "px";
        caret.style.top = rect.top - container.top + "px";
    }

    const errors = totalErrorsMade;

    const accuracy = Math.max(
        0,
        Math.round((correctChars / totalTyped) * 100)
    );

    const minutes = (Date.now() - startTime) / 1000 / 60;

    const wpm = Math.round((correctChars / 5) / minutes) || 0;

    wpmText.innerText = wpm + " PPM";

    accuracyText.innerText = accuracy + "%";

    errorsText.innerText = errors + " errores";

    const progress = raceText.length > 0
    ? Math.min((correctProgress / raceText.length) * 100, 100)
    : 0;

    socket.emit("typing", {
        progress,
        wpm,
        errors
    });

    if (
    value.length === raceText.length &&
    correctChars === raceText.length
    ) {
        started = false;
        caret.style.display = "none";
        hiddenInput.blur();
    }
});

function renderText() {

    let html = "";

    for (let i = 0; i < raceText.length; i++) {

        if (i === 0) {

            html += `<span class="current">${raceText[i]}</span>`;
        } else {

            html += raceText[i];
        }
    }

    textDiv.innerHTML = html;
}

socket.on("updatePlayers", (players) => {

    playersDiv.innerHTML = "";

    const filteredPlayers = Object.entries(players)
        .filter(([id, player]) => !player.isMaster && player.joined);

    if (isMaster) {

        const sorted = filteredPlayers
            .sort((a, b) => b[1].progress - a[1].progress);

        sorted.forEach(([id, player], index) => {

            const div = document.createElement("div");
            div.classList.add("player");

            div.innerHTML = `
                <div class="playerInfo">
                    <span>#${index + 1} ${player.name}</span>

                    <div style="display:flex; gap:10px; align-items:center;">
                        <span>${Math.round(player.progress)}%</span>
                        <button class="kickBtn" onclick="kickPlayer('${id}')">❌</button>
                    </div>
                </div>

                <div class="bar">
                    <div class="fill" style="width:${player.progress}%"></div>
                </div>
            `;

            playersDiv.appendChild(div);
        });

        return;
    }

    const myId = socket.id;

    const meEntry = filteredPlayers.find(([id]) => id === myId);

    if (!meEntry) return;

    const player = meEntry[1];

    const div = document.createElement("div");
    div.classList.add("player");

    div.innerHTML = `
        <div class="playerInfo">
            <span>${myName}</span>
            <span>${Math.round(player.progress)}%</span>
        </div>

        <div class="bar">
            <div class="fill" style="width:${player.progress}%"></div>
        </div>
    `;

    playersDiv.appendChild(div);
});

socket.on("raceFinished", ({ winner, ranking }) => {

    started = false;

    winnerDiv.innerText = "🏆 #1 - " + winner;

    playersDiv.innerHTML = "";

    ranking.forEach(player => {

    const isMe = player.name === myName;

    const div = document.createElement("div");

    div.classList.add("player");

    if (isMaster){
        victorySound.currentTime = 0;
        victorySound.play();
    }
    if (isMe) {
        div.classList.add("meFinal");
    }
        
    countdown.innerText = "🏁 RANKING FINAL";
        
    div.innerHTML = `
        <div class="playerInfo">
            <span>
                #${player.position} ${player.name} ${"⭐".repeat(player.stars)}
            </span>

            <span>
                ${player.wpm} PPM | ${player.errors} errores
            </span>
        </div>

        <div class="bar">
            <div class="fill" style="width:${player.progress}%"></div>
        </div>
    `;

        playersDiv.appendChild(div);
    });
});

socket.on("resetRace", () => {

    hiddenInput.value = "";

    totalTyped = 0;
    totalErrorsMade = 0;
    lastInput = "";
    
    started = false;
    caret.style.display = "block";
    renderText();

    caret.style.left = "0px";
    caret.style.top = "0px";

    wpmText.innerText = "0 PPM";

    accuracyText.innerText = "100%";

    errorsText.innerText = "0 errores";

    winnerDiv.innerText = "";
});

function kickPlayer(playerId) {

    if (confirm("¿Expulsar jugador?")) {

        socket.emit("kickPlayer", playerId);
    }
}
socket.on("waitingNextRace", () => {

    alert(
        "La carrera ya comenzó. Espera a la siguiente ronda."
    );

    window.location.reload();
});
