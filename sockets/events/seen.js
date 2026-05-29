const MessageReadStatus = require("../../models/Chat/MessageReadStatus");

function seenEvents(io, socket) {
  socket.on("message_seen", async (data) => {
    try {
      const { messageId, chatId } = data;
      if (!messageId || !socket.userId) return;

      await MessageReadStatus.update(
        { status: 'seen' },
        {
          where: {
            messageId,
            userId: socket.userId,
          },
        }
      );

      io.to(chatId).emit("message_seen", {
        messageId,
        userId: socket.userId,
      });
    } catch (err) {
      console.error("message_seen error:", err.message);
    }
  });

  socket.on("message_delivered", async (data) => {
    try {
      const { messageId, chatId } = data;
      if (!messageId || !socket.userId) return;

      await MessageReadStatus.update(
        { status: 'delivered' },
        {
          where: {
            messageId,
            userId: socket.userId,
          },
        }
      );

      io.to(chatId).emit("message_delivered", {
        messageId,
        userId: socket.userId,
      });
    } catch (err) {
      console.error("message_delivered error:", err.message);
    }
  });
}

module.exports = seenEvents;
