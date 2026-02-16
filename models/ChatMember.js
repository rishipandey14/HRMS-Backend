const { seq } = require('../config/db');
const { DataTypes } = require('sequelize');

const ChatMember = seq.define('ChatMember', {
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
    tableName: 'ChatMembers',
});

module.exports = ChatMember;
