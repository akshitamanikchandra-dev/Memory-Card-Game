require('dotenv').config();

// Triggering Render redeploy to pull updated frontend script changes (optimistic card flipping & timer fixes)
const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const Room = require('./models/Room');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

const themes = {
  emojis: ['😀', '😂', '😍', '😎', '😜', '🤩', '🥳', '😇', '🤔', '😏', '😢', '🤬', '😱', '🥰', '😘', '🤗'],
  animals: ['🐶', '🐱', '🐭', '🐰', '🦊', '🐼', '🐯', '🦁', '🐨', '🐻', '🦝', '🐮', '🐷', '🐸', '🐵', '🦄'],
  fruits: ['🍎', '🍌', '🍉', '🍇', '🍓', '🍍', '🥭', '🍒', '🍑', '🍐', '🍊', '🍋', '🍈', '🥑', '🍅', '🫐'],
  objects: ['🚗', '✈️', '🚀', '📱', '💻', '🎧', '⌚', '📷', '🎮', '🎸', '🎹', '🎬', '📚', '📝', '⚽', '🎾']
};

const difficulties = {
  easy: { rows: 4, cols: 4, total: 16 },
  medium: { rows: 4, cols: 5, total: 20 },
  hard: { rows: 5, cols: 6, total: 30 }
};

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function createBoard(theme, difficulty) {
  const themeArray = themes[theme];
  const diffConfig = difficulties[difficulty];
  const cards = [];
  for (let i = 0; i < diffConfig.total / 2; i++) {
    cards.push(themeArray[i], themeArray[i]);
  }
  return shuffleArray(cards).map((value) => ({ value, revealed: false, matched: false }));
}

function normalizeUsername(username) {
  return String(username || '').trim().slice(0, 24) || 'Player';
}

function normalizeAvatar(avatar) {
  return String(avatar || 'adventurer-1').trim().slice(0, 32);
}

function buildPublicRoom(room) {
  return {
    roomId: room.roomId,
    hostClientId: room.hostClientId,
    status: room.status,
    gameMode: room.gameMode,
    difficulty: room.difficulty,
    theme: room.theme,
    board: room.board,
    players: room.players,
    currentTurnClientId: room.currentTurnClientId,
    flippedIndices: room.flippedIndices,
    winnerClientIds: room.winnerClientIds,
    locked: room.locked
  };
}

async function upsertUser(clientId, username, avatar) {
  await User.findOneAndUpdate(
    { clientId },
    { clientId, username: normalizeUsername(username), avatar: normalizeAvatar(avatar) },
    { upsert: true, new: true }
  );
}

async function broadcastRoom(roomId) {
  const room = await Room.findOne({ roomId }).lean();
  if (!room) return;
  io.to(roomId).emit('room:update', buildPublicRoom(room));
}

function broadcastSystemMessage(roomId, text) {
  io.to(roomId).emit('chat:message', {
    clientId: 'system',
    username: 'System',
    text,
    timestamp: Date.now()
  });
}

function setNextTurn(room) {
  const activePlayers = room.players.filter((player) => player.connected);
  if (!activePlayers.length) {
    room.currentTurnClientId = null;
    return;
  }
  const currentIndex = activePlayers.findIndex((player) => player.clientId === room.currentTurnClientId);
  const nextPlayer = activePlayers[(currentIndex + 1) % activePlayers.length] || activePlayers[0];
  room.currentTurnClientId = nextPlayer.clientId;
}

async function finishRoomIfNeeded(room) {
  const matchedCount = room.board.filter((card) => card.matched).length;
  if (matchedCount !== room.board.length) return;

  const highScore = Math.max(...room.players.map((player) => player.score));
  room.winnerClientIds = room.players.filter((player) => player.score === highScore).map((player) => player.clientId);
  room.status = 'finished';
  room.locked = false;
  room.flippedIndices = [];
  await room.save();
  await broadcastRoom(room.roomId);
}

async function handlePlayerLeave(roomId, clientId) {
  try {
    const room = await Room.findOne({ roomId });
    if (!room) return;

    const playerIndex = room.players.findIndex((p) => p.clientId === clientId);
    if (playerIndex === -1) return;

    const player = room.players[playerIndex];
    const username = player.username;

    // Remove player
    room.players.splice(playerIndex, 1);

    // If no players left, delete the room
    if (room.players.length === 0) {
      await Room.deleteOne({ roomId });
      return;
    }

    // Transfer host if host left
    if (room.hostClientId === clientId) {
      room.hostClientId = room.players[0].clientId;
    }

    // End match if active and only 1 player remains
    if (room.status === 'playing' && room.players.length === 1) {
      room.status = 'finished';
      room.winnerClientIds = [room.players[0].clientId];
      room.currentTurnClientId = null;
      room.flippedIndices = [];
      room.locked = false;
    }

    // Set next turn if active and it was their turn
    if (room.status === 'playing' && room.currentTurnClientId === clientId) {
      setNextTurn(room);
    }

    await room.save();
    await broadcastRoom(roomId);
    broadcastSystemMessage(roomId, `${username} left the room`);
  } catch (error) {
    console.error('Error handling player leave:', error);
  }
}

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  });

