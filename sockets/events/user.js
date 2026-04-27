function userEvents(io, socket) {
  socket.on("join_chat", (data) => {
    try {
      const { chatId } = data;
      if (!chatId) return;

      socket.join(chatId);
      console.log(`User ${socket.userId} joined chat ${chatId}`);

      // Notify others that user joined
      socket.to(chatId).emit("user_joined", {
        userId: socket.userId,
        chatId,
      });
    } catch (err) {
      console.error("join_chat error:", err.message);
    }
  });

  socket.on("leave_chat", (data) => {
    try {
      const { chatId } = data;
      if (!chatId) return;

      socket.leave(chatId);
      console.log(`User ${socket.userId} left chat ${chatId}`);

      // Notify others that user left
      socket.to(chatId).emit("user_left", {
        userId: socket.userId,
        chatId,
      });
    } catch (err) {
      console.error("leave_chat error:", err.message);
    }
  });
}

module.exports = userEvents;
