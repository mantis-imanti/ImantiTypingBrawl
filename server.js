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
let gameState = "lobby";

function resetPlayers() {

    for (let id in players) {

        if (!players[id].isMaster) {
            players[id].progress = 0;
            players[id].wpm = 0;
            players[id].errors = 0;
        }
    }

    gameState = "lobby";

    io.emit("updatePlayers", players);
    io.emit("resetRace");
}


function startRace() {

    gameState = "racing";

    winner = null;

    io.emit("text", currentText);

    let count = 5;

    const interval = setInterval(() => {

        io.emit("countdown", count);

        count--;

        if (count < 0) {

            clearInterval(interval);

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

    if (data.password === "socket.id") {

        player.isMaster = true;
        player.name = "MAESTRO";

        players[socket.id] = player;
        socket.emit("master");

        io.emit("updatePlayers", players);
        return;
    }

    if (gameState !== "lobby") {

        waitingPlayers[socket.id] = player;
        socket.emit("waitingNextRace");
        return;
    }

    players[socket.id] = player;

    io.emit("updatePlayers", players);
    socket.emit("updatePlayers", players);

});

   socket.on("setText", (text) => {

    if (!players[socket.id]) return;
    if (!players[socket.id].isMaster) return;

    currentText = text;
    raceText = text;
});

socket.on("startGame", () => {

    if (!players[socket.id]) return;
    if (!players[socket.id].isMaster) return;

    if (!currentText.trim()) return;

    Object.assign(players, waitingPlayers);
    for (let id in waitingPlayers) delete waitingPlayers[id];

    resetPlayers();

    gameState = "countdown"; 

    startRace();
});
    
socket.on("typing", (data) => {

    if (gameState !== "racing") return;
    if (!players[socket.id]) return;
    if (players[socket.id].isMaster) return;
    if (winner) return;

    const player = players[socket.id];

    player.progress = Number(data.progress || 0);
    player.wpm = Number(data.wpm || 0);
    player.errors = Number(data.errors || 0);

    io.emit("updatePlayers", players);

    if (data.finished) {

        winner = player.name;
        player.stars += 1;

        gameState = "results";

        const ranking = Object.entries(players)
            .filter(([id, p]) => !p.isMaster)
            .map(([id, p]) => {

                const minutes = Math.max(
                    (Date.now() - raceStartTime) / 1000 / 60,
                    0.01
                );

                const estimatedChars =
                    (p.progress / 100) * (raceText?.length || 1);

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
   socket.on("nextRound", () => {

    if (!players[socket.id]?.isMaster) return;

    gameState = "lobby";
    winner = null;

    for (let id in players) {
        if (!players[id].isMaster) {
            players[id].progress = 0;
            players[id].wpm = 0;
            players[id].errors = 0;
        }
    }
    io.emit("text", "");
    io.emit("gameState", "lobby");   
    io.emit("resetRace");
    io.emit("updatePlayers", players);
    
});
     socket.on("disconnect", () => {

        const wasMaster = players[socket.id]?.isMaster;
    
        delete players[socket.id];
        delete waitingPlayers[socket.id];
    
        if (wasMaster) {
    
            io.emit("masterDisconnected");
    
            for (const id in players) {
                delete players[id];
            }
    
            for (const id in waitingPlayers) {
                delete waitingPlayers[id];
            }
    
            winner = null;
            gameState = "lobby";
    
            return;
        }
    
        io.emit("updatePlayers", players);
    });

    socket.on("masterDisconnected", () => {

    alert("Se acabó, por favor cierra esta ventana.");

    window.location.reload();
});

});

function broadcastState() {
    io.emit("gameState", gameState);
}


server.listen(3000, () => {

    console.log("Servidor corriendo en http://localhost:3000");
});