io.on('connection', (socket) => {
  socket.on('user:save', async ({ clientId, username, avatar }, callback) => {
    try {
      await upsertUser(clientId, username, avatar);
      socket.clientId = clientId;
      callback?.({ ok: true });
    } catch (error) {
      callback?.({ ok: false, error: error.message });
    }
  });

  socket.on('room:create', async ({ clientId, username, avatar, difficulty, theme, gameMode }, callback) => {
    try {
      await upsertUser(clientId, username, avatar);
      const roomId = Math.random().toString(36).slice(2, 8).toUpperCase();
      const room = await Room.create({
        roomId,
        hostClientId: clientId,
        status: 'lobby',
        gameMode: gameMode || 'classic',
        difficulty,
        theme,
        board: createBoard(theme, difficulty),
        players: [{ clientId, username: normalizeUsername(username), avatar: normalizeAvatar(avatar), score: 0, connected: true }],
        currentTurnClientId: null,
        flippedIndices: [],
        winnerClientIds: [],
        locked: false
      });

      socket.join(roomId);
      socket.clientId = clientId;
      socket.roomId = roomId;
      callback?.({ ok: true, room: buildPublicRoom(room.toObject()) });
      io.to(roomId).emit('room:update', buildPublicRoom(room.toObject()));
    } catch (error) {
      callback?.({ ok: false, error: error.message });
    }
  });

  socket.on('room:join', async ({ clientId, username, avatar, roomId }, callback) => {
    try {
      await upsertUser(clientId, username, avatar);
      const room = await Room.findOne({ roomId: String(roomId || '').trim().toUpperCase() });
      if (!room) {
        callback?.({ ok: false, error: 'Room not found' });
        return;
      }

      const existingPlayer = room.players.find((player) => player.clientId === clientId);
      if (existingPlayer) {
        existingPlayer.username = normalizeUsername(username);
        existingPlayer.avatar = normalizeAvatar(avatar);
        existingPlayer.connected = true;
      } else {
        room.players.push({ clientId, username: normalizeUsername(username), avatar: normalizeAvatar(avatar), score: 0, connected: true });
      }

      if (room.status === 'finished') {
        room.status = 'lobby';
      }

      await room.save();
      socket.join(room.roomId);
      socket.clientId = clientId;
      socket.roomId = room.roomId;
      callback?.({ ok: true, room: buildPublicRoom(room.toObject()) });
      await broadcastRoom(room.roomId);
      broadcastSystemMessage(room.roomId, `${normalizeUsername(username)} joined the room`);
    } catch (error) {
      callback?.({ ok: false, error: error.message });
    }
  });

  socket.on('chat:message', async ({ roomId, clientId, text }) => {
    try {
      const user = await User.findOne({ clientId });
      if (!user) return;
      io.to(roomId).emit('chat:message', {
        clientId,
        username: user.username,
        text: String(text).slice(0, 200),
        timestamp: Date.now()
      });
    } catch (e) {}
  });

  socket.on('room:sync', async ({ roomId }, callback) => {
    try {
      const room = await Room.findOne({ roomId: String(roomId || '').trim().toUpperCase() }).lean();
      if (!room) {
        callback?.({ ok: false, error: 'Room not found' });
        return;
      }
      callback?.({ ok: true, room: buildPublicRoom(room) });
    } catch (error) {
      callback?.({ ok: false, error: error.message });
    }
  });

  socket.on('room:settings', async ({ roomId, difficulty, theme, gameMode }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (!room || room.status !== 'lobby') return;
      const previousGameMode = room.gameMode || 'classic';
      
      room.difficulty = difficulty;
      room.theme = theme;
      room.gameMode = gameMode || room.gameMode;
      room.board = createBoard(theme, difficulty);
      await room.save();
      
      await broadcastRoom(roomId);
      if (room.gameMode !== previousGameMode) {
        const modeLabel = room.gameMode === 'time-attack' ? 'Time Attack' : 'Classic';
        broadcastSystemMessage(roomId, `Game mode switched to ${modeLabel}. Everyone in the room can see the new instructions.`);
      }
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  });

  socket.on('room:start', async ({ roomId, clientId }, callback) => {
    try {
      const activeClientId = clientId || socket.clientId;
      const room = await Room.findOne({ roomId: String(roomId || '').trim().toUpperCase() });
      if (!room) {
        callback?.({ ok: false, error: 'Room not found' });
        return;
      }

      if (room.hostClientId !== activeClientId) {
        callback?.({ ok: false, error: 'Only the host can start the game' });
        return;
      }

      room.status = 'playing';
      // Only set turn in classic mode
      room.currentTurnClientId = room.gameMode === 'classic' ? (room.players[0]?.clientId || clientId) : null;
      room.flippedIndices = [];
      room.locked = false;
      room.board = createBoard(room.theme, room.difficulty);
      room.players.forEach((player) => {
        player.score = 0;
      });
      await room.save();
      socket.join(room.roomId);
      callback?.({ ok: true, room: buildPublicRoom(room.toObject()) });
      await broadcastRoom(room.roomId);
      
      const startMsg = room.gameMode === 'time-attack' 
        ? "Time Attack started! Find all matches as fast as possible!" 
        : `Game started! It's ${room.players[0].username}'s turn`;
      broadcastSystemMessage(room.roomId, startMsg);
    } catch (error) {
      callback?.({ ok: false, error: error.message });
    }
  });

  socket.on('game:flip', async ({ roomId, clientId, index }, callback) => {
    try {
      const room = await Room.findOne({ roomId: String(roomId || '').trim().toUpperCase() });
      if (!room || room.status !== 'playing') {
        callback?.({ ok: false, error: 'Room is not active' });
        return;
      }

      const player = room.players.find((item) => item.clientId === clientId);
      if (!player || !player.connected) {
        callback?.({ ok: false, error: 'Player is not in this room' });
        return;
      }

      // Only check turn in classic mode
      if (room.gameMode === 'classic' && room.currentTurnClientId !== clientId) {
        callback?.({ ok: false, error: 'Not your turn' });
        return;
      }

      if (room.locked || room.flippedIndices.includes(index)) {
        callback?.({ ok: false, error: 'Move not allowed' });
        return;
      }

      const card = room.board[index];
      if (!card || card.matched || card.revealed) {
        callback?.({ ok: false, error: 'Invalid card' });
        return;
      }

      card.revealed = true;
      room.flippedIndices.push(index);
      room.locked = room.flippedIndices.length === 2;
      await room.save();
      await broadcastRoom(room.roomId);
      callback?.({ ok: true });

      if (room.flippedIndices.length === 2) {
        setTimeout(async () => {
          const latestRoom = await Room.findOne({ roomId: room.roomId });
          if (!latestRoom || latestRoom.status !== 'playing') return;

          const [firstIndex, secondIndex] = latestRoom.flippedIndices;
          const firstCard = latestRoom.board[firstIndex];
          const secondCard = latestRoom.board[secondIndex];
          const currentPlayer = latestRoom.players.find((item) => item.clientId === clientId);

          if (firstCard && secondCard && firstCard.value === secondCard.value) {
            firstCard.matched = true;
            secondCard.matched = true;
            if (currentPlayer) {
              currentPlayer.score += 1;
              broadcastSystemMessage(latestRoom.roomId, `${currentPlayer.username} found a match!`);
            }
          } else {
            if (firstCard) firstCard.revealed = false;
            if (secondCard) secondCard.revealed = false;
            
            if (latestRoom.gameMode === 'classic') {
              setNextTurn(latestRoom);
              const nextPlayer = latestRoom.players.find(p => p.clientId === latestRoom.currentTurnClientId);
              if (nextPlayer) {
                  broadcastSystemMessage(latestRoom.roomId, `No match! It's now ${nextPlayer.username}'s turn`);
              }
            }
          }

          latestRoom.flippedIndices = [];
          latestRoom.locked = false;
          await latestRoom.save();
          await finishRoomIfNeeded(latestRoom);
          await broadcastRoom(latestRoom.roomId);
        }, 700);
      }
    } catch (error) {
      callback?.({ ok: false, error: error.message });
    }
  });

  socket.on('room:leave', async ({ roomId, clientId }) => {
    try {
      await handlePlayerLeave(roomId, clientId);
      socket.leave(roomId);
      if (socket.roomId === roomId) {
        socket.roomId = null;
      }
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  });

  socket.on('disconnect', async () => {
    if (socket.roomId && socket.clientId) {
      await handlePlayerLeave(socket.roomId, socket.clientId);
    }
  });
});