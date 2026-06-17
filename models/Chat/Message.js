const { seq } = require('../../config/db');
const { DataTypes } = require('sequelize');

const Message = seq.define('Message', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    chatId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Chats',
            key: 'id',
        },
        onDelete: 'CASCADE',
    },
    senderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    type: {
        type: DataTypes.ENUM(
            "text",
            "image",
            "file",
            "audio",
            "reaction",
            "video"
        ),
        defaultValue: "text",
    },
    fileUrl: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    fileSize: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    fileMimeType: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    reaction: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    replyToId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'Messages',
            key: 'id',
        },
        onDelete: 'SET NULL',
    },
    forwardedFromId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'Messages',
            key: 'id',
        },
        onDelete: 'SET NULL',
    },
    isEdited: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    status: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: 'Map of userId -> status (sent/delivered/seen)'
    }
}, {
    timestamps: true,
    tableName: 'Messages',
});

// Associations will be set up in db.js
Message.setupAssociations = function() {
    const Chat = require('./Chat');
    const User = require('../User/User');
    const MessageReadStatus = require('./MessageReadStatus');

    Message.belongsTo(Chat, { foreignKey: 'chatId', as: 'chat' });
    Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });
    Message.belongsTo(Message, { foreignKey: 'replyToId', as: 'replyTo' });
    Message.belongsTo(Message, { foreignKey: 'forwardedFromId', as: 'forwardedFrom' });
    Message.hasMany(MessageReadStatus, { foreignKey: 'messageId', as: 'readStatus' });
};

module.exports = Message;