const Message = require("../../models/Message");
const Chat = require("../../models/Chat");
const ChatMember = require("../../models/ChatMember");
const MessageReadStatus = require("../../models/MessageReadStatus");

function messageEvents(io, socket) {
  socket.on("send_message", async (data) => {
    try {
      if (!socket.userId) {
        console.error(
          "send_message error: socket.userId is undefined. Cannot send message.",
          { socketId: socket.id, socketData: socket.data }
        );
        return;
      }

      const { chatId, content, type, replyToId } = data;
      if (!chatId || !content || !type) {
        console.error("send_message error: Missing data fields.", data);
        return;
      }

      console.log(`User ${socket.userId} sending message to chat ${chatId}`);

      const chat = await Chat.findByPk(chatId);
      if (!chat) {
        console.error("send_message error: Chat not found.");
        return;
      }

      const chatMembers = await ChatMember.findAll({
        where: { chatId },
        attributes: ['userId'],
      });

      const unreadByIds = chatMembers
        .map(m => m.userId)
        .filter(id => id !== socket.userId);

      const message = await Message.create({
        chatId,
        senderId: socket.userId,
        content,
        type,
        replyToId: replyToId || null,
      });

      // Initialize read status for all members
      for (const member of chatMembers) {
        await MessageReadStatus.create({
          messageId: message.id,
          userId: member.userId,
          status: member.userId === socket.userId ? 'sent' : 'sent',
        });
      }

      // Update chat's latest message
      await chat.update({ latestMessageId: message.id });

      const fullMessage = await Message.findByPk(message.id, {
        include: [{
          model: Message,
          as: 'replyTo',
          attributes: ['id', 'content', 'senderId', 'type'],
        }],
      });

      io.to(chatId).emit("receive_message", fullMessage);
    } catch (err) {
      console.error("send_message socket error:", err.message);
    }
  });

  socket.on("edit_message", async ({ messageId, newContent }) => {
    try {
      const message = await Message.findByPk(messageId);
      if (!message || message.senderId !== socket.userId) return;

      await message.update({
        content: newContent,
        isEdited: true,
      });

      io.to(message.chatId.toString()).emit("edit_message", message);
    } catch (err) {
      console.error("edit_message error:", err.message);
    }
  });

  socket.on("delete_message", async (messageId) => {
    try {
      const message = await Message.findByPk(messageId);
      if (!message || message.senderId !== socket.userId) return;

      const chatId = message.chatId;
      await Message.destroy({
        where: { id: messageId },
      });

      io.to(chatId.toString()).emit("delete_message", messageId);
    } catch (err) {
      console.error("delete_message error:", err.message);
    }
  });
}

module.exports = messageEvents;
