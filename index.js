const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

let waitingPlayer = null;
const queues = {};

io.on('connection', (socket) => {
  socket.on('startGame', ({time, increment}) => {
    const key = `${time}+${increment}`;
    if (!queues[key]) queues[key] = [];
    queues[key].push(socket);

    if (queues[key].length >= 2) {
      const player1 = queues[key].shift();
      const player2 = queues[key].shift();

  socket.on('register', (name) => {
    socket.data.username = name;

    if (waitingPlayer) {
      const room = `room-${waitingPlayer.id}-${socket.id}`;
      socket.join(room);
      waitingPlayer.join(room);

      const [whiteSocket, blackSocket] = Math.random() < 0.5 ? [waitingPlayer, socket] : [socket, waitingPlayer];


      whiteSocket.emit('init', { color: 'white', opponent: blackSocket.data.username });
      blackSocket.emit('init', { color: 'black', opponent: whiteSocket.data.username });

      whiteSocket.room = room;
      blackSocket.room = room;

            // Store opponent info on socket for future moves/messages
      player1.opponent = player2;
      player2.opponent = player1;
    } else {
      socket.emit('waitingForOpponent');
    }
  });
      waitingPlayer = null;
    } else {
      waitingPlayer = socket;
    }
  });

  socket.on('move', (move) => {
    if (socket.room) socket.to(socket.room).emit('move', move);
  });

  socket.on('resign', (color) => {
    if (socket.room) io.to(socket.room).emit('resign', color);
  });

  socket.on('drawRequest', () => {
    if (socket.room) socket.to(socket.room).emit('drawRequest');
  });

  socket.on('drawAccepted', () => {
    if (socket.room) io.to(socket.room).emit('drawAccepted');
  });

  socket.on('rematchRequest', () => {
    if (socket.room) socket.to(socket.room).emit('rematchRequest');
  });

  socket.on('rematchAccepted', () => {
    if (socket.room) io.to(socket.room).emit('rematchAccepted');
  });

  socket.on('disconnect', () => {
    for (const key in queues) {
      queues[key] = queues[key].filter(s => s !== socket);
    }
    if (socket.opponent) {
      socket.opponent.emit('opponentDisconnected');
      socket.opponent.opponent = null;
    }
  });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

