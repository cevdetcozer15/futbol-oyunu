const socket = io();

const screens = { lobby: document.getElementById('lobby'), waiting: document.getElementById('waiting'), game: document.getElementById('game') };
const statusMsg = document.getElementById('status-message');
const teamABox = document.getElementById('teamA-box');
const teamBBox = document.getElementById('teamB-box');
const actionArea = document.getElementById('action-area');
const answerInput = document.getElementById('answer-input');
const passButton = document.getElementById('passButton');
const timerDisplay = document.getElementById('timer-display');
const leaderboardContainer = document.getElementById('leaderboard-container');
const leaderboardList = document.getElementById('leaderboard-list');

let myRoomCode = "";
let isRoundActive = false;
let countdownInterval;

let isSinglePlayerMode = false;
let isFirstRoundSP = true;
let spTimerLeft = 120;
let spGlobalInterval;

document.getElementById('singlePlayerBtn').addEventListener('click', () => {
    const name = document.getElementById('playerName').value || "Oyuncu";
    socket.emit('createSinglePlayer', name);
});

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

socket.on('errorMsg', (msg) => { document.getElementById('lobby-message').innerText = msg; });

socket.on('gameReady', (players) => {
    isSinglePlayerMode = false;
    document.getElementById('p1-name').innerText = players.p1;
    document.getElementById('p2-name').innerText = players.p2;
    document.getElementById('p2-score-container').style.display = 'block';
    leaderboardContainer.style.display = 'none'; // Çoklu oyuncuda tabloyu gizle
    screens.lobby.classList.remove('active');
    screens.waiting.classList.remove('active');
    screens.game.classList.add('active');
});

socket.on('gameReadySP', (data) => {
    isSinglePlayerMode = true;
    isFirstRoundSP = true;
    myRoomCode = data.roomCode;
    document.getElementById('p1-name').innerText = data.p1;
    document.getElementById('p2-score-container').style.display = 'none'; 
    leaderboardContainer.style.display = 'block'; // Tek oyuncuda tabloyu göster
    screens.lobby.classList.remove('active');
    screens.waiting.classList.remove('active');
    screens.game.classList.add('active');
});

// YENİ: Skor Tablosunu Güncelleme
socket.on('updateLeaderboard', (topScores) => {
    leaderboardList.innerHTML = ''; // Listeyi temizle
    if (topScores.length === 0) {
        leaderboardList.innerHTML = '<li>Henüz skor yok</li>';
        return;
    }
    
    topScores.forEach((item, index) => {
        leaderboardList.innerHTML += `<li><span>${index + 1}. ${item.name}</span> <span>${item.score} P</span></li>`;
    });
});

socket.on('newRound', (teams) => {
    actionArea.style.display = 'none';
    
    if (!isSinglePlayerMode) {
        timerDisplay.style.display = 'none'; 
        clearInterval(countdownInterval);
    }
    timerDisplay.classList.remove('timer-warning');
    
    teamABox.innerText = "?";
    teamBBox.innerText = "?";
    isRoundActive = false;
    
    passButton.disabled = false;
    passButton.innerText = 'Pas Geç ⏭️';
    
    let count = (isSinglePlayerMode && !isFirstRoundSP) ? 1 : 3;
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

            timerDisplay.style.display = 'flex';

            if (isSinglePlayerMode) {
                if (isFirstRoundSP) {
                    isFirstRoundSP = false;
                    spTimerLeft = 120;
                    timerDisplay.innerText = spTimerLeft;
                    spGlobalInterval = setInterval(() => {
                        spTimerLeft--;
                        timerDisplay.innerText = spTimerLeft;
                        
                        if(spTimerLeft <= 10) timerDisplay.classList.add('timer-warning');
                        
                        if(spTimerLeft <= 0) {
                            clearInterval(spGlobalInterval);
                            socket.emit('spTimeUp', myRoomCode);
                        }
                    }, 1000);
                }
            } else {
                let timeLeft = 30;
                timerDisplay.innerText = timeLeft;
                countdownInterval = setInterval(() => {
                    timeLeft--;
                    timerDisplay.innerText = timeLeft;
                    if(timeLeft <= 10 && timeLeft > 0) timerDisplay.classList.add('timer-warning');
                    if(timeLeft <= 0) clearInterval(countdownInterval);
                }, 1000);
            }
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
    passButton.innerText = isSinglePlayerMode ? 'Geçiliyor...' : 'Rakip Bekleniyor... ⏳';
});

socket.on('wrongAnswer', () => {
    answerInput.style.backgroundColor = "#e74c3c"; 
    setTimeout(() => { answerInput.style.backgroundColor = "#fff"; }, 400);
});

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
    if (!isSinglePlayerMode) {
        clearInterval(countdownInterval);
        timerDisplay.style.display = 'none';
    }
    actionArea.style.display = 'none';
    
    document.getElementById('p1-score').innerText = data.scores[0];
    if (!isSinglePlayerMode) document.getElementById('p2-score').innerText = data.scores[1];
    
    statusMsg.innerText = `${data.winnerName}\nCevap: ${data.correctPlayer}`;
    statusMsg.style.color = "#2ecc71";
});

socket.on('gameOver', (data) => {
    isRoundActive = false;
    clearInterval(countdownInterval);
    clearInterval(spGlobalInterval);
    actionArea.style.display = 'none';
    timerDisplay.style.display = 'none';
    
    document.getElementById('p1-score').innerText = data.scores[0];
    
    if (isSinglePlayerMode) {
        statusMsg.innerText = `SÜRE BİTTİ! ⏰\nToplam Skorun: ${data.scores[0]}`;
    } else {
        document.getElementById('p2-score').innerText = data.scores[1];
        statusMsg.innerText = `🏆 KAZANAN: ${data.winnerName.toUpperCase()} 🏆\n(Son Cevap: ${data.correctPlayer})`;
    }
    
    statusMsg.style.color = "#3498db";

    var duration = 3 * 1000;
    var end = Date.now() + duration;
    (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#FFD700', '#FFFFFF', '#1E90FF'] });
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#FFD700', '#FFFFFF', '#1E90FF'] });
        if (Date.now() < end) requestAnimationFrame(frame);
    }());
});

socket.on('playAgainReady', () => {
    isFirstRoundSP = true;
    if (isSinglePlayerMode) {
        clearInterval(spGlobalInterval);
        spTimerLeft = 120;
    } else {
        clearInterval(countdownInterval);
    }
    document.getElementById('p1-score').innerText = "0";
    document.getElementById('p2-score').innerText = "0";
    statusMsg.innerText = "Yeniden başlatılıyor...";
    statusMsg.style.color = "#fff";
});

const newGameBtn = document.getElementById('new-game-btn');
const exitBtn = document.getElementById('exit-btn');
exitBtn.addEventListener('click', () => { window.location.reload(); });
newGameBtn.addEventListener('click', () => { socket.emit('playAgain', myRoomCode); });

// Bekleme ekranındaki çıkış butonu
const waitingExitBtn = document.getElementById('waiting-exit-btn');
waitingExitBtn.addEventListener('click', () => { window.location.reload(); });
