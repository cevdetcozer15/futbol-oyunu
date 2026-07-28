const socket = io();

// YENİ: Anlık bağlantı kopmalarına karşı odaya geri dönme güvencesi
socket.on('connect', () => {
    if (myRoomCode) {
        socket.emit('rejoinRoom', myRoomCode);
    }
});

// --- SES TANIMA ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (recognition) {
    recognition.lang = 'tr-TR';
    recognition.continuous = false;
    recognition.interimResults = false;
}

function listenForTeam(inputId, micBtnId) {
    if (!recognition) { alert("Tarayıcın sesli komutu desteklemiyor."); return; }
    const inputField = document.getElementById(inputId);
    const micBtn = document.getElementById(micBtnId);

    if (micBtn.classList.contains("listening")) {
        recognition.stop();
        micBtn.classList.remove("listening");
        inputField.placeholder = "İptal edildi."; 
        return;
    }
    
    inputField.placeholder = "Dinleniyor...";
    micBtn.classList.add("listening");
    recognition.start();
    
    recognition.onresult = (event) => {
        inputField.value = event.results[0][0].transcript.toLowerCase().replace('.', '');
        micBtn.classList.remove("listening");
    };
    recognition.onerror = () => { inputField.placeholder = "Anlaşılamadı."; micBtn.classList.remove("listening"); };
    recognition.onspeechend = () => { micBtn.classList.remove("listening"); }
}

document.getElementById('mic-a').addEventListener('click', () => listenForTeam('custom-team-a', 'mic-a'));
document.getElementById('mic-b').addEventListener('click', () => listenForTeam('custom-team-b', 'mic-b'));

const countryFlags = { "arjantin": "ar", "belçika": "be", "uruguay": "uy", "italya": "it", "bosna hersek": "ba", "sırbistan": "rs", "ingiltere": "gb-eng", "mısır": "eg", "norveç": "no", "brezilya": "br", "polonya": "pl", "fransa": "fr", "portekiz": "pt", "gürcistan": "ge", "isveç": "se", "şili": "cl", "türkiye": "tr", "ispanya": "es", "hollanda": "nl", "fildişi sahili": "ci", "kolombiya": "co", "almanya": "de", "çekya": "cz", "cezayir": "dz", "fas": "ma", "hırvatistan": "hr", "senegal": "sn", "galler": "gb-wls", "kamerun": "cm", "nijerya": "ng", "güney kore": "kr", "macaristan": "hu", "ekvador": "ec", "gabon": "ga", "isviçre": "ch", "danimarka": "dk", "abd": "us", "slovenya": "si", "slovakya": "sk", "iskoçya": "gb-sct", "surinam": "sr", "iran": "ir", "jamaika": "jm", "burkina faso": "bf", "japonya": "jp", "kosova": "xk", "togo": "tg", "yeşil burun adaları": "cv", "yunanistan": "gr", "arnavutluk": "al", "libya": "ly", "demokratik kongo cumhuriyeti": "cd", "karadağ": "me", "avusturya": "at", "ukrayna": "ua", "gine": "gn", "kanada": "ca", "kuzey makedonya": "mk", "romanya": "ro" };

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

const teamSelectionArea = document.getElementById('team-selection-area');
const matchTeamsContainer = document.getElementById('match-teams-container');
const customTeamError = document.getElementById('custom-team-error');
const playStyleSelection = document.getElementById('play-style-selection');
const modeSelection = document.getElementById('mode-selection');

let myRoomCode = ""; let isRoundActive = false; let countdownInterval;
let isSinglePlayerMode = false; let isFirstRoundSP = true; let spTimerLeft = 120; let spGlobalInterval;
let pendingTarget = ""; let myPlayerIndex = 0; 
let selectedPlayStyle = ""; 
let roundStartInterval; 

function showPlayStyleSelection(target) { 
    pendingTarget = target; 
    document.querySelector('.lobby-actions').style.display = 'none'; 
    modeSelection.style.display = 'none'; 
    playStyleSelection.style.display = 'flex'; 
}
function hidePlayStyleSelection() { 
    pendingTarget = ""; 
    playStyleSelection.style.display = 'none'; 
    modeSelection.style.display = 'none'; 
    document.querySelector('.lobby-actions').style.display = 'flex'; 
}
function showModeSelection() { 
    playStyleSelection.style.display = 'none'; 
    modeSelection.style.display = 'flex'; 
}
function goBackToPlayStyleSelection() { 
    modeSelection.style.display = 'none'; 
    playStyleSelection.style.display = 'flex'; 
}

