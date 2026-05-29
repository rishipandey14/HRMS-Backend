function typingEvents(io, socket) {
  socket.on("typing", (data) => {
    try {
      const { chatId } = data;
      if (!chatId || !socket.userId) return;

      io.to(chatId).emit("user_typing", {
        userId: socket.userId,
        chatId,
      });
    } catch (err) {
      console.error("typing error:", err.message);
    }
  });

  socket.on("stop_typing", (data) => {
    try {
      const { chatId } = data;
      if (!chatId || !socket.userId) return;

      io.to(chatId).emit("user_stop_typing", {
        userId: socket.userId,
        chatId,
      });
    } catch (err) {
      console.error("stop_typing error:", err.message);
    }
  });
}

module.exports = typingEvents;
