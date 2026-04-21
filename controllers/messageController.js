const Message = require("../models/Chat/Message");
const Chat = require("../models/Chat/Chat");
const ChatMember = require("../models/Chat/ChatMember");
const MessageReadStatus = require("../models/Chat/MessageReadStatus");
const { Op } = require("sequelize");

// @desc    Send a new message
// @route   POST /api/messages
const sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    let { chatId, receiverId, content, type, fileUrl, replyToId, forwardedFromId } =
      req.body;

    let chat;

    if (!chatId) {
      if (!receiverId) {
        return res
          .status(400)
          .json({ error: "receiverId is required if chatId is not given" });
      }

      // Find existing direct chat by checking ChatMember entries for both users
      const memberships = await ChatMember.findAll({
        where: { userId: [senderId, receiverId] },
        attributes: ['chatId', 'userId'],
      });

      const chatMemberMap = {};
      for (const m of memberships) {
        const cid = m.chatId;
        if (!chatMemberMap[cid]) chatMemberMap[cid] = new Set();
        chatMemberMap[cid].add(m.userId);
      }

      for (const cid of Object.keys(chatMemberMap)) {
        const set = chatMemberMap[cid];
        if (set.has(senderId) && set.has(receiverId) && set.size === 2) {
          const candidate = await Chat.findByPk(cid);
          if (candidate && candidate.isGroup === false) {
            chat = candidate;
            break;
          }
        }
      }

      // Create new direct chat if doesn't exist
      if (!chat) {
        chat = await Chat.create({
          isGroup: false,
        });

        await ChatMember.create({
          chatId: chat.id,
          userId: senderId,
        });

        await ChatMember.create({
          chatId: chat.id,
          userId: receiverId,
        });
      }

      chatId = chat.id;
    } else {
      chat = await Chat.findByPk(chatId);
      if (!chat) return res.status(404).json({ error: "Chat not found" });
    }

    // Get all chat members to set unread status
    const chatMembers = await ChatMember.findAll({
      where: { chatId },
      attributes: ['userId'],
    });

    const message = await Message.create({
      chatId,
      senderId,
      content,
      type,
      fileUrl,
      replyToId: replyToId || null,
      forwardedFromId: forwardedFromId || null,
    });

    // Initialize read status for all members
    const memberIds = chatMembers.map(m => m.userId);
    for (const memberId of memberIds) {
      await MessageReadStatus.create({
        messageId: message.id,
        userId: memberId,
        status: memberId === senderId ? 'sent' : 'sent',
      });
    }

    // Update chat's latestMessage
    await chat.update({ latestMessageId: message.id });

    // Fetch message with reply relationship
    const fullMessage = await Message.findByPk(message.id, {
      include: [
        {
          model: Message,
          as: 'replyTo',
          attributes: ['id', 'content', 'senderId', 'type'],
        },
      ],
    });

    res.status(201).json(fullMessage);
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Get messages of a Chat by chat ID
// @route   GET /api/messages/:chatId
const getMessagesByChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const messages = await Message.findAll({
      where: { chatId },
      include: [
        {
          model: Message,
          as: 'replyTo',
          attributes: ['id', 'content', 'senderId', 'type'],
        },
      ],
      order: [['createdAt', 'ASC']],
    });

    res.status(200).json(messages);
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Edit a message
// @route   PUT /api/messages/:id
const editMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { newContent } = req.body;

    const message = await Message.findByPk(id);
    if (!message) return res.status(404).json({ error: "Message not found" });

    if (message.senderId !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await message.update({
      content: newContent,
      isEdited: true,
    });

    // Emit socket event if available
    if (req.io) {
      req.io.to(message.chatId.toString()).emit("edit_message", message);
    }

    res.status(200).json(message);
  } catch (err) {
    console.error("Edit message error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Delete a message for everyone (hard delete)
// @route   DELETE /api/messages/:id
const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;

    const message = await Message.findByPk(id);
    if (!message) return res.status(404).json({ error: "Message not found" });

    if (message.senderId !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const chatId = message.chatId;
    await Message.destroy({
      where: { id },
    });

    // Emit socket event if available
    if (req.io) {
      req.io.to(chatId.toString()).emit("delete_message", id);
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Delete message error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// @desc    Mark a message as seen
// @route   PUT /api/messages/:id/seen
const markMessageSeen = async (req, res) => {
  try {
    const messageId = req.params.id;
    const userId = req.user.id;

    const message = await Message.findByPk(messageId);
    if (!message) return res.status(404).json({ error: "Message not found" });

    // Update or create read status
    await MessageReadStatus.findOrCreate({
      where: {
        messageId,
        userId,
      },
      defaults: {
        status: 'seen',
      },
    });

    // Update existing record
    await MessageReadStatus.update(
      { status: 'seen' },
      {
        where: {
          messageId,
          userId,
        },
      }
    );

    res.status(200).json({ message: "Message marked as seen", messageId });
  } catch (err) {
    console.error("markMessageSeen error:", err);
    res.status(500).json({ error: "Failed to mark message as seen" });
  }
};

// @desc    Get unread messages count for a chat
// @route   GET /api/messages/:chatId/unread
const getUnreadCount = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    const unreadCount = await Message.count({
      where: {
        chatId,
        senderId: {
          [Op.ne]: userId,
        },
      },
      include: [
        {
          model: MessageReadStatus,
          where: {
            userId,
            status: {
              [Op.ne]: 'seen',
            },
          },
          required: true,
        },
      ],
    });

    res.status(200).json({ unreadCount });
  } catch (err) {
    console.error("Get unread count error:", err);
    res.status(500).json({ error: "Failed to get unread count" });
  }
};

module.exports = {
  sendMessage,
  getMessagesByChat,
  editMessage,
  deleteMessage,
  markMessageSeen,
  getUnreadCount,
};
