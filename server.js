const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const db = require('./futbolcular.json');

// --- LİDERLİK TABLOSU YÖNETİMİ (Yerel Dosya Sistemi) ---
let topScores = [];
const LEADERBOARD_FILE = './leaderboard.json';

try {
    if (fs.existsSync(LEADERBOARD_FILE)) {
        topScores = JSON.parse(fs.readFileSync(LEADERBOARD_FILE));
    }
} catch (error) {
    console.log("Skor tablosu dosyası okunamadı veya yok.");
}

function updateLeaderboard(playerName, score) {
    if (score <= 0) return;

    topScores.push({ name: playerName, score: score });
    topScores.sort((a, b) => b.score - a.score);
    topScores = topScores.slice(0, 5);
    
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(topScores));
    io.emit('updateLeaderboard', topScores);
}

function cleanText(text) {
    if(!text) return "";
    return text.toLowerCase()
        .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i')
        .replace(/ö/g, 'o').replace(/ç/g, 'c')
        .replace(/ć/g, 'c').replace(/č/g, 'c').replace(/š/g, 's').replace(/ž/g, 'z')
        .replace(/đ/g, 'd').replace(/ñ/g, 'n').replace(/ø/g, 'o').replace(/æ/g, 'ae')
        .replace(/ß/g, 'ss')
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const WIN_SCORE = 5;
const rooms = {}; 

function generateRoomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

io.on('connection', (socket) => {
    console.log('Yeni bir cihaz bağlandı:', socket.id);

    socket.emit('updateLeaderboard', topScores);

    socket.on('createSinglePlayer', ({ playerName, gameMode }) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            isSinglePlayer: true,
            gameMode: gameMode || 'teams',
            players: [{ id: socket.id, name: playerName, score: 0 }],
            roundActive: false,
            currentTeamA: "",
            currentTeamB: "",
            passVotes: 0
        };
        socket.join(roomCode);
        socket.emit('gameReadySP', { p1: playerName, roomCode });
        startRound(roomCode);
    });

    socket.on('createRoom', ({ playerName, gameMode }) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            isSinglePlayer: false,
            gameMode: gameMode || 'teams',
            players: [{ id: socket.id, name: playerName, score: 0 }],
            roundActive: false,
            currentTeamA: "",
            currentTeamB: "",
            passVotes: 0,
            roundTimer: null
        };
        socket.join(roomCode);
        socket.emit('roomCreated', roomCode); 
    });

    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const room = rooms[roomCode];
        if (room && !room.isSinglePlayer && room.players.length === 1) {
            room.players.push({ id: socket.id, name: playerName, score: 0 });
            socket.join(roomCode);
            
            io.to(roomCode).emit('gameReady', { 
                p1: room.players[0].name, 
                p2: room.players[1].name 
            });
            startRound(roomCode);
        } else {
            socket.emit('errorMsg', "Oda bulunamadı veya dolu.");
        }
    });

    function startRound(roomCode) {
        const room = rooms[roomCode];
        if (!room) return;

        room.passVotes = 0; 
        clearTimeout(room.roundTimer); 

        let randomPlayer;

        if (room.gameMode === 'superlig') {
            const superLigTakimlari = [
                "galatasaray", "fenerbahçe", "beşiktaş", "trabzonspor", "başakşehir", 
                "kasımpaşa", "antalyaspor", "adana demirspor", "sivasspor", "ankaragücü", 
                "konyaspor", "kayserispor", "rizespor", "göztepe", "karagümrük", 
                "bursaspor", "manisaspor", "gençlerbirliği", "gaziantepspor", 
                "kayseri erciyesspor", "yeni malatyaspor", "istanbulspor", "alanyaspor", "sakaryaspor"
            ];

            const slPlayers = db.filter(p => p.teams.some(t => superLigTakimlari.includes(t)) && p.teams.length > 1);
            randomPlayer = slPlayers[Math.floor(Math.random() * slPlayers.length)];
            
            const playerSLTeams = randomPlayer.teams.filter(t => superLigTakimlari.includes(t));
            const selectedSLTeam = playerSLTeams[Math.floor(Math.random() * playerSLTeams.length)];
            
            const otherTeams = randomPlayer.teams.filter(t => t !== selectedSLTeam);
            const selectedOtherTeam = otherTeams[Math.floor(Math.random() * otherTeams.length)];

            if (Math.random() > 0.5) {
                room.currentTeamA = selectedSLTeam;
                room.currentTeamB = selectedOtherTeam;
            } else {
                room.currentTeamA = selectedOtherTeam;
                room.currentTeamB = selectedSLTeam;
            }
        } else {
            randomPlayer = db[Math.floor(Math.random() * db.length)];
            
            if (room.gameMode === 'country') {
                const randomTeam = randomPlayer.teams[Math.floor(Math.random() * randomPlayer.teams.length)];
                room.currentTeamA = randomTeam;
                room.currentTeamB = randomPlayer.country;
            } else {
                const shuffledTeams = [...randomPlayer.teams].sort(() => 0.5 - Math.random());
                room.currentTeamA = shuffledTeams[0];
                room.currentTeamB = shuffledTeams[1];
            }
        }

        room.roundActive = true;

        io.to(roomCode).emit('newRound', { 
            teamA: room.currentTeamA, 
            teamB: room.currentTeamB,
            mode: room.gameMode 
        });

        if (!room.isSinglePlayer) {
            room.roundTimer = setTimeout(() => {
                if(room.roundActive) {
                    room.roundActive = false;
                    io.to(roomCode).emit('timeUp', { correctPlayer: randomPlayer.name.toUpperCase() });
                    setTimeout(() => { startRound(roomCode); }, 4000);
                }
            }, 33000);
        }
    }

    socket.on('submitAnswer', (data) => {
        const { roomCode, answer } = data;
        const room = rooms[roomCode];

        if (!room || !room.roundActive) return;

        const cleanedAnswer = cleanText(answer.trim());
        const matchedPlayer = db.find(p => {
            const cleanPlayerName = cleanText(p.name);

            if (room.gameMode === 'country') {
                return cleanPlayerName.includes(cleanedAnswer) && 
                       p.teams.includes(room.currentTeamA) && 
                       cleanText(p.country) === cleanText(room.currentTeamB);
            } else {
                return cleanPlayerName.includes(cleanedAnswer) && 
                       p.teams.includes(room.currentTeamA) && 
                       p.teams.includes(room.currentTeamB);
            }
        });

        if (matchedPlayer && cleanedAnswer.length > 2) {
            room.roundActive = false; 
            clearTimeout(room.roundTimer); 

            const winnerIndex = room.players.findIndex(p => p.id === socket.id);
            room.players[winnerIndex].score++;

            if (room.isSinglePlayer) {
                io.to(roomCode).emit('roundWon', {
                    winnerName: "DOĞRU!",
                    correctPlayer: matchedPlayer.name.toUpperCase(),
                    scores: [room.players[0].score, 0]
                });
                setTimeout(() => { startRound(roomCode); }, 1500);
            } else {
                if (room.players[winnerIndex].score >= WIN_SCORE) {
                    io.to(roomCode).emit('gameOver', {
                        winnerName: room.players[winnerIndex].name,
                        correctPlayer: matchedPlayer.name.toUpperCase(),
                        scores: [room.players[0].score, room.players[1].score]
                    });
                } else {
                    io.to(roomCode).emit('roundWon', {
                        winnerName: room.players[winnerIndex].name,
                        correctPlayer: matchedPlayer.name.toUpperCase(),
                        scores: [room.players[0].score, room.players[1].score]
                    });
                    setTimeout(() => { startRound(roomCode); }, 4000);
                }
            }
        } else {
            socket.emit('wrongAnswer');
        }
    });

    socket.on('passVote', (roomCode) => {
        const room = rooms[roomCode];
        if (!room || !room.roundActive) return;

        if (room.isSinglePlayer) {
            room.roundActive = false;
            startRound(roomCode);
        } else {
            room.passVotes++; 
            if (room.passVotes >= 2) {
                room.roundActive = false; 
                clearTimeout(room.roundTimer);
                startRound(roomCode);
            }
        }
    });

    socket.on('spTimeUp', (roomCode) => {
        const room = rooms[roomCode];
        if (room && room.isSinglePlayer) {
            room.roundActive = false;
            updateLeaderboard(room.players[0].name, room.players[0].score);

            io.to(roomCode).emit('gameOver', {
                winnerName: "SÜRE BİTTİ!",
                correctPlayer: "Skorun: " + room.players[0].score,
                scores: [room.players[0].score, 0]
            });
        }
    });

    socket.on('playAgain', (roomCode) => {
        const room = rooms[roomCode];
        if (room) {
            if (room.isSinglePlayer && room.players[0].score > 0) {
                updateLeaderboard(room.players[0].name, room.players[0].score);
            }

            room.players[0].score = 0;
            if(room.players[1]) room.players[1].score = 0;
            clearTimeout(room.roundTimer);
            
            io.to(roomCode).emit('playAgainReady');
            startRound(roomCode); 
        }
    });

    socket.on('disconnect', () => {
        console.log('Cihaz ayrıldı:', socket.id);
    });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log('Hakem (Sunucu) sahaya çıktı!');
});

// --- SUNUCUYU UYANIK TUTMA KODU (5 DAKİKA PING) ---
const https = require('https');

setInterval(() => {
    https.get('https://futbol-oyunu.onrender.com', (res) => {
        console.log('Sunucu uyanık tutuldu (Auto-Ping)');
    }).on('error', (err) => {
        console.log('Ping hatası:', err.message);
    });
}, 5 * 60 * 1000);
