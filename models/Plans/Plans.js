const { DataTypes } = require('sequelize');
const { seq } = require('../../config/db');

const Plans = seq.define('Plans', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM('active', 'archived'),
        defaultValue: 'active',
    },
    billingInterval: {
        type: DataTypes.ENUM('monthly', 'yearly'),
        allowNull: false,
    },
    priceCents: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'INR',
    },
    sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    defaultLimits: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
    },
    featureFlags: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: {},
    },
    trialDays: {
        type: DataTypes.INTEGER,
        defaultValue: 15
    },
    createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
        model: 'users',
        key: 'id',
        },
    },
    updatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
        model: 'users',
        key: 'id',
        },
    },
}, {
    timestamps: true,
    tableName: 'plans'
    ,indexes: [
        {
            unique: true,
            fields: ['code'],
            name: 'plans_code_unique'
        }
    ]
});

module.exports = Plans;
