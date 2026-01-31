import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const app = express();
app.use(cors());
app.get("/", (_, res) => res.send("muhabbet signaling OK"));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = new Map(); // roomId -> Set(socketId)

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, name }) => {
    socket.data.name = name || "Anon";
    socket.data.roomId = roomId;

    if (!rooms.has(roomId)) rooms.set(roomId, new Set());
    const peers = rooms.get(roomId);

    const existing = Array.from(peers).map((id) => ({
      id,
      name: io.sockets.sockets.get(id)?.data?.name || "User"
    }));
    socket.emit("room-peers", { peers: existing });

    peers.add(socket.id);
    socket.join(roomId);

    socket.to(roomId).emit("peer-joined", { id: socket.id, name: socket.data.name });
  });

  socket.on("webrtc-offer", ({ to, offer }) => {
    io.to(to).emit("webrtc-offer", { from: socket.id, offer, name: socket.data.name });
  });

  socket.on("webrtc-answer", ({ to, answer }) => {
    io.to(to).emit("webrtc-answer", { from: socket.id, answer });
  });

  socket.on("webrtc-ice", ({ to, candidate }) => {
    io.to(to).emit("webrtc-ice", { from: socket.id, candidate });
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (roomId && rooms.has(roomId)) {
      rooms.get(roomId).delete(socket.id);
      socket.to(roomId).emit("peer-left", { id: socket.id });
      if (rooms.get(roomId).size === 0) rooms.delete(roomId);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("muhabbet signaling running on", PORT));
