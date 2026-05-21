// Connect relatively to the same domain (works both locally and on Render)
const BACKEND_URL = '';
const socket = io(BACKEND_URL);

const localProfileKey = 'memory-card-profile';
const localRoomKey = 'memory-card-room';
const localClientIdKey = 'memory-card-client-id';

const elements = {
  profileScreen: document.getElementById('profileScreen'),
  lobbyScreen: document.getElementById('lobbyScreen'),
  roomScreen: document.getElementById('roomScreen'),
  usernameInput: document.getElementById('usernameInput'),
  avatarPicker: document.getElementById('avatarPicker'),
  saveProfileBtn: document.getElementById('saveProfileBtn'),
  savedProfileChip: document.getElementById('savedProfileChip'),
  editProfileBtn: document.getElementById('editProfileBtn'),
  createRoomBtn: document.getElementById('createRoomBtn'),
  joinRoomToggleBtn: document.getElementById('joinRoomToggleBtn'),
  joinBox: document.getElementById('joinBox'),
  roomIdInput: document.getElementById('roomIdInput'),
  joinRoomBtn: document.getElementById('joinRoomBtn'),
  hostSettings: document.getElementById('hostSettings'),
  difficultySelect: document.getElementById('difficulty'),
  themeSelect: document.getElementById('theme'),
  gameModeSelect: document.getElementById('gameMode'),
  roomIdLabel: document.getElementById('roomIdLabel'),
  copyRoomBtn: document.getElementById('copyRoomBtn'),
  startMatchBtn: document.getElementById('startMatchBtn'),
  leaveRoomBtn: document.getElementById('leaveRoomBtn'),
  roomModeLabel: document.getElementById('roomModeLabel'),
  gameModeLabel: document.getElementById('gameModeLabel'),
  roomPlayersLabel: document.getElementById('roomPlayersLabel'),
  playersPanel: document.getElementById('playersPanel'),
  gameBoard: document.getElementById('gameBoard'),
  moves: document.getElementById('moves'),
  timer: document.getElementById('timer'),
  statusLabel: document.getElementById('statusLabel'),
  resultModal: document.getElementById('resultModal'),
  resultTitle: document.getElementById('resultTitle'),
  resultMessage: document.getElementById('resultMessage'),
  finalRoomId: document.getElementById('finalRoomId'),
  winnerText: document.getElementById('winnerText'),
  yourScoreText: document.getElementById('yourScoreText'),
  backToLobbyBtn: document.getElementById('backToLobbyBtn'),
  chatMessages: document.getElementById('chatMessages'),
  chatForm: document.getElementById('chatForm'),
  chatInput: document.getElementById('chatInput'),
  themeCheckbox: document.getElementById('themeCheckbox'),
  themeIcon: document.getElementById('themeIcon')
};

const appState = {
  clientId: localStorage.getItem(localClientIdKey) || crypto.randomUUID(),
  profile: JSON.parse(localStorage.getItem(localProfileKey) || 'null'),
  selectedAvatar: 'adventurer-1',
  room: null,
  selectedRoomId: localStorage.getItem(localRoomKey) || '',
  boardLocked: false,
  timerInterval: null,
  seconds: 0,
  lastStatus: null,
  theme: localStorage.getItem('theme') || 'dark'
};

// Apply theme on load
document.body.setAttribute('data-theme', appState.theme);
if (elements.themeCheckbox) {
  elements.themeCheckbox.checked = appState.theme === 'dark';
  elements.themeIcon.textContent = appState.theme === 'dark' ? '🌙' : '☀️';
}

if (appState.profile) {
  appState.selectedAvatar = appState.profile.avatar;
}

localStorage.setItem(localClientIdKey, appState.clientId);

function showScreen(screen) {
  [elements.profileScreen, elements.lobbyScreen, elements.roomScreen].forEach((node) => node.classList.remove('active'));
  screen.classList.add('active');
}

function syncProfileChip() {
  if (!appState.profile) return;
  const avatarUrl = getAvatarUrl(appState.profile.avatar);
  elements.savedProfileChip.innerHTML = `<img src="${avatarUrl}" alt="avatar"> ${appState.profile.username}`;
  elements.usernameInput.value = appState.profile.username;
}

