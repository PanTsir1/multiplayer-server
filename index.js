const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const queues = {}; // Matchmaking queues by time control

io.on('connection', (socket) => {
  socket.on('register', (username) => {
    socket.data.username = username;
  });

  socket.on('startGame', ({ time, increment }) => {
    const key = `${time}+${increment}`;
    if (!queues[key]) queues[key] = [];
    queues[key].push(socket);

    if (queues[key].length >= 2) {
      const player1 = queues[key].shift();
      const player2 = queues[key].shift();

      const room = `room-${player1.id}-${player2.id}`;
      player1.join(room);
      player2.join(room);

      const [whiteSocket, blackSocket] = Math.random() < 0.5
        ? [player1, player2]
        : [player2, player1];

      whiteSocket.emit('init', {
        color: 'white',
        opponent: blackSocket.data.username || 'Opponent',
        room
      });

      blackSocket.emit('init', {
        color: 'black',
        opponent: whiteSocket.data.username || 'Opponent',
        room
      });

      whiteSocket.room = room;
      blackSocket.room = room;

      whiteSocket.opponent = blackSocket;
      blackSocket.opponent = whiteSocket;
    } else {
      socket.emit('waitingForOpponent');
    }
  });

  socket.on('move', (move) => {
    if (socket.room) {
      socket.to(socket.room).emit('move', move);
    }
  });

  socket.on('resign', () => {
    if (socket.room) {
      io.to(socket.room).emit('resigned');
    }
  });

  socket.on('offerDraw', () => {
    if (socket.room) {
      socket.to(socket.room).emit('drawOffered');
    }
  });

  socket.on('drawAccepted', () => {
    if (socket.room) {
      io.to(socket.room).emit('drawAccepted');
    }
  });

  socket.on('drawDeclined', () => {
    if (socket.room) {
      socket.to(socket.room).emit('drawDeclined');
    }
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
}); // ✅ CLOSES io.on('connection')

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
