const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const dbClassic = require('./futbolcular.json');
const dbSuperLig = require('./superlig.json'); 

let topScores = [];
const LEADERBOARD_FILE = './leaderboard.json';

try { if (fs.existsSync(LEADERBOARD_FILE)) topScores = JSON.parse(fs.readFileSync(LEADERBOARD_FILE)); } 
catch (error) { console.log("Skor tablosu dosyası okunamadı."); }

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
    return text.toLowerCase().replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c').normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const WIN_SCORE = 5;
const rooms = {}; 

function generateRoomCode() { return Math.floor(1000 + Math.random() * 9000).toString(); }

io.on('connection', (socket) => {
    socket.emit('updateLeaderboard', topScores);

    socket.on('createSinglePlayer', ({ playerName, gameMode }) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = { isSinglePlayer: true, gameMode: gameMode || 'teams', players: [{ id: socket.id, name: playerName, score: 0 }], roundActive: false, currentTeamA: "", currentTeamB: "", correctAnswer: "", passVotes: 0 };
        socket.join(roomCode);
        socket.emit('gameReadySP', { p1: playerName, roomCode });
        io.to(roomCode).emit('requestTeamSelection');
    });

    socket.on('createRoom', ({ playerName, gameMode }) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = { isSinglePlayer: false, gameMode: gameMode || 'teams', players: [{ id: socket.id, name: playerName, score: 0 }], roundActive: false, currentTeamA: "", currentTeamB: "", correctAnswer: "", passVotes: 0, roundTimer: null };
        socket.join(roomCode);
        socket.emit('roomCreated', roomCode); 
    });

    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const room = rooms[roomCode];
        if (room && !room.isSinglePlayer && room.players.length === 1) {
            room.players.push({ id: socket.id, name: playerName, score: 0 });
            socket.join(roomCode);
            io.to(roomCode).emit('gameReady', { p1: room.players[0].name, p2: room.players[1].name });
            io.to(roomCode).emit('requestTeamSelection');
        } else {
            socket.emit('errorMsg', "Oda bulunamadı veya dolu.");
        }
    });

    // YENİ: Oyuncuların mikrofonla/elle yazdığı takımları doğruluyoruz
    socket.on('validateCustomTeams', ({ roomCode, teamA, teamB }) => {
        const room = rooms[roomCode];
        if (!room) return;

        let cleanA = cleanText(teamA.trim());
        let cleanB = cleanText(teamB.trim());
        
        if (cleanA === "") { socket.emit('invalidCustomTeams', "En azından 1. Takımı yazmalısın!"); return; }

        const activeDB = room.gameMode === 'superlig' ? dbSuperLig : dbClassic;

        // Eğer tek oyunculu modda 2. takımı boş bıraktıysa, sistem kendi bulsun
        if (cleanB === "" && room.isSinglePlayer) {
            const possiblePlayers = activeDB.filter(p => p.teams.some(t => cleanText(t).includes(cleanA)));
            if (possiblePlayers.length === 0) {
                socket.emit('invalidCustomTeams', "Veritabanında bu takımda oynamış kimse yok!"); return;
            }
            const randomPlayer = possiblePlayers[Math.floor(Math.random() * possiblePlayers.length)];
            const otherTeams = randomPlayer.teams.filter(t => !cleanText(t).includes(cleanA));
            
            if (otherTeams.length === 0) {
                socket.emit('invalidCustomTeams', "Bu adamın başka takımı yok!"); return;
            }
            
            cleanB = otherTeams[Math.floor(Math.random() * otherTeams.length)];
            
            room.currentTeamA = teamA;
            room.currentTeamB = cleanB;
            room.correctAnswer = randomPlayer.name.toUpperCase();
            startValidatedRound(roomCode);
            return;
        }

        if (cleanA !== "" && cleanB !== "") {
            const matchedPlayers = activeDB.filter(p => 
                p.teams.some(t => cleanText(t).includes(cleanA)) && 
                (room.gameMode === 'country' ? cleanText(p.country).includes(cleanB) : p.teams.some(t => cleanText(t).includes(cleanB)))
            );

            if (matchedPlayers.length > 0) {
                const randomPlayer = matchedPlayers[Math.floor(Math.random() * matchedPlayers.length)];
                room.currentTeamA = teamA;
                room.currentTeamB = teamB;
                room.correctAnswer = randomPlayer.name.toUpperCase();
                startValidatedRound(roomCode);
            } else {
                socket.emit('invalidCustomTeams', "Bu iki takımda ortak oynamış bir efsane yok! Başka takım söyle.");
            }
        } else {
            socket.emit('invalidCustomTeams', "İki takımı da doldurmalısın!");
        }
    });

    function startValidatedRound(roomCode) {
        const room = rooms[roomCode];
        room.passVotes = 0; 
        clearTimeout(room.roundTimer); 
        room.roundActive = true;

        io.to(roomCode).emit('newRound', { teamA: room.currentTeamA, teamB: room.currentTeamB, mode: room.gameMode });

        if (!room.isSinglePlayer) {
            room.roundTimer = setTimeout(() => {
                if(room.roundActive) {
                    room.roundActive = false;
                    io.to(roomCode).emit('timeUp', { correctPlayer: room.correctAnswer });
                    setTimeout(() => { io.to(roomCode).emit('requestTeamSelection'); }, 4000);
                }
            }, 33000);
        }
    }

    socket.on('submitAnswer', (data) => {
        const { roomCode, answer } = data;
        const room = rooms[roomCode];
        if (!room || !room.roundActive) return;

        const cleanedAnswer = cleanText(answer.trim());
        const activeDB = room.gameMode === 'superlig' ? dbSuperLig : dbClassic;

        const matchedPlayer = activeDB.find(p => {
            const cleanPlayerName = cleanText(p.name);
            const isTeamAMatch = p.teams.some(t => cleanText(t).includes(cleanText(room.currentTeamA)));
            const isTeamBMatch = room.gameMode === 'country' ? cleanText(p.country).includes(cleanText(room.currentTeamB)) : p.teams.some(t => cleanText(t).includes(cleanText(room.currentTeamB)));
            
            return cleanPlayerName.includes(cleanedAnswer) && isTeamAMatch && isTeamBMatch;
        });

        if (matchedPlayer && cleanedAnswer.length > 2) {
            room.roundActive = false; 
            clearTimeout(room.roundTimer); 

            const winnerIndex = room.players.findIndex(p => p.id === socket.id);
            room.players[winnerIndex].score++;

            if (room.isSinglePlayer) {
                io.to(roomCode).emit('roundWon', { winnerName: "DOĞRU!", correctPlayer: matchedPlayer.name.toUpperCase(), scores: [room.players[0].score, 0] });
                setTimeout(() => { io.to(roomCode).emit('requestTeamSelection'); }, 1500);
            } else {
                if (room.players[winnerIndex].score >= WIN_SCORE) {
                    io.to(roomCode).emit('gameOver', { winnerName: room.players[winnerIndex].name, correctPlayer: matchedPlayer.name.toUpperCase(), scores: [room.players[0].score, room.players[1].score] });
                } else {
                    io.to(roomCode).emit('roundWon', { winnerName: room.players[winnerIndex].name, correctPlayer: matchedPlayer.name.toUpperCase(), scores: [room.players[0].score, room.players[1].score] });
                    setTimeout(() => { io.to(roomCode).emit('requestTeamSelection'); }, 4000);
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
            io.to(roomCode).emit('roundPassed', { correctPlayer: room.correctAnswer });
            setTimeout(() => { io.to(roomCode).emit('requestTeamSelection'); }, 4000);
        } else {
            room.passVotes++; 
            if (room.passVotes >= 2) {
                room.roundActive = false; 
                clearTimeout(room.roundTimer);
                io.to(roomCode).emit('roundPassed', { correctPlayer: room.correctAnswer });
                setTimeout(() => { io.to(roomCode).emit('requestTeamSelection'); }, 4000);
            }
        }
    });

    socket.on('spTimeUp', (roomCode) => {
        const room = rooms[roomCode];
        if (room && room.isSinglePlayer) {
            room.roundActive = false;
            updateLeaderboard(room.players[0].name, room.players[0].score);
            io.to(roomCode).emit('gameOver', { winnerName: "SÜRE BİTTİ!", correctPlayer: "Skorun: " + room.players[0].score, scores: [room.players[0].score, 0] });
        }
    });

    socket.on('playAgain', (roomCode) => {
        const room = rooms[roomCode];
        if (room) {
            if (room.isSinglePlayer && room.players[0].score > 0) updateLeaderboard(room.players[0].name, room.players[0].score);
            room.players[0].score = 0;
            if(room.players[1]) room.players[1].score = 0;
            clearTimeout(room.roundTimer);
            io.to(roomCode).emit('playAgainReady');
            io.to(roomCode).emit('requestTeamSelection'); 
        }
    });

    socket.on('disconnect', () => { console.log('Cihaz ayrıldı:', socket.id); });
});

const port = process.env.PORT || 3000;
server.listen(port, () => { console.log('Hakem (Sunucu) sahaya çıktı!'); });

const https = require('https');
setInterval(() => { https.get('https://futbol-oyunu.onrender.com', (res) => { console.log('Sunucu uyanık tutuldu (Auto-Ping)'); }).on('error', (err) => { console.log('Ping hatası:', err.message); }); }, 5 * 60 * 1000);
