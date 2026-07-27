// Ülke isimlerini bayrak kodlarına çeviren sözlük
const countryFlags = {
    "arjantin": "ar", "belçika": "be", "uruguay": "uy", "italya": "it",
    "bosna hersek": "ba", "sırbistan": "rs", "ingiltere": "gb-eng",
    "mısır": "eg", "norveç": "no", "brezilya": "br", "polonya": "pl",
    "fransa": "fr", "portekiz": "pt", "gürcistan": "ge", "isveç": "se",
    "şili": "cl", "türkiye": "tr", "ispanya": "es", "hollanda": "nl",
    "fildişi sahili": "ci", "kolombiya": "co", "almanya": "de",
    "çekya": "cz", "cezayir": "dz", "fas": "ma", "hırvatistan": "hr",
    "senegal": "sn", "galler": "gb-wls", "kamerun": "cm", "nijerya": "ng",
    "güney kore": "kr", "macaristan": "hu", "ekvador": "ec", "gabon": "ga",
    "isviçre": "ch", "danimarka": "dk", "abd": "us", "slovenya": "si",
    "slovakya": "sk", "iskoçya": "gb-sct", "surinam": "sr", "iran": "ir",
    "jamaika": "jm", "burkina faso": "bf", "japonya": "jp", "kosova": "xk",
    "togo": "tg", "yeşil burun adaları": "cv", "yunanistan": "gr",
    "arnavutluk": "al", "libya": "ly", "demokratik kongo cumhuriyeti": "cd",
    "karadağ": "me", "avusturya": "at", "ukrayna": "ua", "gine": "gn",
    "kanada": "ca", "kuzey makedonya": "mk", "romanya": "ro"
};
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

const lobbyActions = document.querySelector('.lobby-actions');
const modeSelection = document.getElementById('mode-selection');

let myRoomCode = "";
let isRoundActive = false;
let countdownInterval;

let isSinglePlayerMode = false;
let isFirstRoundSP = true;
let spTimerLeft = 120;
let spGlobalInterval;
let pendingTarget = ""; // "single" veya "multi"

// Mod Seçimi Menüsünü Aç/Kapat
function showModeSelection(target) {
    pendingTarget = target;
    lobbyActions.style.display = 'none';
    modeSelection.style.display = 'flex';
}

function hideModeSelection() {
    pendingTarget = "";
    modeSelection.style.display = 'none';
    lobbyActions.style.display = 'flex';
}

document.getElementById('singlePlayerBtn').addEventListener('click', () => showModeSelection("single"));
document.getElementById('createRoomBtn').addEventListener('click', () => showModeSelection("multi"));
document.getElementById('cancelModeBtn').addEventListener('click', hideModeSelection);

document.getElementById('modeTeamsBtn').addEventListener('click', () => startWithMode('teams'));
document.getElementById('modeCountryBtn').addEventListener('click', () => startWithMode('country'));

function startWithMode(selectedMode) {
    const nameInput = document.getElementById('playerName').value;
    
    if (pendingTarget === "single") {
        const name = nameInput || "Oyuncu";
        socket.emit('createSinglePlayer', { playerName: name, gameMode: selectedMode });
    } else if (pendingTarget === "multi") {
        const name = nameInput || "Oyuncu 1";
        socket.emit('createRoom', { playerName: name, gameMode: selectedMode });
    }
    hideModeSelection();
}

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
    leaderboardContainer.style.display = 'none';
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
    leaderboardContainer.style.display = 'block';
    screens.lobby.classList.remove('active');
    screens.waiting.classList.remove('active');
    screens.game.classList.add('active');
});

socket.on('updateLeaderboard', (topScores) => {
    leaderboardList.innerHTML = '';
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
            // YENİ: Takım - Ülke modundaysak bayrak ikonunu HTML olarak kutuya ekle
            teamABox.innerText = teams.teamA.toUpperCase();
            
            if (teams.mode === 'country') {
                let countryCode = countryFlags[teams.teamB.toLowerCase()];
                if (countryCode) {
                    teamBBox.innerHTML = `<img src="https://flagcdn.com/w40/${countryCode}.png" alt="${teams.teamB}" style="height: 30px; margin-right: 10px; vertical-align: middle; border-radius: 4px;"> ${teams.teamB.toUpperCase()}`;
                } else {
                    teamBBox.innerText = teams.teamB.toUpperCase();
                }
            } else {
                teamBBox.innerText = teams.teamB.toUpperCase();
            }
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
const waitingExitBtn = document.getElementById('waiting-exit-btn');

exitBtn.addEventListener('click', () => { window.location.reload(); });
waitingExitBtn.addEventListener('click', () => { window.location.reload(); });
newGameBtn.addEventListener('click', () => { socket.emit('playAgain', myRoomCode); });
