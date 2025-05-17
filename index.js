const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let rooms = {};

io.on('connection', (socket) => {
  console.log('New user connected');

  socket.on('joinGame', () => {
    let room = findOrCreateRoom();
    socket.join(room);
    socket.emit('joinedRoom', room);

    if (rooms[room].length === 2) {
      io.to(room).emit('startGame', { color: 'white' }); // white always starts
    }
  });

  socket.on('move', ({ room, move }) => {
    socket.to(room).emit('opponentMove', move);
  });

  socket.on('disconnecting', () => {
    const roomsLeft = Array.from(socket.rooms).filter(r => r !== socket.id);
    roomsLeft.forEach(room => {
      rooms[room] = rooms[room]?.filter(id => id !== socket.id);
      if (rooms[room]?.length === 0) delete rooms[room];
    });
  });
});

function findOrCreateRoom() {
  for (const room in rooms) {
    if (rooms[room].length === 1) {
      rooms[room].push(socket.id);
      return room;
    }
  }
  const roomId = `room-${Math.random().toString(36).substr(2, 9)}`;
  rooms[roomId] = [socket.id];
  return roomId;
}

server.listen(process.env.PORT || 3000, () => {
  console.log('Server running');
});
