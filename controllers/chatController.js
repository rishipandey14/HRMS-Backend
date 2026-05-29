const { sequelize } = require('sequelize');
const Chat = require("../models/Chat/Chat");
const Message = require("../models/Chat/Message");
const MessageReadStatus = require("../models/Chat/MessageReadStatus");
const ChatMember = require("../models/Chat/ChatMember");
const ChatAdmin = require("../models/Chat/ChatAdmin");
const ChatArchived = require("../models/Chat/ChatArchived");
const ChatMuted = require("../models/Chat/ChatMuted");
const PinnedMessage = require("../models/Chat/PinnedMessage");
const User = require("../models/User/User");
const { Op } = require("sequelize");

// @desc    Create new group chat
// @route   POST /api/chats/group
const createGroupChat = async (req, res) => {
  const { members, groupName, groupAvatar } = req.body;
  const creatorId = req.user.id;

  if (!members || !Array.isArray(members) || members.length < 2) {
    return res.status(400).json({
      message: "Group must have at least 2 members excluding creator",
    });
  }

  if (!groupName) {
    return res.status(400).json({ message: "Group name is required" });
  }

  try {
    const uniqueMembers = Array.from(new Set([...members, creatorId]));

    const groupChat = await Chat.create({
      isGroup: true,
      groupName,
      groupAvatar: groupAvatar || null,
      creatorId,
    });

    // Add members
    for (const memberId of uniqueMembers) {
      await ChatMember.create({
        chatId: groupChat.id,
        userId: memberId,
      });
    }

    // Add creator as admin
    await ChatAdmin.create({
      chatId: groupChat.id,
      userId: creatorId,
    });

    res.status(201).json(groupChat);
  } catch (error) {
    console.error("Error creating group chat:", error);
    res.status(500).json({ error: "Failed to create group chat" });
  }
};

