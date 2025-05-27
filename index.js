const chatHistory = {}; // Stores chat messages by room ID
const disconnectTimers = {}; // Track disconnect timers by room and color
const { Chess } = require('chess.js'); // npm install chess.js

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
console.log(`🟢 New socket connected: ${socket.id}`);

  // Save player's username when they register
socket.on('register', (username) => {
  console.log("✅ register received:", username);
  console.log(`[REGISTER] ${username} registered with socket ID: ${socket.id}`);
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
      console.log(`[INIT SENT] to ${socket.data.username}, color: ${socket.data.color}`);
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
    console.log("✅ startGame received:", time, increment);
    console.log(`[DEBUG] startGame from: ${socket.data.username}`);


    const key = `${time}+${increment}`;
    socket.data.timeKey = key;
    queues[key] = queues[key] || []; // Initialize the queue if it doesn't exist
    
    console.log(`[DEBUG] Queue size for ${key}: ${queues[key].length}`);
    console.log(`[MATCHMAKING] ${socket.data.username} requested ${key}`);
    console.log(`[MATCHMAKING] Current queue for ${key}: ${queues[key].map(s => s.data.username).join(', ')}`);
    
    queues[key].push(socket);

  
    // Check for match
    if (queues[key].length >= 2) {
      const player1 = queues[key].shift();
      const player2 = queues[key].shift();
  
      const room = generateRoomId();
      const whiteSocket = Math.random() < 0.5 ? player1 : player2;
      const blackSocket = whiteSocket === player1 ? player2 : player1;
  
      whiteSocket.join(room);
      blackSocket.join(room);
      console.log(`[MATCH FOUND] Room: ${room}`);
      console.log(`[ROOM ASSIGN] ${whiteSocket.data.username} is White`);
      console.log(`[ROOM ASSIGN] ${blackSocket.data.username} is Black`);
      console.log(`[ROOM ASSIGN] White socket ID: ${whiteSocket.id}`);
      console.log(`[ROOM ASSIGN] Black socket ID: ${blackSocket.id}`);

      whiteSocket.data.color = 'white';
      blackSocket.data.color = 'black';
      whiteSocket.data.room = room;
      blackSocket.data.room = room;
  
      const whiteTime = time;
      const blackTime = time;
  
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
  
      console.log(`[MATCHMAKING] Game started: ${games[room].players.white} (White) vs ${games[room].players.black} (Black)`);
  
      // Notify both players
      [whiteSocket, blackSocket].forEach(s => {
        console.log(`[INIT SENT] to ${s.data.username}, color: ${s.data.color}, room: ${room}`);
        s.emit('init', {
          color: s.data.color,
          opponent: s === whiteSocket ? blackSocket.data.username : whiteSocket.data.username,
          whiteTime,
          blackTime,
          increment,
          currentTurn: 'white'
        });
        io.to(room).emit('opponentInfo', {
          white: games[room].players.white,
          black: games[room].players.black,
        });
        //socket.on('opponentInfo', ({ white, black }) => {
          //const opponentUsername = (playerColor === 'white') ? black : white;
          //const myName = username;
          //const versusText = `${myName} vs ${opponentUsername} ${selectedTimeControl.base / 60}+${selectedTimeControl.inc} game`;
          //$('#time-box').text(versusText).show();
        //});


        if (!chatHistory[room]) chatHistory[room] = [];
        s.emit('chatHistory', chatHistory[room]);
      });
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
  socket.on('chatMessage', ({ username: from, message }) => {
    $('#chat-box').append(`<div><strong>${from}:</strong> ${message}</div>`);
    $('#chat-box').scrollTop($('#chat-box')[0].scrollHeight);
  });


  // ✅ Handle a move, update clock, and sync both clients
socket.on('move', ({ move, fen }) => {
  console.log(`[MOVE] Received from ${socket.data.username}: ${move?.from} -> ${move?.to}`);
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
// Use chess.js to evaluate ending conditions
const chess = new Chess(fen);

if (chess.isCheckmate()) {
  io.to(room).emit('checkmate', {
    winner: game.players[color === 'white' ? 'white' : 'black']
  });
  clearGame(room);
} else if (chess.isStalemate()) {
  io.to(room).emit('drawAccepted'); // reuse existing client logic
  io.to(room).emit('chatMessage', {
    username: 'System',
    message: `Draw by stalemate.`,
    timestamp: new Date().toISOString()
  });
  clearGame(room);
} else if (chess.isInsufficientMaterial()) {
  io.to(room).emit('drawAccepted');
  io.to(room).emit('chatMessage', {
    username: 'System',
    message: `Draw by insufficient material.`,
    timestamp: new Date().toISOString()
  });
  clearGame(room);
} else {
  // Regular move broadcast
  io.to(room).emit('move', {
    move,
    fen,
    whiteTime: game.time.white,
    blackTime: game.time.black,
    currentTurn: game.currentTurn
  });
}


});

  // Player resigns - notify both players
  socket.on('resign', () => {
    if (socket.room) {
      io.to(socket.room).emit('resigned');
      clearGame(socket.room); // ✅ cleanup
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
    // Remove player from their time control queue
if (socket.data.timeKey && queues[socket.data.timeKey]) {
  queues[socket.data.timeKey] = queues[socket.data.timeKey].filter(s => s !== socket);
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
function clearGame(room) {
  console.log(`[CLEANUP] Game in room ${room} ended and was cleared.`);
  delete games[room];
  delete chatHistory[room];
}
// Start the server on the environment port or default to 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
