const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

let waitingPlayer = null;

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  if (waitingPlayer) {
    const room = `room-${waitingPlayer.id}-${socket.id}`;
    socket.join(room);
    waitingPlayer.join(room);

    waitingPlayer.emit('init', 'white');
    socket.emit('init', 'black');

    waitingPlayer.room = room;
    socket.room = room;

    console.log(`Players paired in room: ${room}`);

    waitingPlayer = null;
  } else {
    waitingPlayer = socket;
  }

  socket.on('move', (move) => {
    const room = socket.room;
    if (room) {
      socket.to(room).emit('move', move);
    }
  });
  socket.on('resign', (color) => {
    socket.broadcast.emit('resign', color);
  });
  
  socket.on('drawRequest', () => {
    socket.broadcast.emit('drawRequest');
  });
  
  socket.on('drawAccepted', () => {
    io.emit('drawAccepted');
  });
  
  socket.on('rematch', () => {
    io.emit('rematch');
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

