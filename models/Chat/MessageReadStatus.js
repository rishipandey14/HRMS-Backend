const { seq } = require('../../config/db');
const { DataTypes } = require('sequelize');

const MessageReadStatus = seq.define('MessageReadStatus', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
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
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
        onDelete: 'CASCADE',
    },
    status: {
        type: DataTypes.ENUM('sent', 'delivered', 'seen'),
        defaultValue: 'sent',
    },
}, {
    timestamps: true,
    tableName: 'MessageReadStatus',
});

module.exports = MessageReadStatus;

