const { seq } = require('../../config/db');
const { DataTypes } = require('sequelize');

const ChatMuted = seq.define('ChatMuted', {
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
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        onDelete: 'CASCADE',
    },
}, {
    timestamps: true,
    tableName: 'ChatMuted',
});

module.exports = ChatMuted;

