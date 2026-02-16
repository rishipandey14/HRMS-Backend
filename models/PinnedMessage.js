const { seq } = require('../config/db');
const { DataTypes } = require('sequelize');

const PinnedMessage = seq.define('PinnedMessage', {
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
    messageId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'Messages',
            key: 'id',
        },
        onDelete: 'CASCADE',
    },
}, {
    timestamps: true,
    tableName: 'PinnedMessages',
});

module.exports = PinnedMessage;
