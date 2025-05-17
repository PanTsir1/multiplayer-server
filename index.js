const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

let waitingPlayer = null;

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (username) => {
    socket.username = username;

    if (waitingPlayer) {
      const room = `room-${waitingPlayer.id}-${socket.id}`;
      socket.join(room);
      waitingPlayer.join(room);

      // Send both usernames
      waitingPlayer.emit('init', { color: 'white', opponent: username });
      socket.emit('init', { color: 'black', opponent: waitingPlayer.username });

      waitingPlayer.room = room;
      socket.room = room;

      console.log(`Players paired in room: ${room}`);

      waitingPlayer = null;
    } else {
      waitingPlayer = socket;
    }
  });

  socket.on('move', (move) => {
    const room = socket.room;
    if (room) {
      socket.to(room).emit('move', move);
    }
  });

  socket.on('resign', (color) => {
    io.to(socket.room).emit('resign', color);
  });

  socket.on('drawRequest', () => {
    socket.to(socket.room).emit('drawRequest');
  });

  socket.on('drawAccepted', () => {
    io.to(socket.room).emit('drawAccepted');
  });

  socket.on('rematchRequest', () => {
    socket.to(socket.room).emit('rematchRequest');
  });

  socket.on('rematchAccepted', () => {
    io.to(socket.room).emit('rematchAccepted');
  });

  socket.on('disconnect', () => {
    if (waitingPlayer === socket) {
      waitingPlayer = null;
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
