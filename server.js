const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

// YENİ: Akıllı Veritabanı Birleştirici ve Filtreleyici
function getDB(mode) {
    try {
        const classic = JSON.parse(fs.readFileSync('./futbolcular.json', 'utf8'));
        
        if (mode === 'superlig') {
            return JSON.parse(fs.readFileSync('./superlig.json', 'utf8'));
        }
        
        if (mode === 'country') {
            // Takım-Ülke modunda hem klasikleri hem de tek takımlı milli oyuncuları getirir
            const milli = JSON.parse(fs.readFileSync('./millitakim.json', 'utf8'));
            return [...classic, ...milli];
        }

        if (mode === 'custom') {
            // "Kendi Arenanı Yarat" modunda veritabanında ne var ne yok her şeyi tarar
            const superlig = JSON.parse(fs.readFileSync('./superlig.json', 'utf8'));
            const milli = JSON.parse(fs.readFileSync('./millitakim.json', 'utf8'));
            return [...classic, ...superlig, ...milli];
        }

        // Klasik (Takım - Takım) Mod: Oyunun çökmemesi için SADECE en az 2 takımı olanları getirir!
        return classic.filter(p => p.teams.length >= 2);

    } catch (err) { 
        console.log("Veritabanı okuma hatası:", err);
        return []; 
    }
}

let topScores = [];
const LEADERBOARD_FILE = './leaderboard.json';
try { if (fs.existsSync(LEADERBOARD_FILE)) topScores = JSON.parse(fs.readFileSync(LEADERBOARD_FILE)); } catch (error) {}

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

const WIN_SCORE = 5; const rooms = {}; 
function generateRoomCode() { return Math.floor(1000 + Math.random() * 9000).toString(); }

function triggerTeamSelection(roomCode) {
    const room = rooms[roomCode]; if(!room) return;
    room.customTeamA = ""; room.customTeamB = ""; room.teamAReady = false; room.teamBReady = false;
    room.players.forEach((p, index) => { 
        io.to(p.id).emit('requestTeamSelection', { 
            isSinglePlayer: room.isSinglePlayer, 
            playerIndex: index,
            gameMode: room.gameMode 
        }); 
    });
}

function nextTurn(roomCode) {
    const room = rooms[roomCode];
    if(!room) return;
    if(room.playStyle === 'custom') triggerTeamSelection(roomCode);
    else startRound(roomCode);
}

function startRound(roomCode) {
    const room = rooms[roomCode]; if (!room) return;
    room.passVotes = 0; clearTimeout(room.roundTimer); 

    const activeDB = getDB(room.gameMode);
    
    // Eğer filtreleme sonucu liste boşaldıysa güvenli çıkış yap
    if (activeDB.length === 0) return; 

    let randomPlayer = activeDB[Math.floor(Math.random() * activeDB.length)];

    if (room.gameMode === 'country') {
        const randomTeam = randomPlayer.teams[Math.floor(Math.random() * randomPlayer.teams.length)];
        room.currentTeamA = randomTeam; room.currentTeamB = randomPlayer.country;
    } else {
        const shuffledTeams = [...randomPlayer.teams].sort(() => 0.5 - Math.random());
        room.currentTeamA = shuffledTeams[0]; room.currentTeamB = shuffledTeams[1];
    }

    room.correctAnswer = randomPlayer.name.toUpperCase();
    room.roundActive = true;
    io.to(roomCode).emit('newRound', { teamA: room.currentTeamA, teamB: room.currentTeamB, mode: room.gameMode });

    if (!room.isSinglePlayer) {
        room.roundTimer = setTimeout(() => {
            if(room.roundActive) {
                room.roundActive = false;
                io.to(roomCode).emit('timeUp', { correctPlayer: room.correctAnswer });
                setTimeout(() => { nextTurn(roomCode); }, 4000);
            }
        }, 33000);
    }
}

