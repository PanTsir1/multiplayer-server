// Import required modules
const express = require('express'); // Web framework to create HTTP server
const http = require('http'); // Built-in Node.js HTTP module
const { Server } = require('socket.io'); // Socket.IO for real-time communication

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Create Socket.IO server and allow CORS from any origin
// ✅ Use only this CORS-enabled Socket.IO server creation
const { Server } = require("socket.io");
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

// Listen for new client connections
io.on('connection', (socket) => {

  // Save player's username when they register
  socket.on('register', (username) => {
    socket.data.username = username;
  });

  // When a player wants to start a game with a selected time control
  //socket.on('startGame', ({ time, increment }) => {
    //const key = `${time}+${increment}`; // Create a unique key for this time control

    // Initialize queue if it doesn't exist and add player to the queue
    //if (!queues[key]) queues[key] = [];
    //queues[key].push(socket);

    // If at least two players are available, match them
    //if (queues[key].length >= 2) {
      //const player1 = queues[key].shift(); // Get first player
      //const player2 = queues[key].shift(); // Get second player

      // Create a unique room for both players
      //const room = `room-${player1.id}-${player2.id}`;
      //player1.join(room);
      //player2.join(room);

      // Randomly assign colors to players
      //const [whiteSocket, blackSocket] = Math.random() < 0.5
        //? [player1, player2]
        //: [player2, player1];

      // Notify white player
      //whiteSocket.emit('init', {
        //color: 'white',
        //opponent: blackSocket.data.username || 'Opponent',
        //room
      //});

      // Notify black player
      //blackSocket.emit('init', {
        //color: 'black',
        //opponent: whiteSocket.data.username || 'Opponent',
        //room
      //});

      // Save room and opponent info for both sockets
      //whiteSocket.room = room;
      //blackSocket.room = room;
      //whiteSocket.opponent = blackSocket;
      //blackSocket.opponent = whiteSocket;

    //} else {
      // If no opponent yet, notify player to wait
      //socket.emit('waitingForOpponent');
    //}
  //});
  // ✅ Initializes a new game when two players are matched with chosen time control
//socket.on('startGame', ({ time, increment }) => {
  // Store player in queue until a match is found
  //if (!waitingPlayer) {
    //waitingPlayer = { socket, time, increment };
    //return;
  //}

  //const room = generateRoomId();
  //const playerWhite = Math.random() < 0.5 ? socket : waitingPlayer.socket;
  //const playerBlack = playerWhite === socket ? waitingPlayer.socket : socket;

  // Join both players to the same room
  //playerWhite.join(room);
  //playerBlack.join(room);

  // Initialize game state
  //games[room] = {
    //players: {
      //white: playerWhite.username,
      //black: playerBlack.username
    //},
    //sockets: {
      //white: playerWhite,
      //black: playerBlack
    //},
    //time: {
      //white: time,
      //black: time
    //},
    //increment,
    //currentTurn: 'white',
    //lastMoveTimestamp: Date.now(),
    //room
  //};

  // Inform both players
  //playerWhite.emit('init', {
    //color: 'white',
    //opponent: playerBlack.username,
    //whiteTime: time,
    //blackTime: time,
    //increment,
    //currentTurn: 'white'
  //});
  //playerBlack.emit('init', {
    //color: 'black',
    //opponent: playerWhite.username,
    //whiteTime: time,
    //blackTime: time,
    //increment,
    //currentTurn: 'white'
  //});

  //waitingPlayer = null;
//});
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
  playerBlack.join(room);

  // Store game state
  games[room] = {
    players: {
      white: playerWhite.username,
      black: playerBlack.username
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
    opponent: playerBlack.username,
    whiteTime: time,
    blackTime: time,
    increment,
    currentTurn: 'white'
  });
  playerBlack.emit('init', {
    color: 'black',
    opponent: playerWhite.username,
    whiteTime: time,
    blackTime: time,
    increment,
    currentTurn: 'white'
  });

  waitingPlayer = null;
});

  // Relay chess moves to the opponent
  //socket.on('move', (move) => {
    //if (socket.room) {
      //socket.to(socket.room).emit('move', move);
    //}
  //});
  // ✅ Handle a move, update clock, and sync both clients
socket.on('move', ({ move }) => {
  const room = Array.from(socket.rooms).find(r => r !== socket.id);
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
    fen: move.fen, // optional if needed
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
