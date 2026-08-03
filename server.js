const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const BIG_FOUR = ["galatasaray", "fenerbahçe", "beşiktaş", "trabzonspor"];

// --- ÜLKE/TAKIM SÖZLÜĞÜ (Aynı ülke eşleşmelerini engellemek için) ---
const teamCountries = {
    // TÜRKİYE
    "galatasaray": "türkiye", "fenerbahçe": "türkiye", "beşiktaş": "türkiye", "trabzonspor": "türkiye", "başakşehir": "türkiye", "kasımpaşa": "türkiye", "konyaspor": "türkiye", "antalyaspor": "türkiye", "göztepe": "türkiye", "rizespor": "türkiye", "kayserispor": "türkiye", "sivasspor": "türkiye", "adana demirspor": "türkiye", "karagümrük": "türkiye", "ankaragücü": "türkiye", "samsunspor": "türkiye", "alanyaspor": "türkiye", "bursaspor": "türkiye", "gençlerbirliği": "türkiye", "eskişehirspor": "türkiye", "gaziantepspor": "türkiye", "gaziantep fk": "türkiye", "eyüpspor": "türkiye", "akhisarspor": "türkiye", "denizlispor": "türkiye", "manisaspor": "türkiye", "kocaelispor": "türkiye", "istanbulspor": "türkiye", "pendikspor": "türkiye", "bodrum fk": "türkiye",
    // İNGİLTERE
    "arsenal": "ingiltere", "manchester city": "ingiltere", "manchester united": "ingiltere", "chelsea": "ingiltere", "liverpool": "ingiltere", "aston villa": "ingiltere", "tottenham": "ingiltere", "newcastle united": "ingiltere", "west ham": "ingiltere", "everton": "ingiltere", "brighton": "ingiltere", "crystal palace": "ingiltere", "fulham": "ingiltere", "leicester city": "ingiltere", "nottingham forest": "ingiltere", "wolves": "ingiltere", "leeds united": "ingiltere", "bournemouth": "ingiltere", "brentford": "ingiltere", "southampton": "ingiltere", "sheffield united": "ingiltere", "hull city": "ingiltere", "sunderland": "ingiltere", "blackburn": "ingiltere",
    // İSPANYA
    "real madrid": "ispanya", "barcelona": "ispanya", "atletico madrid": "ispanya", "sevilla": "ispanya", "villarreal": "ispanya", "valencia": "ispanya", "real betis": "ispanya", "athletic bilbao": "ispanya", "celta vigo": "ispanya", "getafe": "ispanya", "girona": "ispanya", "osasuna": "ispanya", "mallorca": "ispanya", "real sociedad": "ispanya", "malaga": "ispanya", "espanyol": "ispanya", "alaves": "ispanya", "deportivo la coruna": "ispanya", "granada": "ispanya", "levante": "ispanya", "cadiz": "ispanya",
    // İTALYA
    "inter": "italya", "ac milan": "italya", "juventus": "italya", "roma": "italya", "napoli": "italya", "lazio": "italya", "atalanta": "italya", "fiorentina": "italya", "torino": "italya", "bologna": "italya", "genoa": "italya", "parma": "italya", "sampdoria": "italya", "cagliari": "italya", "empoli": "italya", "udinese": "italya", "sassuolo": "italya", "venezia": "italya", "como": "italya", "hellas verona": "italya", "reggina": "italya",
    // ALMANYA
    "bayern münih": "almanya", "dortmund": "almanya", "bayer leverkusen": "almanya", "rb leipzig": "almanya", "stuttgart": "almanya", "eintracht frankfurt": "almanya", "wolfsburg": "almanya", "schalke": "almanya", "werder bremen": "almanya", "freiburg": "almanya", "union berlin": "almanya", "köln": "almanya", "hoffenheim": "almanya", "hamburg": "almanya", "mainz": "almanya", "hannover": "almanya", "augsburg": "almanya", "1860 munich": "almanya", "bochum": "almanya", "hertha berlin": "almanya",
    // FRANSA
    "psg": "fransa", "marseille": "fransa", "lyon": "fransa", "monaco": "fransa", "lille": "fransa", "rennes": "fransa", "nice": "fransa", "lens": "fransa", "bordeaux": "fransa", "toulouse": "fransa", "strasbourg": "fransa", "nantes": "fransa", "angers": "fransa", "clermont": "fransa", "metz": "fransa", "saint-etienne": "fransa", "amiens": "fransa", "bastia": "fransa", "le havre": "fransa", "troyes": "fransa", "guingamp": "fransa",
    // HOLLANDA
    "ajax": "hollanda", "psv": "hollanda", "feyenoord": "hollanda", "az alkmaar": "hollanda", "twente": "hollanda", "heerenveen": "hollanda", "nec nijmegen": "hollanda", "sparta rotterdam": "hollanda", "vitesse": "hollanda",
    // PORTEKİZ
    "porto": "portekiz", "benfica": "portekiz", "sporting": "portekiz", "braga": "portekiz", "vitoria guimaraes": "portekiz", "gil vicente": "portekiz", "famalicao": "portekiz", "rio ave": "portekiz", "boavista": "portekiz",
    // DİĞER COĞRAFYALAR
    "club brugge": "belçika", "anderlecht": "belçika", "genk": "belçika", "standard liege": "belçika", "union sg": "belçika", "antwerp": "belçika", "charleroi": "belçika",
    "celtic": "iskoçya", "rangers": "iskoçya", "dundee united": "iskoçya",
    "boca juniors": "arjantin", "river plate": "arjantin", "tigre": "arjantin", "belgrano": "arjantin", "san lorenzo": "arjantin",
    "flamengo": "brezilya", "palmeiras": "brezilya", "sao paulo": "brezilya", "santos": "brezilya", "corinthians": "brezilya", "atletico mineiro": "brezilya", "bahia": "brezilya", "cruzeiro": "brezilya", "gremio": "brezilya", "vasco da gama": "brezilya", "fluminense": "brezilya",
    "shakhtar donetsk": "ukrayna", "dynamo kyiv": "ukrayna", 
    "dinamo zagreb": "hırvatistan", "osijek": "hırvatistan",
    "olympiacos": "yunanistan", "panathinaikos": "yunanistan", "paok": "yunanistan", "aek": "yunanistan",
    "salzburg": "avusturya", "rapid wien": "avusturya", "austria wien": "avusturya",
    "zenit": "rusya", "cska moscow": "rusya", "spartak moscow": "rusya", "lokomotiv moscow": "rusya", "dynamo moscow": "rusya",
    "inter miami": "abd", "la galaxy": "abd",
    "basel": "isviçre",
    "partizan": "sırbistan"
};

