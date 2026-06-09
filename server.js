const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const players = {};
const waitingPlayers = {};

let currentText = "";
let raceStarted = false;
let winner = null;
let countdownRunning = false;
let raceStartTime = 0;
let raceText = "";

function resetPlayers() {

    for (let id in players) {

        if (!players[id].isMaster) {

            players[id].progress = 0;
            players[id].wpm = 0;
            players[id].errors = 0; 
        }
    }

    io.emit("updatePlayers", players);
    io.emit("resetRace");
}


function startRace() {

    if (countdownRunning) return;

    countdownRunning = true;

    raceStarted = false;

    winner = null;

    io.emit("text", currentText);

    let count = 5;

    const interval = setInterval(() => {

        io.emit("countdown", count);

        count--;

        if (count < 0) {

            clearInterval(interval);

            countdownRunning = false;

            raceStarted = true;
            raceStartTime = Date.now();
            
            io.emit("startRace");
        }

    }, 1000);
}

io.on("connection", (socket) => {


    socket.on("join", (data) => {

    const player = {
        name: data.name,
        stars: 0,
        progress: 0,
        wpm: 0,
        errors: 0,
        isMaster: false
    };

    if (raceStarted || countdownRunning) {

        waitingPlayers[socket.id] = player;

        socket.emit("waitingNextRace");

        return;
    }

    players[socket.id] = player;

    if (data.password === "socket.id") {

        players[socket.id].isMaster = true;
        players[socket.id].name = "MAESTRO";

        socket.emit("master");
    }

    io.emit("updatePlayers", players);
});

    socket.on("setText", (text) => {
        if (!players[socket.id]) return;
        raceText = text;
        if (!players[socket.id].isMaster) return;

        currentText = text;

        io.emit("text", currentText);
    });

socket.on("startGame", () => {

    if (!players[socket.id]) return;
    if (!players[socket.id].isMaster) return;

    Object.assign(players, waitingPlayers);
    waitingPlayers = {};

    resetPlayers();
    startRace();
});

    socket.on("typing", (data) => {
        if (!players[socket.id]) return;
        if (!raceStarted) return;

        if (winner) return;

        if (players[socket.id].isMaster) return;

        players[socket.id].progress = data.progress;
        players[socket.id].wpm = data.wpm;
        players[socket.id].errors = data.errors;

        io.emit("updatePlayers", players);

        if (data.progress >= 100 && !winner) {

            winner = players[socket.id].name;

            // ⭐ sumar estrella al ganador
            players[socket.id].stars += 1;

            raceStarted = false;

            const ranking = Object.entries(players)
                .filter(([id, p]) => !p.isMaster)
                .map(([id, p]) => {

                    const minutes = Math.max((Date.now() - raceStartTime) / 1000 / 60, 0.01);

                    const estimatedChars = (p.progress / 100) * (raceText?.length || 1);

                    const realWpm = Math.round((estimatedChars / 5) / minutes);

                    return {
                        name: p.name,
                        stars: p.stars,
                        wpm: realWpm,
                        errors: p.errors,
                        progress: p.progress
                    };
                })
                .sort((a, b) => b.progress - a.progress)
                .map((p, index) => ({
                    ...p,
                    position: index + 1
                }));

            io.emit("raceFinished", {
                winner,
                ranking
            });
        }
    });

    socket.on("kickPlayer", (playerId) => {
        if (!players[socket.id]) return;
        if (!players[socket.id]?.isMaster) return;

        if (players[playerId]) {

            io.to(playerId).emit("kicked");

            delete players[playerId];

            io.emit("updatePlayers", players);
        }
    });
       socket.on("disconnect", () => {
    
        delete players[socket.id];
        delete waitingPlayers[socket.id];
    
        io.emit("updatePlayers", players);
    });
});


server.listen(3000, () => {

    console.log("Servidor corriendo en http://localhost:3000");
});