// @desc    Create new direct chat
// @route   POST /api/chats
const createDirectChat = async (req, res) => {
  const { members } = req.body;

  if (req.userType === 'company') {
    return res.status(403).json({
      message: 'Company accounts cannot create direct chats. Please login as a user account.',
    });
  }

  if (!members || !Array.isArray(members) || members.length !== 2) {
    return res.status(400).json({ message: "Direct chat must have exactly 2 members" });
  }

  try {
    const normalizedMembers = members.map((id) => Number(id));

    if (normalizedMembers.some((id) => !Number.isInteger(id) || id <= 0)) {
      return res.status(400).json({
        message: "Direct chat members must be valid user IDs",
      });
    }

    if (new Set(normalizedMembers).size !== 2) {
      return res.status(400).json({
        message: "Direct chat must include two different members",
      });
    }

    const existingUsers = await User.findAll({
      where: {
        id: {
          [Op.in]: normalizedMembers,
        },
      },
      attributes: ["id"],
    });

    if (existingUsers.length !== 2) {
      return res.status(400).json({
        message: "One or more members do not exist as users",
      });
    }

    // Check if a direct chat already exists between these two users
    const memberships = await ChatMember.findAll({
      where: { userId: normalizedMembers },
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
      if (set.has(normalizedMembers[0]) && set.has(normalizedMembers[1]) && set.size === 2) {
        const candidate = await Chat.findByPk(cid);
        if (candidate && candidate.isGroup === false) {
          return res.status(200).json(candidate);
        }
      }
    }

    // Create a new direct chat if doesn't exist
    const directChat = await Chat.create({
      isGroup: false,
    });

    // Add members
    for (const memberId of normalizedMembers) {
      await ChatMember.create({
        chatId: directChat.id,
        userId: memberId,
      });
    }

    res.status(201).json(directChat);
  } catch (error) {
    console.error("Error creating direct chat:", error);
    res.status(500).json({ error: "Failed to create direct chat" });
  }
};

// @desc    Get all chats for a user
// @route   GET /api/chats
const getAllChats = async (req, res) => {
  try {
    const userId = req.user.id;


    // Get all chats where user is a member
    const userChats = await ChatMember.findAll({
      where: { userId },
      attributes: ['chatId'],
    });

    const chatIds = userChats.map((cm) => cm.chatId);

    // Fetch chats (only include latestMessage). We'll fetch member ids separately
    const chats = await Chat.findAll({
      where: {
        id: {
          [Op.in]: chatIds,
        },
      },
      include: [
        {
          model: Message,
          as: 'latestMessage',
          attributes: ['id', 'content', 'senderId', 'createdAt'],
        },
      ],
      order: [['updatedAt', 'DESC']],
    });

    // Get unread counts and attach plain member id arrays
    const chatsWithUnread = await Promise.all(
      chats.map(async (chat) => {
        // Get member ids for this chat
        const members = await ChatMember.findAll({
          where: { chatId: chat.id },
          attributes: ['userId'],
        });
        const memberIds = members.map((m) => (m.userId !== undefined ? m.userId : m.userId));

        // Get unread messages from other users
        const unreadMessages = await Message.findAll({
          where: {
            chatId: chat.id,
            senderId: {
              [Op.ne]: userId,
            },
          },
          attributes: ['id'],
        });

        // Count how many of these are unread for this user
        let unreadCount = 0;
        for (const message of unreadMessages) {
          const readStatus = await MessageReadStatus.findOne({
            where: {
              messageId: message.id,
              userId,
            },
          });
          if (!readStatus || readStatus.status !== 'seen') {
            unreadCount++;
          }
        }

        return {
          ...chat.toJSON(),
          members: memberIds,
          unreadCount,
        };
      })
    );

    res.status(200).json(chatsWithUnread);
  } catch (error) {
    console.error("Error fetching chats:", error);
    res.status(500).json({ error: "Failed to get chats" });
  }
};

// @desc    Get chat by ID
// @route   GET /api/chats/:id
const getChatById = async (req, res) => {
  const chatId = req.params.id;

  try {
    const chat = await Chat.findByPk(chatId, {
      include: [
        {
          model: ChatMember,
          attributes: ['userId'],
          as: 'members',
        },
        {
          model: ChatAdmin,
          attributes: ['userId'],
          as: 'admins',
        },
        {
          model: Message,
          as: 'latestMessage',
        },
      ],
    });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    res.status(200).json(chat);
  } catch (error) {
    console.error("Error fetching chat:", error);
    res.status(500).json({ error: "Failed to get chat" });
  }
};

// @desc    Update a group chat
// @route   PUT /api/chats/group/:id
const updateGroupChat = async (req, res) => {
  const userId = req.user.id;
  const { groupName, groupAvatar, members, admins } = req.body;
  const chatId = req.params.id;

  try {
    const chat = await Chat.findByPk(chatId);
    if (!chat || !chat.isGroup) {
      return res.status(404).json({ error: "Group chat not found" });
    }

    // Check if user is admin
    const isAdmin = await ChatAdmin.count({
      where: { chatId, userId },
    });

    if (!isAdmin) {
      return res.status(403).json({ error: "Only group admins can update the group chat" });
    }

    if (groupName) chat.groupName = groupName;
    if (groupAvatar) chat.groupAvatar = groupAvatar;
    await chat.save();

    // Add new members
    if (Array.isArray(members)) {
      const existingMembers = await ChatMember.findAll({
        where: { chatId },
        attributes: ['userId'],
      });
      const existingMemberIds = existingMembers.map(m => m.userId);

      for (const memberId of members) {
        if (!existingMemberIds.includes(memberId)) {
          await ChatMember.create({
            chatId,
            userId: memberId,
          });
        }
      }
    }

    // Add new admins
    if (Array.isArray(admins)) {
      const existingAdmins = await ChatAdmin.findAll({
        where: { chatId },
        attributes: ['userId'],
      });
      const existingAdminIds = existingAdmins.map(a => a.userId);

      for (const adminId of admins) {
        if (!existingAdminIds.includes(adminId)) {
          await ChatAdmin.create({
            chatId,
            userId: adminId,
          });
        }
      }
    }

    const updatedChat = await Chat.findByPk(chatId);
    res.status(200).json(updatedChat);
  } catch (error) {
    console.error("Error updating group chat:", error);
    res.status(500).json({ error: "Failed to update group chat" });
  }
};

// @desc    Archive or unarchive a chat for a user
// @route   PUT /api/chats/:id/archive
const toggleArchive = async (req, res) => {
  const chatId = req.params.id;
  const userId = req.user.id;

  try {
    const chat = await Chat.findByPk(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Check if user is member
    const isMember = await ChatMember.count({
      where: { chatId, userId },
    });

    if (!isMember) {
      return res.status(403).json({ error: "You are not a member of this chat" });
    }

    const isArchived = await ChatArchived.count({
      where: { chatId, userId },
    });

    if (isArchived) {
      await ChatArchived.destroy({
        where: { chatId, userId },
      });
    } else {
      await ChatArchived.create({
        chatId,
        userId,
      });
    }

    res.status(200).json({
      message: "Chat archived status updated",
      archived: !isArchived,
    });
  } catch (error) {
    console.error("Error archiving chat:", error);
    res.status(500).json({ error: "Failed to archive chat" });
  }
};

// @desc    Mute or unmute a chat for a user
// @route   PUT /api/chats/:id/mute
const toggleMute = async (req, res) => {
  const chatId = req.params.id;
  const userId = req.user.id;

  try {
    const chat = await Chat.findByPk(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Check if user is member
    const isMember = await ChatMember.count({
      where: { chatId, userId },
    });

    if (!isMember) {
      return res.status(403).json({ error: "You are not a member of this chat" });
    }

    const isMuted = await ChatMuted.count({
      where: { chatId, userId },
    });

    if (isMuted) {
      await ChatMuted.destroy({
        where: { chatId, userId },
      });
    } else {
      await ChatMuted.create({
        chatId,
        userId,
      });
    }

    res.status(200).json({
      message: "Chat mute status updated",
      muted: !isMuted,
    });
  } catch (error) {
    console.error("Error muting chat:", error);
    res.status(500).json({ error: "Failed to mute chat" });
  }
};

// @desc    Delete a chat by ID (group or direct)
// @route   DELETE /api/chats/:id
const deleteChat = async (req, res) => {
  const chatId = req.params.id;
  const userId = req.user.id;

  try {
    const chat = await Chat.findByPk(chatId);
    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    if (chat.isGroup) {
      // Group chat: Only admins can delete
      const isAdmin = await ChatAdmin.count({
        where: { chatId, userId },
      });

      if (!isAdmin) {
        return res.status(403).json({ error: "Only group admins can delete the group chat" });
      }
    } else {
      // Direct chat: Only members can delete
      const isMember = await ChatMember.count({
        where: { chatId, userId },
      });

      if (!isMember) {
        return res.status(403).json({ error: "Only chat members can delete the direct chat" });
      }
    }

    await Chat.destroy({
      where: { id: chatId },
    });

    res.status(200).json({ message: "Chat deleted successfully" });
  } catch (error) {
    console.error("Error deleting chat:", error);
    res.status(500).json({ error: "Failed to delete chat" });
  }
};

// @desc    Leave a group chat
// @route   PUT /api/chats/group/:id/leave
const leaveGroup = async (req, res) => {
  const chatId = req.params.id;
  const userId = req.user.id;

  try {
    const chat = await Chat.findByPk(chatId);
    if (!chat || !chat.isGroup) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Remove user from members
    await ChatMember.destroy({
      where: { chatId, userId },
    });

    // Remove user from admins if present
    await ChatAdmin.destroy({
      where: { chatId, userId },
    });

    res.status(200).json({ message: "Left group successfully" });
  } catch (error) {
    console.error("Leave group error:", error);
    res.status(500).json({ error: "Failed to leave group" });
  }
};

module.exports = {
  createDirectChat,
  createGroupChat,
  getAllChats,
  getChatById,
  updateGroupChat,
  toggleArchive,
  toggleMute,
  deleteChat,
  leaveGroup,
};