// Hata toleranslı Veritabanı Okuyucu
function getDB(mode) {
    let classic = [], superlig = [], milli = [];
    
    try { classic = JSON.parse(fs.readFileSync('./futbolcular.json', 'utf8')); } 
    catch(e) { console.log("Futbolcular JSON Hatası:", e.message); }
    
    try { superlig = JSON.parse(fs.readFileSync('./superlig.json', 'utf8')); } 
    catch(e) { console.log("Süper Lig JSON Hatası:", e.message); }
    
    try { milli = JSON.parse(fs.readFileSync('./millitakim.json', 'utf8')); } 
    catch(e) { console.log("Milli Takım JSON Hatası:", e.message); }

    if (mode === 'superlig') return superlig;
    if (mode === 'country') return [...classic, ...milli];
    if (mode === 'custom') return [...classic, ...superlig, ...milli];

    return classic.filter(p => p.teams && p.teams.length >= 2);
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
    if(!room || room.isGameOver) return; 
    if(room.playStyle === 'custom') triggerTeamSelection(roomCode);
    else startRound(roomCode);
}

function startRound(roomCode) {
    const room = rooms[roomCode]; 
    if (!room || room.isGameOver) return; 

    room.passVotes = 0; clearTimeout(room.roundTimer); 

    const activeDB = getDB(room.gameMode);
    
    if (activeDB.length === 0) {
        room.correctAnswer = "JSON DOSYASI BOZUK!";
        io.to(roomCode).emit('timeUp', { correctPlayer: room.correctAnswer });
        setTimeout(() => { nextTurn(roomCode); }, 4000);
        return; 
    }

    let randomPlayer;

    if (room.gameMode === 'superlig') {
        const big4Players = activeDB.filter(p => 
            p.teams && p.teams.some(t => BIG_FOUR.includes(cleanText(t))) && p.teams.length >= 2
        );
        
        randomPlayer = big4Players.length > 0 
            ? big4Players[Math.floor(Math.random() * big4Players.length)]
            : activeDB[Math.floor(Math.random() * activeDB.length)];

        const playerBig4Teams = randomPlayer.teams.filter(t => BIG_FOUR.includes(cleanText(t)));
        const chosenBig4 = playerBig4Teams[Math.floor(Math.random() * playerBig4Teams.length)];
        
        const otherTeams = randomPlayer.teams.filter(t => cleanText(t) !== cleanText(chosenBig4));
        const chosenOther = otherTeams[Math.floor(Math.random() * otherTeams.length)];

        if (Math.random() > 0.5) {
            room.currentTeamA = chosenBig4;
            room.currentTeamB = chosenOther;
        } else {
            room.currentTeamA = chosenOther;
            room.currentTeamB = chosenBig4;
        }

    } else if (room.gameMode === 'country') {
        let attempts = 0;
        let validTeamFound = false;

        // Eşleşme Mantığı: Seçilen takımın ülkesi oyuncunun milli takımıyla aynıysa tekrar zarat!
        while (!validTeamFound && attempts < 50) {
            randomPlayer = activeDB[Math.floor(Math.random() * activeDB.length)];
            const randomTeam = randomPlayer.teams[Math.floor(Math.random() * randomPlayer.teams.length)];
            
            const teamCountry = teamCountries[cleanText(randomTeam)];
            const playerCountry = cleanText(randomPlayer.country);

            // Eğer takım ülkesi ve oyuncu ülkesi ÇAKIŞMIYORSA onay ver
            if (!teamCountry || teamCountry !== playerCountry) {
                room.currentTeamA = randomTeam; 
                room.currentTeamB = randomPlayer.country;
                validTeamFound = true;
            }
            attempts++;
        }

        // Ola ki 50 denemede bulamazsa (imkansıza yakın) fallback mekanizması
        if (!validTeamFound) {
            room.currentTeamA = randomPlayer.teams[0];
            room.currentTeamB = randomPlayer.country;
        }
        
    } else {
        randomPlayer = activeDB[Math.floor(Math.random() * activeDB.length)];
        const shuffledTeams = [...randomPlayer.teams].sort(() => 0.5 - Math.random());
        room.currentTeamA = shuffledTeams[0]; 
        room.currentTeamB = shuffledTeams[1];
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

    socket.on('rejoinRoom', (roomCode) => {
        if (rooms[roomCode]) socket.join(roomCode);
    });

    socket.on('createSinglePlayer', ({ playerName, gameMode, playStyle }) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = { isSinglePlayer: true, playStyle: playStyle, gameMode: gameMode, players: [{ id: socket.id, name: playerName, score: 0 }], roundActive: false, currentTeamA: "", currentTeamB: "", correctAnswer: "", passVotes: 0, isGameOver: false };
        socket.join(roomCode); socket.emit('gameReadySP', { p1: playerName, roomCode });
        nextTurn(roomCode);
    });

    socket.on('createRoom', ({ playerName, gameMode, playStyle }) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = { isSinglePlayer: false, playStyle: playStyle, gameMode: gameMode, players: [{ id: socket.id, name: playerName, score: 0 }], roundActive: false, currentTeamA: "", currentTeamB: "", correctAnswer: "", passVotes: 0, roundTimer: null, isGameOver: false };
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
        if (room.isGameOver) return;

        let cleanA = cleanText(room.customTeamA.trim()); let cleanB = cleanText(room.customTeamB.trim());

        if (cleanA === "" && cleanB === "") { room.teamAReady = false; room.teamBReady = false; io.to(roomCode).emit('invalidCustomTeams', "Takım alanları boş olamaz!"); return; }
        if (!room.isSinglePlayer && (cleanA === "" || cleanB === "")) { room.teamAReady = false; room.teamBReady = false; io.to(roomCode).emit('invalidCustomTeams', "Her iki oyuncu da kendi alanını yazmak zorunda!"); return; }

        const activeDB = getDB(room.gameMode);
        
        if(activeDB.length === 0) {
            io.to(roomCode).emit('invalidCustomTeams', "JSON Dosyası okunamadı! Virgül hatası olabilir."); return;
        }

        if (cleanB === "" && room.isSinglePlayer) {
            const possiblePlayers = activeDB.filter(p => p.teams && p.teams.some(t => cleanText(t).includes(cleanA)));
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
            p.teams && p.teams.some(t => cleanText(t).includes(cleanA)) && 
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
            if(!p.teams || !p.name) return false;
            const cleanPlayerName = cleanText(p.name);
            const isTeamAMatch = p.teams.some(t => cleanText(t).includes(cleanText(room.currentTeamA)));
            const isTeamBMatch = room.gameMode === 'country' ? cleanText(p.country).includes(cleanText(room.currentTeamB)) : p.teams.some(t => cleanText(t).includes(cleanText(room.currentTeamB)));
            return cleanPlayerName.includes(cleanedAnswer) && isTeamAMatch && isTeamBMatch;
        });

        if (matchedPlayer && cleanedAnswer.length > 2) {
            room.roundActive = false; clearTimeout(room.roundTimer); 
            const winnerIndex = room.players.findIndex(p => p.id === socket.id); 
            if(winnerIndex > -1) room.players[winnerIndex].score++;

            if (room.isSinglePlayer) {
                io.to(roomCode).emit('roundWon', { winnerName: "DOĞRU!", correctPlayer: matchedPlayer.name.toUpperCase(), scores: [room.players[0].score, 0] });
                setTimeout(() => { nextTurn(roomCode); }, 1500);
            } else {
                if (room.players[winnerIndex].score >= WIN_SCORE) {
                    room.isGameOver = true;
                    io.to(roomCode).emit('gameOver', { winnerName: room.players[winnerIndex].name, correctPlayer: matchedPlayer.name.toUpperCase(), scores: [room.players[0].score, room.players[1].score] });
                } else {
                    io.to(roomCode).emit('roundWon', { winnerName: room.players[winnerIndex].name, correctPlayer: matchedPlayer.name.toUpperCase(), scores: [room.players[0].score, room.players[1].score] });
                    setTimeout(() => { nextTurn(roomCode); }, 4000);
                }
            }
        } else socket.emit('wrongAnswer');
    });

    socket.on('passVote', (roomCode) => {
        const room = rooms[roomCode]; 
        if (!room || !room.roundActive) return;

        if (room.isSinglePlayer) {
            room.roundActive = false;
            io.to(roomCode).emit('roundPassed', { correctPlayer: room.correctAnswer });
            setTimeout(() => { nextTurn(roomCode); }, 4000);
        } else {
            room.passVotes++; 
            if (room.passVotes >= 2) { 
                room.roundActive = false; 
                clearTimeout(room.roundTimer); 
                io.to(roomCode).emit('roundPassed', { correctPlayer: room.correctAnswer }); 
                setTimeout(() => { nextTurn(roomCode); }, 4000); 
            }
        }
    });

    socket.on('spTimeUp', (roomCode) => {
        const room = rooms[roomCode];
        if (room && room.isSinglePlayer) { 
            room.roundActive = false; 
            room.isGameOver = true; 
            updateLeaderboard(room.players[0].name, room.players[0].score); 
            io.to(roomCode).emit('gameOver', { winnerName: "SÜRE BİTTİ!", correctPlayer: "Skorun: " + room.players[0].score, scores: [room.players[0].score, 0] }); 
        }
    });

    socket.on('playAgain', (roomCode) => {
        const room = rooms[roomCode];
        if (room) {
            room.isGameOver = false; 
            if (room.isSinglePlayer && room.players[0].score > 0) updateLeaderboard(room.players[0].name, room.players[0].score);
            room.players[0].score = 0; if(room.players[1]) room.players[1].score = 0; clearTimeout(room.roundTimer);
            io.to(roomCode).emit('playAgainReady'); nextTurn(roomCode); 
        }
    });

    socket.on('disconnect', () => { console.log('Cihaz ayrıldı:', socket.id); });
});

const port = process.env.PORT || 3000; server.listen(port, () => { console.log('Hakem (Sunucu) sahaya çıktı!'); });
const https = require('https'); setInterval(() => { https.get('https://futbol-oyunu.onrender.com', (res) => { console.log('Sunucu uyanık tutuldu (Auto-Ping)'); }).on('error', (err) => { console.log('Ping hatası:', err.message); }); }, 5 * 60 * 1000);