document.getElementById('singlePlayerBtn').addEventListener('click', () => showPlayStyleSelection("single"));
document.getElementById('createRoomBtn').addEventListener('click', () => showPlayStyleSelection("multi"));
document.getElementById('cancelStyleBtn').addEventListener('click', hidePlayStyleSelection);
document.getElementById('backModeBtn').addEventListener('click', goBackToPlayStyleSelection);

document.getElementById('styleRandomBtn').addEventListener('click', () => { selectedPlayStyle = 'random'; showModeSelection(); });
document.getElementById('styleCustomBtn').addEventListener('click', () => { selectedPlayStyle = 'custom'; showModeSelection(); });

document.getElementById('modeTeamsBtn').addEventListener('click', () => startWithMode('teams'));
document.getElementById('modeSuperLigBtn').addEventListener('click', () => startWithMode('superlig'));
document.getElementById('modeCountryBtn').addEventListener('click', () => startWithMode('country'));

function startWithMode(selectedMode) {
    const nameInput = document.getElementById('playerName').value || (pendingTarget === "single" ? "Oyuncu" : "Oyuncu 1");
    if (pendingTarget === "single") socket.emit('createSinglePlayer', { playerName: nameInput, gameMode: selectedMode, playStyle: selectedPlayStyle });
    else socket.emit('createRoom', { playerName: nameInput, gameMode: selectedMode, playStyle: selectedPlayStyle });
    hidePlayStyleSelection();
}

document.getElementById('joinRoomBtn').addEventListener('click', () => {
    const name = document.getElementById('playerName').value || "Oyuncu 2";
    const code = document.getElementById('roomCodeInput').value;
    if(code.trim().length > 0) { myRoomCode = code; socket.emit('joinRoom', { roomCode: code, playerName: name }); }
});

socket.on('roomCreated', (code) => {
    myRoomCode = code; document.getElementById('displayRoomCode').innerText = code;
    screens.lobby.classList.remove('active'); screens.waiting.classList.add('active');
});

socket.on('errorMsg', (msg) => { document.getElementById('lobby-message').innerText = msg; });

socket.on('gameReady', (players) => {
    document.getElementById('p1-name').innerText = players.p1;
    document.getElementById('p2-name').innerText = players.p2;
    document.getElementById('p2-score-container').style.display = 'block';
    leaderboardContainer.style.display = 'none';
    screens.lobby.classList.remove('active'); screens.waiting.classList.remove('active'); screens.game.classList.add('active');
});

socket.on('gameReadySP', (data) => {
    isFirstRoundSP = true; 
    isSinglePlayerMode = true;
    myRoomCode = data.roomCode;
    document.getElementById('p1-name').innerText = data.p1;
    document.getElementById('p2-score-container').style.display = 'none'; 
    leaderboardContainer.style.display = 'block';
    screens.lobby.classList.remove('active'); screens.waiting.classList.remove('active'); screens.game.classList.add('active');
});

socket.on('updateLeaderboard', (topScores) => {
    leaderboardList.innerHTML = '';
    if (topScores.length === 0) { leaderboardList.innerHTML = '<li>Henüz skor yok</li>'; return; }
    topScores.forEach((item, index) => { leaderboardList.innerHTML += `<li><span>${index + 1}. ${item.name}</span> <span>${item.score} P</span></li>`; });
});

socket.on('requestTeamSelection', (data) => {
    myPlayerIndex = data.playerIndex; 
    isSinglePlayerMode = data.isSinglePlayer;

    statusMsg.innerText = ""; matchTeamsContainer.style.display = 'none'; actionArea.style.display = 'none'; timerDisplay.style.display = 'none'; teamSelectionArea.style.display = 'block'; customTeamError.innerText = "";
    
    const inputA = document.getElementById('custom-team-a'); 
    const inputB = document.getElementById('custom-team-b');
    const micA = document.getElementById('mic-a'); 
    const micB = document.getElementById('mic-b');
    const groupA = document.getElementById('team-a-group') || inputA.parentElement;
    const groupB = document.getElementById('team-b-group') || inputB.parentElement;
    const btn = document.getElementById('confirm-teams-btn');

    inputA.value = ""; inputB.value = ""; inputA.disabled = false; inputB.disabled = false;
    if (groupA) groupA.style.display = "flex";
    if (groupB) groupB.style.display = "flex";
    micA.style.display = "flex"; micB.style.display = "flex";
    
    if (recognition) { recognition.stop(); micA.classList.remove("listening"); micB.classList.remove("listening"); }
    btn.innerText = "Takımı Onayla & Hazır Ol"; btn.disabled = false;

    const isCountryMode = data.gameMode === 'country';
    const teamBName = isCountryMode ? "Ülke" : "Takım";

    if (isSinglePlayerMode) {
        inputA.placeholder = "Takımını Seç (Örn: Galatasaray)"; 
        if (groupB) groupB.style.display = "none"; 
    } else {
        if (myPlayerIndex === 0) { 
            inputA.placeholder = "1. Takım (Sen Seç)"; 
            inputB.placeholder = `2. ${teamBName} (Rakip Seçiyor 🔒)`; 
            inputB.disabled = true; micB.style.display = "none"; 
        } else { 
            inputA.placeholder = "1. Takım (Rakip Seçiyor 🔒)"; 
            inputB.placeholder = `2. ${teamBName} (Sen Seç)`; 
            inputA.disabled = true; micA.style.display = "none"; 
        }
    }
});

