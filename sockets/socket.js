const { Server } = require("socket.io");
const handleSocketEvents = require("./index");

function setupSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
    },
  });

  handleSocketEvents(io);
  return io;
}

module.exports = { setupSocket };
