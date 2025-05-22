// Import required modules
const express = require('express'); // Web framework to create HTTP server
const http = require('http'); // Built-in Node.js HTTP module
const { Server } = require('socket.io'); // Socket.IO for real-time communication

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Create Socket.IO server and allow CORS from any origin
const io = new Server(server, {
  cors: { origin: '*' }
});

// Store matchmaking queues grouped by time control (e.g., "5+0", "3+2")
const queues = {};

// Listen for new client connections
io.on('connection', (socket) => {

  // Save player's username when they register
  socket.on('register', (username) => {
    socket.data.username = username;
  });

  // When a player wants to start a game with a selected time control
  socket.on('startGame', ({ time, increment }) => {
    const key = `${time}+${increment}`; // Create a unique key for this time control

    // Initialize queue if it doesn't exist and add player to the queue
    if (!queues[key]) queues[key] = [];
    queues[key].push(socket);

    // If at least two players are available, match them
    if (queues[key].length >= 2) {
      const player1 = queues[key].shift(); // Get first player
      const player2 = queues[key].shift(); // Get second player

      // Create a unique room for both players
      const room = `room-${player1.id}-${player2.id}`;
      player1.join(room);
      player2.join(room);

      // Randomly assign colors to players
      const [whiteSocket, blackSocket] = Math.random() < 0.5
        ? [player1, player2]
        : [player2, player1];

      // Notify white player
      whiteSocket.emit('init', {
        color: 'white',
        opponent: blackSocket.data.username || 'Opponent',
        room
      });

      // Notify black player
      blackSocket.emit('init', {
        color: 'black',
        opponent: whiteSocket.data.username || 'Opponent',
        room
      });

      // Save room and opponent info for both sockets
      whiteSocket.room = room;
      blackSocket.room = room;
      whiteSocket.opponent = blackSocket;
      blackSocket.opponent = whiteSocket;

    } else {
      // If no opponent yet, notify player to wait
      socket.emit('waitingForOpponent');
    }
  });

  // Relay chess moves to the opponent
  socket.on('move', (move) => {
    if (socket.room) {
      socket.to(socket.room).emit('move', move);
    }
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
