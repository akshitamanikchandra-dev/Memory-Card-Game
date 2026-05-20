const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema(
  {
    clientId: { type: String, required: true },
    username: { type: String, required: true },
    avatar: { type: String, required: true },
    score: { type: Number, default: 0 },
    connected: { type: Boolean, default: true }
  },
  { _id: false }
);

const cardSchema = new mongoose.Schema(
  {
    value: { type: String, required: true },
    revealed: { type: Boolean, default: false },
    matched: { type: Boolean, default: false }
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true },
    hostClientId: { type: String, required: true },
    status: { type: String, enum: ['lobby', 'playing', 'finished'], default: 'lobby' },
    difficulty: { type: String, required: true },
    theme: { type: String, required: true },
    board: { type: [cardSchema], default: [] },
    players: { type: [playerSchema], default: [] },
    currentTurnClientId: { type: String, default: null },
    flippedIndices: { type: [Number], default: [] },
    winnerClientIds: { type: [String], default: [] },
    locked: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Room', roomSchema);