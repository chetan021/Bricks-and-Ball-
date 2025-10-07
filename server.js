const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files (HTML, JS, CSS) from "public" directory
app.use(express.static(path.join(__dirname, "public")));

// In-memory store for rooms
const rooms = {};
const colors = ["red", "blue", "yellow", "green"]; // Available player colors

io.on("connection", socket => {
  console.log("Client connected:", socket.id);

  // 🟢 CREATE ROOM
  socket.on("createRoom", ({ roomId, maxPlayers }) => {
    // Validation
    if (typeof roomId !== "string" || roomId.length > 20) {
      socket.emit("error", "Invalid room ID");
      return;
    }

    if (typeof maxPlayers !== "number" || maxPlayers < 2 || maxPlayers > colors.length) {
      socket.emit("error", "Invalid maxPlayers (2–4)");
      return;
    }
    console.log(rooms,"Rooms");

    if (rooms[roomId]) {
      socket.emit("error", "Room already exists");
      return;
    }

    // Create new room
    rooms[roomId] = {
      players: [{ id: socket.id, color: colors[0] }],
      maxPlayers
    };

    socket.join(roomId);
    socket.emit("roomCreated", { roomId, color: colors[0] });
    console.log(`Room created: ${roomId} by ${socket.id}`);
  });

  // 🟡 JOIN ROOM
  socket.on("joinRoom", roomId => {
    const room = rooms[roomId];

    // Validate room
    if (!room) {
      socket.emit("error", "Room not found");
      return;
    }

    if (room.players.length >= room.maxPlayers) {
      socket.emit("error", "Room is full");
      return;
    }

    const color = colors[room.players.length];
    if (!color) {
      socket.emit("error", "Not enough colors defined");
      return;
    }

    // Add player to room
    room.players.push({ id: socket.id, color });
    socket.join(roomId);
    socket.emit("roomJoined", { roomId, color });

    // Notify all players
    io.to(roomId).emit("playerJoined", {
      players: room.players.map(p => p.color)
    });

    console.log(`Player joined room ${roomId}: ${socket.id} as ${color}`);

    // Start game if full
    if (room.players.length === room.maxPlayers) {
      io.to(roomId).emit("startGame", {
        players: room.players.map(p => p.color)
      });
      console.log(`Game started in room ${roomId}`);
    }
  });

  // 🎲 DICE ROLL
  socket.on("rollDice", ({ roomId, color }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.color !== color) return;

    const value = Math.floor(Math.random() * 6) + 1;
    io.to(roomId).emit("diceRolled", { value, color });
    console.log(`Dice rolled in ${roomId}: ${color} rolled ${value}`);
  });

  socket.on("tokenReset", ({ roomId, color, index, tokenData }) => {
  const room = rooms[roomId];
  if (!room) return;

  // Broadcast to all clients in the room
  io.to(roomId).emit("tokenReset", { color, index, tokenData });
  console.log(`Token of ${color} reset after collision in room ${roomId}`);
});

  // 🎯 TOKEN MOVE
  socket.on("tokenMoved", ({ roomId, index, color, tokenData }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.color !== color) return;

    io.to(roomId).emit("tokenMoved", { index, color, tokenData });
    console.log(`Token moved in ${roomId} by ${color}`);
  });

  // ❌ DISCONNECT
  socket.on("disconnect", () => {
    for (let roomId in rooms) {
      const room = rooms[roomId];
      const index = room.players.findIndex(p => p.id === socket.id);

      if (index !== -1) {
        const [removedPlayer] = room.players.splice(index, 1);
        console.log(`Player ${removedPlayer.color} left room ${roomId}`);

        // Notify other players
        io.to(roomId).emit("playerLeft", removedPlayer.color);

        // Delete room if empty
        if (room.players.length === 0) {
          delete rooms[roomId];
          console.log(`Room ${roomId} deleted (empty)`);
        }
        break;
      }
    }
  });
});

// 🔊 Start server
server.listen(3000, () => {
  console.log("Server listening at http://localhost:3000");
});