document.getElementById('confirm-teams-btn').addEventListener('click', () => {
    document.getElementById('confirm-teams-btn').innerText = "Bekleniyor ⏳"; document.getElementById('confirm-teams-btn').disabled = true;
    document.getElementById('custom-team-a').disabled = true; document.getElementById('custom-team-b').disabled = true;
    document.getElementById('mic-a').style.display = "none"; document.getElementById('mic-b').style.display = "none";
    if (recognition) recognition.stop();
    
    let teamA_val = document.getElementById('custom-team-a').value;
    let teamB_val = isSinglePlayerMode ? "" : document.getElementById('custom-team-b').value;

    socket.emit('submitCustomTeam', { roomCode: myRoomCode, teamA: teamA_val, teamB: teamB_val });
});

socket.on('teamLockedMsg', (lockedPlayerIndex) => {
    if (!isSinglePlayerMode && lockedPlayerIndex !== myPlayerIndex) {
        if (lockedPlayerIndex === 0) document.getElementById('custom-team-a').placeholder = "Rakip Seçti ✔️"; 
        else document.getElementById('custom-team-b').placeholder = "Rakip Seçti ✔️";
    }
});

socket.on('invalidCustomTeams', (msg) => {
    customTeamError.innerText = msg; document.getElementById('confirm-teams-btn').innerText = "Tekrar Dene"; document.getElementById('confirm-teams-btn').disabled = false;
    if (isSinglePlayerMode) { 
        document.getElementById('custom-team-a').disabled = false; document.getElementById('mic-a').style.display = "flex"; 
    } else { 
        if (myPlayerIndex === 0) { document.getElementById('custom-team-a').disabled = false; document.getElementById('mic-a').style.display = "flex"; } 
        else { document.getElementById('custom-team-b').disabled = false; document.getElementById('mic-b').style.display = "flex"; } 
    }
});

