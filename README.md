# Multiplayer Memory Card Game

A real-time multiplayer Memory Card game featuring customizable avatars, themes, difficulty levels, and a Skribbl-like UI layout with integrated live chat and system notifications.

---

## Features

- **Real-Time Multiplayer**: Host or join game rooms using unique Room IDs, powered by Socket.io.
- **Custom Profiles**: Enter your name and choose from a set of fun avatars (DiceBear adventurer, bot, and fun-emoji styles).
- **Match Settings**:
  - **Difficulty Levels**: Easy (4x4), Medium (4x5), and Hard (5x6) grids.
  - **Themes**: Emojis, Animals, Fruits, and Objects.
- **Interactive Gameplay**:
  - Grid auto-adjusts layout dynamically based on difficulty.
  - Flip card animations.
  - Real-time scoring, turn tracking, move counting, and timer.
- **Integrated Chat & Presence**:
  - Text chat in the lobby and during active gameplay.
  - Automatic system notifications in chat when players join, leave, or score a match.
- **Smart Disconnection Handling**:
  - Removing a player from the game update broadcasts when they close their tab or leave.
  - Automatic host transition when the host leaves.
  - Default victory declaration if only one player remains in an active match.

---

## Project Structure

```
├── backend/
│   ├── models/
│   │   ├── Room.js         # Mongoose schema for game rooms
│   │   └── User.js         # Mongoose schema for client users
│   ├── .env.example        # Environment variable configuration template
│   ├── package.json        # Node.js backend configuration and scripts
│   └── server.js           # Express app, Socket.io handlers, & DB connection
├── frontend/
│   ├── index.html          # Main HTML entry and structural panels
│   ├── script.js           # Client-side Socket.io and game UI controllers
│   └── style.css           # Vanilla CSS layout, themes, & animations
└── README.md
```

---

## Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+), Socket.io Client.
- **Backend**: Node.js, Express, Socket.io Server, MongoDB, Mongoose.

---

## Setup & Running Locally

### Prerequisites
- Node.js installed.
- A running MongoDB instance (local or MongoDB Atlas connection URI).

### Steps

1. **Clone the Repository** and navigate to the project directory.

2. **Configure Environment Variables**:
   Navigate to the `backend/` folder and create a `.env` file from the example:
   ```bash
   cd backend
   cp .env.example .env
   ```
   Provide your MongoDB Connection URI and custom Port:
   ```env
   MONGODB_URI=your-mongodb-connection-string
   PORT=3000
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Start the Server**:
   Run the development script:
   ```bash
   npm run dev
   ```

5. **Play the Game**:
   Open your browser and go to: `http://localhost:3000`
