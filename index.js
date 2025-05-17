const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" } // allow requests from your domain
});

const PORT = process.env.PORT || 3000;

// Simple room handling
const games = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinGame', (roomId) => {
    socket.join(roomId);
    const numClients = io.sockets.adapter.rooms.get(roomId)?.size || 0;

    if (numClients === 1) {
      socket.emit('playerType', 'white');
    } else if (numClients === 2) {
      socket.emit('playerType', 'black');
      io.to(roomId).emit('startGame');
    } else {
      socket.emit('spectator');
    }
  });

  socket.on('move', ({ roomId, move }) => {
    socket.to(roomId).emit('move', move);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
