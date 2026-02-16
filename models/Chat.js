const { seq } = require('../config/db');
const { DataTypes } = require('sequelize');

const Chat = seq.define('Chat', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    isGroup: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    groupName: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    groupAvatar: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    creatorId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id',
        },
    },
    latestMessageId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'Messages',
            key: 'id',
        },
    }
}, {
    timestamps: true,
    tableName: 'Chats',
});

// Associations will be set up in db.js after all models are imported
Chat.setupAssociations = function() {
    const User = require('./User');
    const Message = require('./Message');
    const ChatMember = require('./ChatMember');
    const ChatAdmin = require('./ChatAdmin');
    const ChatArchived = require('./ChatArchived');
    const ChatMuted = require('./ChatMuted');
    const PinnedMessage = require('./PinnedMessage');

    Chat.belongsTo(User, { foreignKey: 'creatorId', as: 'creator' });
    Chat.belongsTo(Message, { foreignKey: 'latestMessageId', as: 'latestMessage' });
    Chat.hasMany(Message, { foreignKey: 'chatId', as: 'messages' });
    Chat.belongsToMany(User, { 
        through: ChatMember,
        as: 'members',
        foreignKey: 'chatId',
        otherKey: 'userId'
    });
    Chat.belongsToMany(User, {
        through: ChatAdmin,
        as: 'admins',
        foreignKey: 'chatId',
        otherKey: 'userId'
    });
    Chat.belongsToMany(User, {
        through: ChatArchived,
        as: 'archivedBy',
        foreignKey: 'chatId',
        otherKey: 'userId'
    });
    Chat.belongsToMany(User, {
        through: ChatMuted,
        as: 'mutedBy',
        foreignKey: 'chatId',
        otherKey: 'userId'
    });
    Chat.belongsToMany(Message, {
        through: PinnedMessage,
        as: 'pinnedMessages',
        foreignKey: 'chatId',
        otherKey: 'messageId'
    });
};

module.exports = Chat;