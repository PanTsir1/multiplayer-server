const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

let gameState = {
  fen: 'start',
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.emit('init', gameState.fen);

  socket.on('move', (fen) => {
    gameState.fen = fen;
    socket.broadcast.emit('move', fen);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
