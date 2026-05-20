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
  createRoomBtn: document.getElementById('createRoomBtn'),
  joinRoomToggleBtn: document.getElementById('joinRoomToggleBtn'),
  joinBox: document.getElementById('joinBox'),
  roomIdInput: document.getElementById('roomIdInput'),
  joinRoomBtn: document.getElementById('joinRoomBtn'),
  hostSettings: document.getElementById('hostSettings'),
  difficultySelect: document.getElementById('difficulty'),
  themeSelect: document.getElementById('theme'),
  roomIdLabel: document.getElementById('roomIdLabel'),
  copyRoomBtn: document.getElementById('copyRoomBtn'),
  startMatchBtn: document.getElementById('startMatchBtn'),
  leaveRoomBtn: document.getElementById('leaveRoomBtn'),
  roomModeLabel: document.getElementById('roomModeLabel'),
  roomPlayersLabel: document.getElementById('roomPlayersLabel'),
  turnLabel: document.getElementById('turnLabel'),
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
  // New elements for Skribbl-like UI
  chatMessages: document.getElementById('chatMessages'),
  chatForm: document.getElementById('chatForm'),
  chatInput: document.getElementById('chatInput')
};

const appState = {
  clientId: localStorage.getItem(localClientIdKey) || crypto.randomUUID(),
  profile: JSON.parse(localStorage.getItem(localProfileKey) || 'null'),
  selectedAvatar: 'adventurer-1',
  room: null,
  selectedRoomId: localStorage.getItem(localRoomKey) || '',
  boardLocked: false,
  timerInterval: null,
  seconds: 0
};

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
    'adventurer-1': 'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix',
    'adventurer-2': 'https://api.dicebear.com/7.x/adventurer/svg?seed=Aria',
    'adventurer-3': 'https://api.dicebear.com/7.x/adventurer/svg?seed=Jack',
    'adventurer-4': 'https://api.dicebear.com/7.x/adventurer/svg?seed=Milo',
    'adventurer-5': 'https://api.dicebear.com/7.x/adventurer/svg?seed=Luna',
    'notion-1': 'https://api.dicebear.com/7.x/notionists/svg?seed=Jasper',
    'notion-2': 'https://api.dicebear.com/7.x/notionists/svg?seed=Sasha',
    'bot-1': 'https://api.dicebear.com/7.x/bottts/svg?seed=B1',
    'bot-2': 'https://api.dicebear.com/7.x/bottts/svg?seed=B2',
    'fun-1': 'https://api.dicebear.com/7.x/fun-emoji/svg?seed=F1'
  };
  return avatars[avatarId] || `https://api.dicebear.com/7.x/adventurer/svg?seed=${avatarId}`;
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
  appState.timerInterval = window.setInterval(() => {
    appState.seconds += 1;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (appState.timerInterval) { clearInterval(appState.timerInterval); appState.timerInterval = null; }
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
  
  // If the board layout changed or is empty, rebuild the DOM elements
  if (existingCards.length !== room.board.length) {
    elements.gameBoard.innerHTML = '';
    room.board.forEach((card, i) => {
      const cardEl = document.createElement('button');
      cardEl.className = 'card';
      if (card.revealed || card.matched) {
        cardEl.classList.add('flipped');
        cardEl.textContent = card.value;
      }
      if (card.matched) {
        cardEl.classList.add('matched');
      }
      cardEl.addEventListener('click', () => flipCard(i));
      elements.gameBoard.appendChild(cardEl);
    });
  } else {
    // Update existing elements in place to preserve CSS transition animations
    room.board.forEach((card, i) => {
      const cardEl = existingCards[i];
      if (!cardEl) return;
      
      const isFlipped = card.revealed || card.matched;
      if (isFlipped) {
        cardEl.classList.add('flipped');
        cardEl.textContent = card.value;
      } else {
        cardEl.classList.remove('flipped');
        // Clear text after flip transition ends (300ms) to avoid text vanishing mid-rotation
        setTimeout(() => {
          if (!cardEl.classList.contains('flipped')) {
            cardEl.textContent = '';
          }
        }, 300);
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
  appState.room = room;
  localStorage.setItem(localRoomKey, room.roomId);
  
  const isHost = String(room.hostClientId) === String(appState.clientId);
  
  elements.roomIdLabel.textContent = room.roomId;
  elements.roomModeLabel.textContent = room.status.toUpperCase();
  elements.roomPlayersLabel.textContent = room.players.length;
  renderPlayers(room);

  if (room.status === 'playing') {
    elements.gameBoard.classList.remove('hidden');
    renderBoard(room);
    if (!appState.timerInterval) startTimer();
    elements.statusLabel.textContent = room.currentTurnClientId === appState.clientId ? 'Your turn!' : 'Opponent turn...';
  } else {
    elements.gameBoard.classList.add('hidden');
    stopTimer();
    if (room.status === 'lobby') {
      elements.statusLabel.textContent = isHost ? 'Setup your game...' : 'Waiting for host...';
    } else {
      elements.statusLabel.textContent = 'Game Over';
    }
  }

  elements.startMatchBtn.classList.toggle('hidden', !isHost || room.status !== 'lobby');

  // Show host settings only to host when in lobby
  if (elements.hostSettings) {
    elements.hostSettings.classList.toggle('hidden', !isHost || room.status !== 'lobby');
  }

  // Update dropdowns if host
  if (isHost && room.status === 'lobby') {
    elements.difficultySelect.value = room.difficulty;
    elements.themeSelect.value = room.theme;
  }

  if (room.status === 'finished') showResult(room);
}

function showResult(room) {
  const max = Math.max(...room.players.map(p => p.score));
  const winners = room.players.filter(p => p.score === max).map(p => {
    const avatarUrl = getAvatarUrl(p.avatar);
    return `<img src="${avatarUrl}" style="width:20px; vertical-align:middle; border-radius:50%;"> ${p.username}`;
  }).join(', ');
  elements.resultModal.classList.remove('hidden');
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
    // Fallback if server is slow/offline for a moment
    syncProfileChip();
    showScreen(elements.lobbyScreen);
  }
}

// Avatar selection logic
function setupAvatarPicker() {
  elements.avatarPicker.addEventListener('click', (e) => {
    const btn = e.target.closest('.avatar-option');
    if (!btn) return;
    
    // Remove active class from all
    elements.avatarPicker.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('active'));
    
    // Add active class to clicked
    btn.classList.add('active');
    appState.selectedAvatar = btn.getAttribute('data-avatar');
    console.log('Selected avatar:', appState.selectedAvatar);
  });
}
setupAvatarPicker();

// Update selections on load
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
initAvatarPicker();

async function createRoom() {
  const r = await emitWithAck('room:create', { 
    ...appState.profile, 
    clientId: appState.clientId, 
    difficulty: 'medium', 
    theme: 'emojis' 
  });
  refreshRoomView(r.room);
  showScreen(elements.roomScreen);
}

// Update room settings (host only)
const updateRoomSettings = () => {
  if (!appState.room || appState.room.hostClientId !== appState.clientId) return;
  socket.emit('room:settings', {
    roomId: appState.room.roomId,
    difficulty: elements.difficultySelect.value,
    theme: elements.themeSelect.value
  });
};

// Chat events
elements.chatForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = elements.chatInput.value.trim();
  if (!text || !appState.room) return;
  socket.emit('chat:message', { roomId: appState.room.roomId, clientId: appState.clientId, text });
  elements.chatInput.value = '';
});

socket.on('chat:message', appendChatMessage);

elements.difficultySelect.addEventListener('change', updateRoomSettings);
elements.themeSelect.addEventListener('change', updateRoomSettings);

async function joinRoom() {
  const id = elements.roomIdInput.value.trim().toUpperCase();
  if (!id) return;
  const r = await emitWithAck('room:join', { ...appState.profile, clientId: appState.clientId, roomId: id });
  refreshRoomView(r.room);
  showScreen(elements.roomScreen);
}

async function flipCard(i) {
  if (appState.boardLocked || appState.room?.currentTurnClientId !== appState.clientId) return;
  
  // Optimistically flip the card locally for instant visual response
  const cards = elements.gameBoard.querySelectorAll('.card');
  const cardEl = cards[i];
  if (cardEl && !cardEl.classList.contains('flipped')) {
    cardEl.classList.add('flipped');
    const cardData = appState.room?.board[i];
    if (cardData) {
      cardEl.textContent = cardData.value;
    }
  }

  appState.boardLocked = true;
  try { await emitWithAck('game:flip', { roomId: appState.room.roomId, clientId: appState.clientId, index: i }); }
  finally { appState.boardLocked = false; }
}

socket.on('room:update', refreshRoomView);
socket.on('connect', () => {
  if (appState.profile) {
    showScreen(elements.lobbyScreen);
    syncProfileChip();
    emitWithAck('user:save', { clientId: appState.clientId, ...appState.profile });
  }
});

elements.saveProfileBtn.addEventListener('click', saveProfile);
elements.createRoomBtn.addEventListener('click', createRoom);
elements.joinRoomToggleBtn.addEventListener('click', () => elements.joinBox.classList.toggle('hidden'));
elements.joinRoomBtn.addEventListener('click', joinRoom);
elements.startMatchBtn.addEventListener('click', () => emitWithAck('room:start', { roomId: appState.room.roomId, clientId: appState.clientId }));
const editProfileBtn = document.getElementById('editProfileBtn');
if (editProfileBtn) {
  editProfileBtn.addEventListener('click', () => showScreen(elements.profileScreen));
}
elements.leaveRoomBtn.addEventListener('click', () => {
  if (appState.room) {
    socket.emit('room:leave', { roomId: appState.room.roomId, clientId: appState.clientId });
  }
  appState.room = null;
  localStorage.removeItem(localRoomKey);
  showScreen(elements.lobbyScreen);
});

elements.backToLobbyBtn.addEventListener('click', () => {
  if (appState.room) {
    socket.emit('room:leave', { roomId: appState.room.roomId, clientId: appState.clientId });
  }
  elements.resultModal.classList.add('hidden');
  appState.room = null;
  localStorage.removeItem(localRoomKey);
  showScreen(elements.lobbyScreen);
});
elements.copyRoomBtn.addEventListener('click', () => navigator.clipboard.writeText(appState.room.roomId));