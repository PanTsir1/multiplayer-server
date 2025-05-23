// Import required modules
const express = require('express'); // Web framework to create HTTP server
const http = require('http'); // Built-in Node.js HTTP module
const { Server } = require('socket.io'); // Socket.IO for real-time communication

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Create Socket.IO server and allow CORS from any origin
// ✅ Use only this CORS-enabled Socket.IO server creation
const io = new Server(server, {
  cors: {
    origin: "https://chessfantazy.com",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// ✅ Generates a unique 6-digit room ID
function generateRoomId() {
  return Math.random().toString(36).substr(2, 6);
}

// Store matchmaking queues grouped by time control (e.g., "5+0", "3+2")
const queues = {};
let waitingPlayer = null; // ✅ Required to hold a single waiting player
let games = {}; // ✅ Also required to store live games by room ID

// Listen for new client connections
io.on('connection', (socket) => {

  // Save player's username when they register
  socket.on('register', (username) => {
    socket.data.username = username;
  });
  
  // ✅ Matchmaking and game setup with selected time control
socket.on('startGame', ({ time, increment }) => {
  if (!waitingPlayer) {
    waitingPlayer = { socket, time, increment };
    return;
  }

  const room = generateRoomId();
  const playerWhite = Math.random() < 0.5 ? socket : waitingPlayer.socket;
  const playerBlack = playerWhite === socket ? waitingPlayer.socket : socket;

  playerWhite.join(room);
  playerWhite.room = room;
  playerBlack.room = room;
  playerBlack.join(room);

  // Store game state
  games[room] = {
    players: {
      white: playerWhite.data.username,
      black: playerBlack.data.username
    },

    sockets: {
      white: playerWhite,
      black: playerBlack
    },
    time: {
      white: time,
      black: time
    },
    increment,
    currentTurn: 'white',
    lastMoveTimestamp: Date.now(),
    room
  };

  // Notify players
  playerWhite.emit('init', {
    color: 'white',
    opponent: playerBlack.data.username,
    whiteTime: time,
    blackTime: time,
    increment,
    currentTurn: 'white'
  });
  playerBlack.emit('init', {
    color: 'black',
    opponent: playerWhite.data.username,
    whiteTime: time,
    blackTime: time,
    increment,
    currentTurn: 'white'
  });

  waitingPlayer = null;
});
  // Handle chatMessage Events
  socket.on('chatMessage', ({ username, message }) => {
  const color = socket.data.color; // store color when assigning it during game start
  const room = socket.data.room;
  if (room) {
    io.to(room).emit('chatMessage', { username, message });
  }
});
  // ✅ Handle a move, update clock, and sync both clients
socket.on('move', ({ move, fen }) => {
  const room = socket.room;
  if (!room || !games[room]) return;

  const game = games[room];
  const now = Date.now();
  const color = game.currentTurn;

  // Calculate time spent
  const elapsed = Math.floor((now - game.lastMoveTimestamp) / 1000);
  game.time[color] -= elapsed;
  if (game.time[color] < 0) game.time[color] = 0;

  // Apply increment
  game.time[color] += game.increment;

  // Switch turn
  game.currentTurn = color === 'white' ? 'black' : 'white';
  game.lastMoveTimestamp = now;

  // Broadcast move and times
  io.to(room).emit('move', {
    move,
    fen, // use extracted fen
    whiteTime: game.time.white,
    blackTime: game.time.black,
    currentTurn: game.currentTurn
  });
});

  // Player resigns - notify both players
  socket.on('resign', () => {
    if (socket.room) {
      io.to(socket.room).emit('resigned');
    }
  });

  // Player offers a draw - notify opponent only
  socket.on('offerDraw', () => {
    if (socket.room) {
      socket.to(socket.room).emit('drawOffered');
    }
  });

  // Draw is accepted - notify both players
  socket.on('drawAccepted', () => {
    if (socket.room) {
      io.to(socket.room).emit('drawAccepted');
    }
  });

  // Draw is declined - notify opponent only
  socket.on('drawDeclined', () => {
    if (socket.room) {
      socket.to(socket.room).emit('drawDeclined');
    }
  });

  // Clean up when a player disconnects
  socket.on('disconnect', () => {
    // Remove player from all queues
    for (const key in queues) {
      queues[key] = queues[key].filter(s => s !== socket);
    }

    // Notify opponent if player was in a game
    if (socket.opponent) {
      socket.opponent.emit('opponentDisconnected');
      socket.opponent.opponent = null;
    }
  });
});

// Start the server on the environment port or default to 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