function getAvatarUrl(avatarId) {
  const avatars = {
    'adventurer-1': 'https://api.dicebear.com/7.x/big-smile/svg?seed=Felix',
    'adventurer-2': 'https://api.dicebear.com/7.x/big-smile/svg?seed=Aria',
    'adventurer-3': 'https://api.dicebear.com/7.x/big-smile/svg?seed=Jack',
    'adventurer-4': 'https://api.dicebear.com/7.x/big-smile/svg?seed=Milo',
    'adventurer-5': 'https://api.dicebear.com/7.x/big-smile/svg?seed=Luna',
    'notion-1': 'https://api.dicebear.com/7.x/lorelei/svg?seed=Jasper',
    'notion-2': 'https://api.dicebear.com/7.x/lorelei/svg?seed=Sasha',
    'bot-1': 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=B1',
    'bot-2': 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=B2',
    'fun-1': 'https://api.dicebear.com/7.x/avataaars/svg?seed=F1'
  };
  return avatars[avatarId] || `https://api.dicebear.com/7.x/big-smile/svg?seed=${avatarId}`;
}

function normalizeUsername(value) { return String(value || '').trim().slice(0, 24); }
function normalizeAvatar(value) { return String(value || 'adventurer-1').trim().slice(0, 32); }

function updateTimerDisplay() {
  const min = Math.floor(appState.seconds / 60);
  const sec = appState.seconds % 60;
  elements.timer.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function startTimer() {
  stopTimer();
  appState.seconds = 0;
  updateTimerDisplay();
  appState.timerInterval = window.setInterval(() => {
    appState.seconds += 1;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (appState.timerInterval) {
    clearInterval(appState.timerInterval);
    appState.timerInterval = null;
  }
  appState.seconds = 0;
  updateTimerDisplay();
}

function renderPlayers(room) {
  elements.playersPanel.innerHTML = '';
  room.players.forEach((p) => {
    const card = document.createElement('div');
    card.className = `player-card${p.clientId === room.currentTurnClientId ? ' active' : ''}`;
    const avatarUrl = getAvatarUrl(p.avatar);
    card.innerHTML = `
      <div class="player-name">
        <img src="${avatarUrl}" alt="avatar">
        ${p.username}
      </div>
      <div class="player-score">${p.score}</div>
    `;
    elements.playersPanel.appendChild(card);
  });
}

function appendChatMessage(msg) {
  const div = document.createElement('div');
  div.className = `chat-msg${msg.clientId === 'system' ? ' system' : ''}`;
  if (msg.clientId === 'system') {
    div.textContent = msg.text;
  } else {
    div.innerHTML = `<span class="chat-msg-user">${msg.username}:</span> ${msg.text}`;
  }
  elements.chatMessages.appendChild(div);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function renderBoard(room) {
  const gridClass = room.difficulty === 'hard' ? 'grid-5x6' : room.difficulty === 'easy' ? 'grid-4x4' : 'grid-4x5';
  elements.gameBoard.className = `game-board ${gridClass}`;

  const existingCards = elements.gameBoard.querySelectorAll('.card');

  if (existingCards.length !== room.board.length) {
    elements.gameBoard.innerHTML = '';
    room.board.forEach((card, i) => {
      const cardEl = document.createElement('button');
      cardEl.className = 'card';

      const inner = document.createElement('div');
      inner.className = 'card-inner';

      const back = document.createElement('div');
      back.className = 'card-back';
      back.textContent = '?';

      const front = document.createElement('div');
      front.className = 'card-front';

      inner.appendChild(back);
      inner.appendChild(front);
      cardEl.appendChild(inner);

      if (card.revealed || card.matched) {
        cardEl.classList.add('flipped');
        front.textContent = card.value;
      }
      if (card.matched) {
        cardEl.classList.add('matched');
      }
      cardEl.addEventListener('click', () => flipCard(i));
      elements.gameBoard.appendChild(cardEl);
    });
  } else {
    room.board.forEach((card, i) => {
      const cardEl = existingCards[i];
      if (!cardEl) return;
      const front = cardEl.querySelector('.card-front');

      const isFlipped = card.revealed || card.matched;
      if (isFlipped) {
        cardEl.classList.add('flipped');
        front.textContent = card.value;
      } else {
        cardEl.classList.remove('flipped');
        setTimeout(() => {
          if (!cardEl.classList.contains('flipped')) {
            front.textContent = '';
          }
        }, 350);
      }

      if (card.matched) {
        cardEl.classList.add('matched');
      } else {
        cardEl.classList.remove('matched');
      }
    });
  }
}

function refreshRoomView(room) {
  // Clear chat if room changed or status changed
  const statusChanged = appState.lastStatus && appState.lastStatus !== room.status;
  const roomChanged = !appState.room || appState.room.roomId !== room.roomId;
  if (roomChanged || statusChanged) {
    elements.chatMessages.innerHTML = '';
  }
  appState.lastStatus = room.status;

  appState.room = room;
  localStorage.setItem(localRoomKey, room.roomId);

  const isHost = String(room.hostClientId) === String(appState.clientId);

  elements.roomIdLabel.textContent = room.roomId;
  elements.roomModeLabel.textContent = room.status.toUpperCase();
  if (elements.gameModeLabel) {
    elements.gameModeLabel.textContent = room.gameMode === 'time-attack' ? 'Time Attack' : 'Classic';
  }
  elements.roomPlayersLabel.textContent = room.players.length;
  renderPlayers(room);

  // Show/hide host settings and start button
  if (isHost && room.status === 'lobby') {
    elements.hostSettings.classList.remove('hidden');
    elements.startMatchBtn.classList.remove('hidden');
  } else {
    elements.hostSettings.classList.add('hidden');
    elements.startMatchBtn.classList.add('hidden');
  }

  if (room.status === 'playing') {
    elements.gameBoard.classList.remove('hidden');
    renderBoard(room);
    if (!appState.timerInterval) startTimer();
    elements.statusLabel.textContent = room.currentTurnClientId === appState.clientId ? '✨ Your turn!' : '⏳ Opponent\'s turn...';
    elements.moves.textContent = room.players.reduce((sum, p) => sum + p.score, 0);
    // Ensure the room screen remains visible for all participants
    showScreen(elements.roomScreen);
  } else {
    elements.gameBoard.classList.add('hidden');
    stopTimer();
    elements.moves.textContent = '0';
    if (room.status === 'lobby') {
      elements.statusLabel.textContent = isHost ? '⚙️ Setup your game...' : '⏳ Waiting for host...';
      if (elements.gameModeSelect) elements.gameModeSelect.value = room.gameMode || 'classic';
    }
  }

  // Update dropdowns if host and in lobby
  if (isHost && room.status === 'lobby') {
    elements.difficultySelect.value = room.difficulty;
    elements.themeSelect.value = room.theme;
    if (elements.gameModeSelect) elements.gameModeSelect.value = room.gameMode || 'classic';
  }

  if (room.status === 'finished') showResult(room);
}

function showResult(room) {
  const max = Math.max(...room.players.map(p => p.score));
  const winners = room.players.filter(p => p.score === max).map(p => {
    const avatarUrl = getAvatarUrl(p.avatar);
    return `<img src="${avatarUrl}" style="width:24px; vertical-align:middle; border-radius:50%; margin-right:5px;"> ${p.username}`;
  }).join(', ');
  elements.resultModal.classList.remove('hidden');
  elements.resultTitle.textContent = room.gameMode === 'time-attack' ? '⏱️ Time Attack Complete!' : '🏆 Game Over';
  elements.winnerText.innerHTML = winners;
  elements.finalRoomId.textContent = room.roomId;
  elements.yourScoreText.textContent = room.players.find(p => p.clientId === appState.clientId)?.score || 0;
}

function emitWithAck(ev, data) {
  return new Promise((res, rej) => {
    socket.emit(ev, data, (r) => r?.ok ? res(r) : rej(new Error(r?.error || 'Failed')));
  });
}

async function saveProfile() {
  const username = normalizeUsername(elements.usernameInput.value);
  const avatar = normalizeAvatar(appState.selectedAvatar);
  if (!username) {
    alert('Please enter a username');
    return;
  }
  appState.profile = { username, avatar };
  localStorage.setItem(localProfileKey, JSON.stringify(appState.profile));
  try {
    await emitWithAck('user:save', { clientId: appState.clientId, username, avatar });
    syncProfileChip();
    showScreen(elements.lobbyScreen);
  } catch (err) {
    console.error('Failed to save profile:', err);
    syncProfileChip();
    showScreen(elements.lobbyScreen);
  }
}

function setupAvatarPicker() {
  elements.avatarPicker.addEventListener('click', (e) => {
    const btn = e.target.closest('.avatar-option');
    if (!btn) return;
    elements.avatarPicker.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('active'));
    btn.classList.add('active');
    appState.selectedAvatar = btn.getAttribute('data-avatar');
  });
}

function initAvatarPicker() {
  if (appState.profile) {
    appState.selectedAvatar = appState.profile.avatar;
    const btn = elements.avatarPicker.querySelector(`[data-avatar="${appState.profile.avatar}"]`);
    if (btn) {
      elements.avatarPicker.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('active'));
      btn.classList.add('active');
    }
  }
}

async function createRoom() {
  try {
    const res = await emitWithAck('room:create', {
      clientId: appState.clientId,
      username: appState.profile.username,
      avatar: appState.profile.avatar,
      difficulty: elements.difficultySelect.value,
      theme: elements.themeSelect.value,
      gameMode: elements.gameModeSelect.value
    });
    refreshRoomView(res.room);
    showScreen(elements.roomScreen);
  } catch (err) { alert(err.message); }
}

async function joinRoom() {
  const roomId = elements.roomIdInput.value.trim().toUpperCase();
  if (!roomId) return alert('Enter a Room ID');
  try {
    const res = await emitWithAck('room:join', {
      clientId: appState.clientId,
      username: appState.profile.username,
      avatar: appState.profile.avatar,
      roomId
    });
    refreshRoomView(res.room);
    showScreen(elements.roomScreen);
  } catch (err) { alert(err.message); }
}

function updateRoomSettings() {
  if (!appState.room || appState.room.hostClientId !== appState.clientId) return;
  socket.emit('room:settings', {
    roomId: appState.room.roomId,
    difficulty: elements.difficultySelect.value,
    theme: elements.themeSelect.value,
    gameMode: elements.gameModeSelect.value
  });
}

async function flipCard(i) {
  if (appState.boardLocked) return;
  if (appState.room?.gameMode === 'classic' && appState.room?.currentTurnClientId !== appState.clientId) return;

  const cards = elements.gameBoard.querySelectorAll('.card');
  const cardEl = cards[i];
  if (cardEl && !cardEl.classList.contains('flipped')) {
    cardEl.classList.add('flipped');
    const cardData = appState.room?.board[i];
    if (cardData) {
      const front = cardEl.querySelector('.card-front');
      if (front) front.textContent = cardData.value;
    }
  }

  appState.boardLocked = true;
  try { await emitWithAck('game:flip', { roomId: appState.room.roomId, clientId: appState.clientId, index: i }); }
  finally { appState.boardLocked = false; }
}

function toggleTheme() {
  appState.theme = elements.themeCheckbox.checked ? 'dark' : 'light';
  document.body.setAttribute('data-theme', appState.theme);
  localStorage.setItem('theme', appState.theme);
  elements.themeIcon.textContent = appState.theme === 'dark' ? '🌙' : '☀️';
}

function setupEventListeners() {
  elements.saveProfileBtn.addEventListener('click', saveProfile);
  elements.createRoomBtn.addEventListener('click', createRoom);
  elements.joinRoomToggleBtn.addEventListener('click', () => elements.joinBox.classList.toggle('hidden'));
  elements.joinRoomBtn.addEventListener('click', joinRoom);
  elements.difficultySelect.addEventListener('change', updateRoomSettings);
  elements.themeSelect.addEventListener('change', updateRoomSettings);
  elements.gameModeSelect.addEventListener('change', updateRoomSettings);
  elements.startMatchBtn.addEventListener('click', () => {
    socket.emit('room:start', { roomId: appState.room.roomId, clientId: appState.clientId });
  });
  elements.leaveRoomBtn.addEventListener('click', () => {
    if (appState.room) socket.emit('room:leave', { roomId: appState.room.roomId, clientId: appState.clientId });
    appState.room = null;
    appState.selectedRoomId = '';
    localStorage.removeItem(localRoomKey);
    showScreen(elements.lobbyScreen);
  });
  elements.copyRoomBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(appState.room?.roomId || '');
    elements.copyRoomBtn.textContent = 'Copied!';
    setTimeout(() => elements.copyRoomBtn.textContent = 'Copy ID', 2000);
  });
  elements.backToLobbyBtn.addEventListener('click', () => {
    elements.resultModal.classList.add('hidden');
    if (appState.room) {
      socket.emit('room:leave', { roomId: appState.room.roomId, clientId: appState.clientId });
    }
    appState.room = null;
    appState.selectedRoomId = '';
    localStorage.removeItem(localRoomKey);
    showScreen(elements.lobbyScreen);
  });
  elements.chatForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = elements.chatInput.value.trim();
    if (text && appState.room) {
      socket.emit('chat:message', { roomId: appState.room.roomId, clientId: appState.clientId, text });
      elements.chatInput.value = '';
    }
  });
  if (elements.editProfileBtn) {
    elements.editProfileBtn.addEventListener('click', () => showScreen(elements.profileScreen));
  }
  elements.themeCheckbox.addEventListener('change', toggleTheme);
  setupAvatarPicker();
}

// Reconnection logic and start
async function init() {
  syncProfileChip();
  initAvatarPicker();
  if (appState.profile) {
    if (appState.selectedRoomId) {
      try {
        const res = await emitWithAck('room:join', { ...appState.profile, clientId: appState.clientId, roomId: appState.selectedRoomId });
        refreshRoomView(res.room);
        showScreen(elements.roomScreen);
      } catch (e) {
        showScreen(elements.lobbyScreen);
      }
    } else {
      showScreen(elements.lobbyScreen);
    }
  } else {
    showScreen(elements.profileScreen);
  }
  setupEventListeners();
}

init();

socket.on('room:update', refreshRoomView);
socket.on('chat:message', appendChatMessage);
socket.on('connect', () => {
  if (appState.profile) emitWithAck('user:save', { clientId: appState.clientId, ...appState.profile });
});