socket.on('newRound', (teams) => {
    teamSelectionArea.style.display = 'none'; matchTeamsContainer.style.display = 'flex'; actionArea.style.display = 'none';
    if (!isSinglePlayerMode) { timerDisplay.style.display = 'none'; clearInterval(countdownInterval); }
    
    clearInterval(roundStartInterval); 
    
    timerDisplay.classList.remove('timer-warning'); teamABox.innerText = "?"; teamBBox.innerText = "?"; isRoundActive = false;
    passButton.disabled = false; passButton.innerText = 'Pas Geç ⏭️';
    
    let count = (isSinglePlayerMode && !isFirstRoundSP) ? 1 : 3; statusMsg.innerText = count; statusMsg.style.color = "#fff";
    
    roundStartInterval = setInterval(() => {
        count--;
        if (count > 0) { statusMsg.innerText = count; } else {
            clearInterval(roundStartInterval); statusMsg.innerText = "YAZ!"; statusMsg.style.color = "#f1c40f";
            teamABox.innerText = teams.teamA.toUpperCase();
            if (teams.mode === 'country') {
                let countryKey = teams.teamB.toLowerCase().trim(); let countryCode = countryFlags[countryKey];
                if (countryCode) teamBBox.innerHTML = `<img src="https://flagcdn.com/w40/${countryCode}.png" style="height: 30px; margin-right: 10px; vertical-align: middle;"> ${teams.teamB.toUpperCase()}`; 
                else teamBBox.innerText = teams.teamB.toUpperCase();
            } else teamBBox.innerText = teams.teamB.toUpperCase();

            actionArea.style.display = 'flex'; answerInput.value = ""; answerInput.focus(); isRoundActive = true; timerDisplay.style.display = 'flex';
            
            if (isSinglePlayerMode) {
                if (isFirstRoundSP) {
                    isFirstRoundSP = false; spTimerLeft = 120; timerDisplay.innerText = spTimerLeft;
                    clearInterval(spGlobalInterval); 
                    spGlobalInterval = setInterval(() => {
                        spTimerLeft--; timerDisplay.innerText = spTimerLeft;
                        if(spTimerLeft <= 10) timerDisplay.classList.add('timer-warning');
                        if(spTimerLeft <= 0) { clearInterval(spGlobalInterval); socket.emit('spTimeUp', myRoomCode); }
                    }, 1000);
                }
            } else {
                let timeLeft = 30; timerDisplay.innerText = timeLeft;
                clearInterval(countdownInterval); 
                countdownInterval = setInterval(() => {
                    timeLeft--; timerDisplay.innerText = timeLeft;
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
    
    // YENİ: Kilitlenme Karşıtı Sigorta (Fail-Safe) - 3 Saniye sonra sunucu cevap vermezse butonu geri açar
    setTimeout(() => {
        if (passButton.disabled && isRoundActive) {
            passButton.disabled = false;
            passButton.innerText = 'Pas Geç ⏭️';
        }
    }, 3000);
});

socket.on('roundPassed', (data) => {
    isRoundActive = false; if (!isSinglePlayerMode) { clearInterval(countdownInterval); timerDisplay.style.display = 'none'; }
    actionArea.style.display = 'none'; statusMsg.innerText = `PAS GEÇİLDİ ⏭️\nCevap: ${data.correctPlayer}`; statusMsg.style.color = "#f39c12"; 
});

socket.on('wrongAnswer', () => { answerInput.style.backgroundColor = "#e74c3c"; setTimeout(() => { answerInput.style.backgroundColor = "#fff"; }, 400); });

socket.on('timeUp', (data) => {
    isRoundActive = false; clearInterval(countdownInterval); actionArea.style.display = 'none'; timerDisplay.style.display = 'none';
    statusMsg.innerText = `SÜRE BİTTİ! ⏰\n(Cevap: ${data.correctPlayer})`; statusMsg.style.color = "#e74c3c";
});

socket.on('roundWon', (data) => {
    isRoundActive = false; if (!isSinglePlayerMode) { clearInterval(countdownInterval); timerDisplay.style.display = 'none'; }
    actionArea.style.display = 'none'; document.getElementById('p1-score').innerText = data.scores[0]; if (!isSinglePlayerMode) document.getElementById('p2-score').innerText = data.scores[1];
    statusMsg.innerText = `${data.winnerName}\nCevap: ${data.correctPlayer}`; statusMsg.style.color = "#2ecc71";
});

socket.on('gameOver', (data) => {
    isRoundActive = false; 
    clearInterval(countdownInterval); 
    clearInterval(spGlobalInterval); 
    clearInterval(roundStartInterval); 
    
    actionArea.style.display = 'none'; 
    timerDisplay.style.display = 'none'; 
    matchTeamsContainer.style.display = 'none';
    
    document.getElementById('p1-score').innerText = data.scores[0];
    if (isSinglePlayerMode) {
        statusMsg.innerText = `SÜRE BİTTİ! ⏰\nToplam Skorun: ${data.scores[0]}`; 
    } else { 
        document.getElementById('p2-score').innerText = data.scores[1]; 
        statusMsg.innerText = `🏆 KAZANAN: ${data.winnerName.toUpperCase()} 🏆\n(Son Cevap: ${data.correctPlayer})`; 
    }
    
    statusMsg.style.color = "#3498db";
    
    var duration = 3 * 1000; var end = Date.now() + duration;
    (function frame() { 
        confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#FFD700', '#FFFFFF', '#1E90FF'] }); 
        confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#FFD700', '#FFFFFF', '#1E90FF'] }); 
        if (Date.now() < end) requestAnimationFrame(frame); 
    }());
});

socket.on('playAgainReady', () => { 
    isFirstRoundSP = true; 
    clearInterval(roundStartInterval); 
    if (isSinglePlayerMode) { clearInterval(spGlobalInterval); spTimerLeft = 120; } 
    else clearInterval(countdownInterval); 
    document.getElementById('p1-score').innerText = "0"; 
    document.getElementById('p2-score').innerText = "0"; 
});

document.getElementById('exit-btn').addEventListener('click', () => { window.location.reload(); }); document.getElementById('waiting-exit-btn').addEventListener('click', () => { window.location.reload(); }); document.getElementById('new-game-btn').addEventListener('click', () => { socket.emit('playAgain', myRoomCode); });
