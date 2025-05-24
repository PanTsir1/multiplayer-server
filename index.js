const chatHistory = {}; // Stores chat messages by room ID
const disconnectTimers = {}; // Track disconnect timers by room and color

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
let games = {}; // ✅ Also required to store live games by room ID

// Listen for new client connections
io.on('connection', (socket) => {

  // Save player's username when they register
socket.on('register', (username) => {
  socket.data.username = username;

  // Look for a game with this player
  for (const roomId in games) {
    const game = games[roomId];
    const { white, black } = game.players;

    if (white === username || black === username) {
      // Rebind socket
      const color = white === username ? 'white' : 'black';
      game.sockets[color] = socket;
      socket.data.room = roomId;
      socket.data.color = color;

      // Send current game state
      socket.emit('init', {
        color,
        opponent: game.players[color === 'white' ? 'black' : 'white'],
        whiteTime: game.time.white,
        blackTime: game.time.black,
        increment: game.increment,
        currentTurn: game.currentTurn
      });

      // Send chat history if any
      if (chatHistory[roomId]) {
        socket.emit('chatHistory', chatHistory[roomId]);
      }
      const opponentSocket = game.sockets[color === 'white' ? 'black' : 'white'];
      if (opponentSocket) {
        opponentSocket.emit('chatMessage', {
          username: 'System',
          message: `${username} reconnected.`,
          timestamp: new Date().toISOString()
      });
    }
      if (disconnectTimers[roomId] && disconnectTimers[roomId][color]) {
        clearTimeout(disconnectTimers[roomId][color]);
        delete disconnectTimers[roomId][color];
      }
      return;
    }
  }
});
  
  // ✅ Matchmaking and game setup with selected time control
socket.on('startGame', ({ time, increment }) => {
  const key = `${time}+${increment}`;

  if (!queues[key]) queues[key] = [];

  // Add player to queue
  queues[key].push(socket);

  // If there are 2 players, start a game
  if (queues[key].length >= 2) {
    const player1 = queues[key].shift();
    const player2 = queues[key].shift();

    const room = generateRoomId();
    const whiteSocket = Math.random() < 0.5 ? player1 : player2;
    const blackSocket = whiteSocket === player1 ? player2 : player1;

    whiteSocket.join(room);
    blackSocket.join(room);

    whiteSocket.data.color = 'white';
    blackSocket.data.color = 'black';
    whiteSocket.data.room = room;
    blackSocket.data.room = room;

    const whiteTime = time;
    const blackTime = time;

    // Save game
    games[room] = {
      players: {
        white: whiteSocket.data.username,
        black: blackSocket.data.username
      },
      sockets: {
        white: whiteSocket,
        black: blackSocket
      },
      time: {
        white: whiteTime,
        black: blackTime
      },
      increment,
      currentTurn: 'white',
      lastMoveTimestamp: Date.now(),
      room
    };

    // Send game info
    whiteSocket.emit('init', {
      color: 'white',
      opponent: blackSocket.data.username,
      whiteTime,
      blackTime,
      increment,
      currentTurn: 'white'
    });

    blackSocket.emit('init', {
      color: 'black',
      opponent: whiteSocket.data.username,
      whiteTime,
      blackTime,
      increment,
      currentTurn: 'white'
    });

    // Send chat history
    if (!chatHistory[room]) chatHistory[room] = [];
    whiteSocket.emit('chatHistory', chatHistory[room]);
    blackSocket.emit('chatHistory', chatHistory[room]);
  }
});

// ✅ Add this inside your socket.on('connection') block:
socket.on('chatMessage', ({ username, message }) => {
  const room = socket.data.room;
  if (!room) return;

  const timestamp = new Date().toISOString();

  // Store message in memory
  if (!chatHistory[room]) chatHistory[room] = [];
  chatHistory[room].push({ username, message, timestamp });

  // Emit message to all in room
  io.to(room).emit('chatMessage', { username, message, timestamp });
});


  // ✅ Handle a move, update clock, and sync both clients
socket.on('move', ({ move, fen }) => {
  const room = socket.data.room;
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
  const room = socket.data.room;
  const color = socket.data.color;

  if (!room || !color || !games[room]) return;
    
    // Remove player from all queues
    for (const key in queues) {
      queues[key] = queues[key].filter(s => s !== socket);
    }
  // Start a timer to auto-resign
  disconnectTimers[room] = disconnectTimers[room] || {};
  disconnectTimers[room][color] = setTimeout(() => {
    if (games[room]) {
      io.to(room).emit('chatMessage', {
        username: 'System',
        message: `${socket.data.username} forfeited due to disconnect.`,
        timestamp: new Date().toISOString()
      });
      io.to(room).emit('resigned'); // trigger resignation on frontend
      delete games[room];           // cleanup game
      delete chatHistory[room];     // optional: clear chat
    }
  }, 80000); // 1 minute 20 seconds
    
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
