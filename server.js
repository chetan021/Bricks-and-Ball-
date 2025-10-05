const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve the HTML/JS/CSS from the public folder
app.use(express.static(path.join(__dirname, "public")));

const rooms = {};

io.on("connection", socket => {
  console.log("Client connected:", socket.id);

  socket.on("createRoom", ({ roomId, maxPlayers }) => {
    if (rooms[roomId]) {
      socket.emit("error", "Room already exists");
      return;
    }
    rooms[roomId] = {
      players: [{ id: socket.id, color: "red" }],
      maxPlayers
    };
    socket.join(roomId);
    socket.emit("roomCreated", { roomId, color: "red" });
  });

  socket.on("joinRoom", roomId => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit("error", "Room not found");
      return;
    }

    if (room.players.length >= room.maxPlayers) {
      socket.emit("error", "Room is full");
      return;
    }

    const colors = ["red", "blue", "yellow", "green"];
    const color = colors[room.players.length];

    room.players.push({ id: socket.id, color });
    socket.join(roomId);
    socket.emit("roomJoined", { roomId, color });
    io.to(roomId).emit("playerJoined", {
      players: room.players.map(p => p.color)
    });

    if (room.players.length === room.maxPlayers) {
      io.to(roomId).emit("startGame", {
        players: room.players.map(p => p.color)
      });
    }
  });

  socket.on("rollDice", ({ roomId, color }) => {
    const value = Math.floor(Math.random() * 6) + 1;
    io.to(roomId).emit("diceRolled", { value, color });
  });

  socket.on("tokenMoved", ({ roomId, index, color, tokenData }) => {
    io.to(roomId).emit("tokenMoved", { index, color, tokenData });
  });
  

  socket.on("disconnect", () => {
    for (let roomId in rooms) {
      const room = rooms[roomId];
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) {
        delete rooms[roomId];
      } else {
        io.to(roomId).emit("playerLeft", socket.id);
      }
    }
  });
});

server.listen(3000, () => {
  console.log("Server listening at http://localhost:3000");
});