io.on('connection', (socket) => {
    socket.emit('updateLeaderboard', topScores);

    socket.on('createSinglePlayer', ({ playerName, gameMode, playStyle }) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = { isSinglePlayer: true, playStyle: playStyle, gameMode: gameMode, players: [{ id: socket.id, name: playerName, score: 0 }], roundActive: false, currentTeamA: "", currentTeamB: "", correctAnswer: "", passVotes: 0 };
        socket.join(roomCode); socket.emit('gameReadySP', { p1: playerName, roomCode });
        nextTurn(roomCode);
    });

    socket.on('createRoom', ({ playerName, gameMode, playStyle }) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = { isSinglePlayer: false, playStyle: playStyle, gameMode: gameMode, players: [{ id: socket.id, name: playerName, score: 0 }], roundActive: false, currentTeamA: "", currentTeamB: "", correctAnswer: "", passVotes: 0, roundTimer: null };
        socket.join(roomCode); socket.emit('roomCreated', roomCode); 
    });

    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const room = rooms[roomCode];
        if (room && !room.isSinglePlayer && room.players.length === 1) {
            room.players.push({ id: socket.id, name: playerName, score: 0 });
            socket.join(roomCode);
            io.to(roomCode).emit('gameReady', { p1: room.players[0].name, p2: room.players[1].name });
            nextTurn(roomCode);
        } else socket.emit('errorMsg', "Oda bulunamadı veya dolu.");
    });

    socket.on('submitCustomTeam', ({ roomCode, teamA, teamB }) => {
        const room = rooms[roomCode]; if(!room) return;
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        
        if (room.isSinglePlayer) { room.customTeamA = teamA; room.customTeamB = teamB; room.teamAReady = true; room.teamBReady = true; } 
        else {
            if (playerIndex === 0) { room.customTeamA = teamA; room.teamAReady = true; } 
            else if (playerIndex === 1) { room.customTeamB = teamB; room.teamBReady = true; }
        }
        io.to(roomCode).emit('teamLockedMsg', playerIndex);
        if (room.isSinglePlayer || (room.teamAReady && room.teamBReady)) validateAndStart(roomCode);
    });

    function validateAndStart(roomCode) {
        const room = rooms[roomCode];
        let cleanA = cleanText(room.customTeamA.trim()); let cleanB = cleanText(room.customTeamB.trim());

        if (cleanA === "" && cleanB === "") { room.teamAReady = false; room.teamBReady = false; io.to(roomCode).emit('invalidCustomTeams', "Takım alanları boş olamaz!"); return; }
        if (!room.isSinglePlayer && (cleanA === "" || cleanB === "")) { room.teamAReady = false; room.teamBReady = false; io.to(roomCode).emit('invalidCustomTeams', "Her iki oyuncu da kendi alanını yazmak zorunda!"); return; }

        const activeDB = getDB(room.gameMode);

        if (cleanB === "" && room.isSinglePlayer) {
            const possiblePlayers = activeDB.filter(p => p.teams.some(t => cleanText(t).includes(cleanA)));
            if (possiblePlayers.length === 0) { room.teamAReady = false; room.teamBReady = false; io.to(roomCode).emit('invalidCustomTeams', "Veritabanında bu takımda oynamış kimse yok!"); return; }
            const randomPlayer = possiblePlayers[Math.floor(Math.random() * possiblePlayers.length)];
            
            if (room.gameMode === 'country') {
                cleanB = randomPlayer.country;
            } else {
                const otherTeams = randomPlayer.teams.filter(t => !cleanText(t).includes(cleanA));
                if (otherTeams.length === 0) { room.teamAReady = false; room.teamBReady = false; io.to(roomCode).emit('invalidCustomTeams', "Bu adamın başka takımı yok!"); return; }
                cleanB = otherTeams[Math.floor(Math.random() * otherTeams.length)];
            }
            
            room.currentTeamA = room.customTeamA; room.currentTeamB = cleanB; room.correctAnswer = randomPlayer.name.toUpperCase();
            startValidatedRound(roomCode); return;
        }

        const matchedPlayers = activeDB.filter(p => 
            p.teams.some(t => cleanText(t).includes(cleanA)) && 
            (room.gameMode === 'country' ? cleanText(p.country).includes(cleanB) : p.teams.some(t => cleanText(t).includes(cleanB)))
        );

        if (matchedPlayers.length > 0) {
            const randomPlayer = matchedPlayers[Math.floor(Math.random() * matchedPlayers.length)];
            room.currentTeamA = room.customTeamA; room.currentTeamB = room.customTeamB; room.correctAnswer = randomPlayer.name.toUpperCase();
            startValidatedRound(roomCode);
        } else {
            room.teamAReady = false; room.teamBReady = false; io.to(roomCode).emit('invalidCustomTeams', "Bu iki takımda/ülkede oynamış ortak biri yok! Başka deneyin.");
        }
    }

    function startValidatedRound(roomCode) {
        const room = rooms[roomCode]; room.passVotes = 0; clearTimeout(room.roundTimer); room.roundActive = true;
        io.to(roomCode).emit('newRound', { teamA: room.currentTeamA, teamB: room.currentTeamB, mode: room.gameMode });
        if (!room.isSinglePlayer) {
            room.roundTimer = setTimeout(() => {
                if(room.roundActive) {
                    room.roundActive = false;
                    io.to(roomCode).emit('timeUp', { correctPlayer: room.correctAnswer });
                    setTimeout(() => { nextTurn(roomCode); }, 4000);
                }
            }, 33000);
        }
    }

    socket.on('submitAnswer', (data) => {
        const { roomCode, answer } = data; const room = rooms[roomCode]; if (!room || !room.roundActive) return;
        const cleanedAnswer = cleanText(answer.trim()); const activeDB = getDB(room.gameMode);

        const matchedPlayer = activeDB.find(p => {
            const cleanPlayerName = cleanText(p.name);
            const isTeamAMatch = p.teams.some(t => cleanText(t).includes(cleanText(room.currentTeamA)));
            const isTeamBMatch = room.gameMode === 'country' ? cleanText(p.country).includes(cleanText(room.currentTeamB)) : p.teams.some(t => cleanText(t).includes(cleanText(room.currentTeamB)));
            return cleanPlayerName.includes(cleanedAnswer) && isTeamAMatch && isTeamBMatch;
        });

        if (matchedPlayer && cleanedAnswer.length > 2) {
            room.roundActive = false; clearTimeout(room.roundTimer); 
            const winnerIndex = room.players.findIndex(p => p.id === socket.id); room.players[winnerIndex].score++;

            if (room.isSinglePlayer) {
                io.to(roomCode).emit('roundWon', { winnerName: "DOĞRU!", correctPlayer: matchedPlayer.name.toUpperCase(), scores: [room.players[0].score, 0] });
                setTimeout(() => { nextTurn(roomCode); }, 1500);
            } else {
                if (room.players[winnerIndex].score >= WIN_SCORE) io.to(roomCode).emit('gameOver', { winnerName: room.players[winnerIndex].name, correctPlayer: matchedPlayer.name.toUpperCase(), scores: [room.players[0].score, room.players[1].score] });
                else {
                    io.to(roomCode).emit('roundWon', { winnerName: room.players[winnerIndex].name, correctPlayer: matchedPlayer.name.toUpperCase(), scores: [room.players[0].score, room.players[1].score] });
                    setTimeout(() => { nextTurn(roomCode); }, 4000);
                }
            }
        } else socket.emit('wrongAnswer');
    });

    socket.on('passVote', (roomCode) => {
        const room = rooms[roomCode]; if (!room || !room.roundActive) return;
        if (room.isSinglePlayer) {
            room.roundActive = false; io.to(roomCode).emit('roundPassed', { correctPlayer: room.correctAnswer }); setTimeout(() => { nextTurn(roomCode); }, 4000);
        } else {
            room.passVotes++; 
            if (room.passVotes >= 2) { room.roundActive = false; clearTimeout(room.roundTimer); io.to(roomCode).emit('roundPassed', { correctPlayer: room.correctAnswer }); setTimeout(() => { nextTurn(roomCode); }, 4000); }
        }
    });

    socket.on('spTimeUp', (roomCode) => {
        const room = rooms[roomCode];
        if (room && room.isSinglePlayer) { room.roundActive = false; updateLeaderboard(room.players[0].name, room.players[0].score); io.to(roomCode).emit('gameOver', { winnerName: "SÜRE BİTTİ!", correctPlayer: "Skorun: " + room.players[0].score, scores: [room.players[0].score, 0] }); }
    });

    socket.on('playAgain', (roomCode) => {
        const room = rooms[roomCode];
        if (room) {
            if (room.isSinglePlayer && room.players[0].score > 0) updateLeaderboard(room.players[0].name, room.players[0].score);
            room.players[0].score = 0; if(room.players[1]) room.players[1].score = 0; clearTimeout(room.roundTimer);
            io.to(roomCode).emit('playAgainReady'); nextTurn(roomCode); 
        }
    });

    socket.on('disconnect', () => { console.log('Cihaz ayrıldı:', socket.id); });
});

const port = process.env.PORT || 3000; server.listen(port, () => { console.log('Hakem (Sunucu) sahaya çıktı!'); });
const https = require('https'); setInterval(() => { https.get('https://futbol-oyunu.onrender.com', (res) => { console.log('Sunucu uyanık tutuldu (Auto-Ping)'); }).on('error', (err) => { console.log('Ping hatası:', err.message); }); }, 5 * 60 * 1000);
