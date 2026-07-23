const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Klasördeki HTML, CSS ve JS dosyalarını dışarıya (tarayıcılara) açıyoruz
app.use(express.static(__dirname));

// --- HAKEMİN BİLGİSİ (VERİTABANI VE KURALLAR) ---
const db = require('./futbolcular.json');

function cleanText(text) {
    return text.toLowerCase()
        // Türkçe harfler
        .replace(/ğ/g, 'g').replace(/ü/g, 'u')
        .replace(/ş/g, 's').replace(/ı/g, 'i')
        .replace(/ö/g, 'o').replace(/ç/g, 'c')
        // Balkan, İspanyol, İskandinav ve diğer özel harfler (Pjanić, Džeko, Kjær vb. için)
        .replace(/ć/g, 'c').replace(/č/g, 'c')
        .replace(/š/g, 's').replace(/ž/g, 'z')
        .replace(/đ/g, 'd').replace(/ñ/g, 'n')
        .replace(/ø/g, 'o').replace(/æ/g, 'ae')
        .replace(/ß/g, 'ss')
        // Geri kalan tüm aksanlı, şapkalı, noktalı harfleri (á, é, í vb.) kökten temizle
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const WIN_SCORE = 3;
const rooms = {}; // Tüm oyun odalarının verisini burada tutacağız

// Rastgele 4 haneli oda kodu üretici
function generateRoomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// --- OYUNCU BAĞLANTILARI ---
io.on('connection', (socket) => {
    console.log('Yeni bir cihaz bağlandı:', socket.id);

    // 1. Oda Kurma
    socket.on('createRoom', (playerName) => {
        const roomCode = generateRoomCode();
        rooms[roomCode] = {
            players: [{ id: socket.id, name: playerName, score: 0 }],
            roundActive: false,
            currentTeamA: "",
            currentTeamB: "",
            passVotes: 0 // O anki raunttaki pas sayısını tutmak için
        };
        socket.join(roomCode);
        socket.emit('roomCreated', roomCode); // Kodu kurucuya gönder
    });

    // 2. Odaya Katılma
    socket.on('joinRoom', ({ roomCode, playerName }) => {
        const room = rooms[roomCode];
        if (room && room.players.length === 1) {
            room.players.push({ id: socket.id, name: playerName, score: 0 });
            socket.join(roomCode);
            
            // İki oyuncu da hazır, oyunu başlat
            io.to(roomCode).emit('gameReady', { 
                p1: room.players[0].name, 
                p2: room.players[1].name 
            });
            startRound(roomCode);
        } else {
            socket.emit('errorMsg', "Oda bulunamadı veya dolu.");
        }
    });

    // 3. Hakemin Turu Başlatması
    function startRound(roomCode) {
        const room = rooms[roomCode];
        if (!room) return;

        room.passVotes = 0; // Yeni tur başlıyor, pas sayacını sıfırla!

        // Rastgele futbolcu ve 2 takım seç
        const randomPlayer = db[Math.floor(Math.random() * db.length)];
        const shuffledTeams = [...randomPlayer.teams].sort(() => 0.5 - Math.random());
        room.currentTeamA = shuffledTeams[0];
        room.currentTeamB = shuffledTeams[1];
        room.roundActive = true;

        // Odadaki herkese takımları gönder
        io.to(roomCode).emit('newRound', { 
            teamA: room.currentTeamA, 
            teamB: room.currentTeamB 
        });
    }

    // 4. Oyuncudan Gelen Cevabı Kontrol Etme
    socket.on('submitAnswer', (data) => {
        const { roomCode, answer } = data;
        const room = rooms[roomCode];

        // Eğer tur zaten bitmişse (diğer oyuncu az önce bilmişse) bu cevabı yoksay
        if (!room || !room.roundActive) return;

        const cleanedAnswer = cleanText(answer.trim());
        const matchedPlayer = db.find(p => {
            const cleanPlayerName = cleanText(p.name);
            return cleanPlayerName.includes(cleanedAnswer) && 
                   p.teams.includes(room.currentTeamA) && 
                   p.teams.includes(room.currentTeamB);
        });

        // DOĞRU CEVAP!
        if (matchedPlayer && cleanedAnswer.length > 2) {
            room.roundActive = false; // Diğer oyuncunun sonradan gelen cevabını engelle

            // Kimin bildiğini bul ve puanını artır
            const winnerIndex = room.players.findIndex(p => p.id === socket.id);
            room.players[winnerIndex].score++;

            // Oyun bitti mi kontrolü
            if (room.players[winnerIndex].score >= WIN_SCORE) {
                io.to(roomCode).emit('gameOver', {
                    winnerName: room.players[winnerIndex].name,
                    correctPlayer: matchedPlayer.name.toUpperCase(),
                    scores: [room.players[0].score, room.players[1].score]
                });
            } else {
                // Tur bitti, puanları güncelle ve 4 saniye sonra yeni tur başlat
                io.to(roomCode).emit('roundWon', {
                    winnerName: room.players[winnerIndex].name,
                    correctPlayer: matchedPlayer.name.toUpperCase(),
                    scores: [room.players[0].score, room.players[1].score]
                });
                
                setTimeout(() => {
                    startRound(roomCode);
                }, 4000);
            }
        } else {
            // Sadece yanlış bilen kişiye uyarı gönder
            socket.emit('wrongAnswer');
        }
    });

    // 5. Pas Geçme İsteği
    socket.on('passVote', (roomCode) => {
        const room = rooms[roomCode];
        if (!room || !room.roundActive) return;

        room.passVotes++; // Odadaki pas sayısını 1 artır

        // Eğer 2 kişi de pasa bastıysa (oy 2 olduysa)
        if (room.passVotes >= 2) {
            room.roundActive = false; // Mevcut turu durdur
            
            // Hemen yeni turu başlat!
            startRound(roomCode);
        }
    });

    socket.on('disconnect', () => {
        console.log('Cihaz ayrıldı:', socket.id);
        // İstersen burada biri çıkarsa odayı kapatma mantığı eklenebilir
    });
});

// Sunucuyu başlat
const port = process.env.PORT || 3000;
server.listen(port, () => {
    console.log('Hakem (Sunucu) sahaya çıktı!');
});
