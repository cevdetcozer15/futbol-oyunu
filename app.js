const socket = io();

// DOM Elementleri
const screens = { lobby: document.getElementById('lobby'), waiting: document.getElementById('waiting'), game: document.getElementById('game') };
const statusMsg = document.getElementById('status-message');
const teamABox = document.getElementById('teamA-box');
const teamBBox = document.getElementById('teamB-box');
const actionArea = document.getElementById('action-area');
const answerInput = document.getElementById('answer-input');
const passButton = document.getElementById('passButton');
const timerDisplay = document.getElementById('timer-display');

let myRoomCode = "";
let isRoundActive = false;
let countdownInterval;

// --- 1. LOBİ İŞLEMLERİ ---
document.getElementById('createRoomBtn').addEventListener('click', () => {
    const name = document.getElementById('playerName').value || "Oyuncu 1";
    socket.emit('createRoom', name);
});

document.getElementById('joinRoomBtn').addEventListener('click', () => {
    const name = document.getElementById('playerName').value || "Oyuncu 2";
    const code = document.getElementById('roomCodeInput').value;
    if(code.trim().length > 0) {
        myRoomCode = code;
        socket.emit('joinRoom', { roomCode: code, playerName: name });
    }
});

socket.on('roomCreated', (code) => {
    myRoomCode = code;
    document.getElementById('displayRoomCode').innerText = code;
    screens.lobby.classList.remove('active');
    screens.waiting.classList.add('active');
});

socket.on('errorMsg', (msg) => {
    document.getElementById('lobby-message').innerText = msg;
});

// --- 2. OYUN İŞLEMLERİ ---
socket.on('gameReady', (players) => {
    document.getElementById('p1-name').innerText = players.p1;
    document.getElementById('p2-name').innerText = players.p2;
    screens.lobby.classList.remove('active');
    screens.waiting.classList.remove('active');
    screens.game.classList.add('active');
});

socket.on('newRound', (teams) => {
    actionArea.style.display = 'none';
    timerDisplay.style.display = 'none'; // Hazırlık aşamasında sayacı gizle
    timerDisplay.classList.remove('timer-warning');
    clearInterval(countdownInterval);
    
    teamABox.innerText = "?";
    teamBBox.innerText = "?";
    isRoundActive = false;
    
    passButton.disabled = false;
    passButton.innerText = 'Pas Geç ⏭️';
    
    let count = 3;
    statusMsg.innerText = count;
    statusMsg.style.color = "#fff";
    
    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            statusMsg.innerText = count;
        } else {
            clearInterval(interval);
            statusMsg.innerText = "YAZ!";
            statusMsg.style.color = "#f1c40f";
            teamABox.innerText = teams.teamA.toUpperCase();
            teamBBox.innerText = teams.teamB.toUpperCase();
            actionArea.style.display = 'flex';
            answerInput.value = "";
            answerInput.focus();
            isRoundActive = true;

            // 30 SANİYELİK SAYACI BAŞLAT
            timerDisplay.style.display = 'flex';
            let timeLeft = 30;
            timerDisplay.innerText = timeLeft;

            countdownInterval = setInterval(() => {
                timeLeft--;
                timerDisplay.innerText = timeLeft;
                
                if(timeLeft <= 10) {
                    timerDisplay.classList.add('timer-warning');
                }

                if(timeLeft <= 0) {
                    clearInterval(countdownInterval);
                }
            }, 1000);
        }
    }, 1000);
});

function sendAnswer() {
    if (!isRoundActive) return;
    const answer = answerInput.value;
    if (answer.trim() !== "") {
        socket.emit('submitAnswer', { roomCode: myRoomCode, answer: answer });
        answerInput.value = ""; 
    }
}

document.getElementById('submit-answer-btn').addEventListener('click', sendAnswer);
answerInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendAnswer(); });

passButton.addEventListener('click', () => {
    if (!isRoundActive) return; 
    socket.emit('passVote', myRoomCode); 
    passButton.disabled = true;
    passButton.innerText = 'Rakip Bekleniyor... ⏳';
});

socket.on('wrongAnswer', () => {
    answerInput.style.backgroundColor = "#e74c3c"; 
    setTimeout(() => { answerInput.style.backgroundColor = "#fff"; }, 400);
});

// SÜRE BİTTİĞİNDE
socket.on('timeUp', (data) => {
    isRoundActive = false;
    clearInterval(countdownInterval);
    actionArea.style.display = 'none';
    timerDisplay.style.display = 'none';
    
    statusMsg.innerText = `SÜRE BİTTİ! ⏰\n(Cevap: ${data.correctPlayer})`;
    statusMsg.style.color = "#e74c3c";
});

socket.on('roundWon', (data) => {
    isRoundActive = false;
    clearInterval(countdownInterval);
    actionArea.style.display = 'none';
    timerDisplay.style.display = 'none';
    
    document.getElementById('p1-score').innerText = data.scores[0];
    document.getElementById('p2-score').innerText = data.scores[1];
    
    statusMsg.innerText = `${data.winnerName} BİLDİ!\nCevap: ${data.correctPlayer}`;
    statusMsg.style.color = "#2ecc71";
});

socket.on('gameOver', (data) => {
    isRoundActive = false;
    clearInterval(countdownInterval);
    actionArea.style.display = 'none';
    timerDisplay.style.display = 'none';
    
    document.getElementById('p1-score').innerText = data.scores[0];
    document.getElementById('p2-score').innerText = data.scores[1];
    
    statusMsg.innerText = `🏆 KAZANAN: ${data.winnerName.toUpperCase()} 🏆\n(Son Cevap: ${data.correctPlayer})`;
    statusMsg.style.color = "#3498db";

    var duration = 3 * 1000;
    var end = Date.now() + duration;

    (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#FFD700', '#FFFFFF', '#1E90FF'] });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#FFD700', '#FFFFFF', '#1E90FF'] });
        if (Date.now() < end) requestAnimationFrame(frame);
    }());
});

// --- YENİ OYUN VE ÇIKIŞ BUTONLARI ---
const newGameBtn = document.getElementById('new-game-btn');
const exitBtn = document.getElementById('exit-btn');

exitBtn.addEventListener('click', () => { window.location.reload(); });

newGameBtn.addEventListener('click', () => {
    socket.emit('playAgain', myRoomCode);
    statusMsg.innerText = "Yeniden başlatılıyor...";
    statusMsg.style.color = "#fff";
});
