import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.createTable('users', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    storeId: { type: DataTypes.BIGINT, allowNull: false, references: { model: 'stores', key: 'id' }, onDelete: 'CASCADE' },
    name: { type: DataTypes.STRING(100), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING(255), allowNull: false },
    role: { type: DataTypes.ENUM('owner', 'admin', 'staff'), defaultValue: 'staff' },
    aiCredits: { type: DataTypes.INTEGER, defaultValue: 0 },
    fcmToken: { type: DataTypes.STRING(255), allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
  await queryInterface.addIndex('users', { fields: ['storeId'] });
  await queryInterface.addIndex('users', { fields: ['email'], unique: true });
  await queryInterface.addIndex('users', { fields: ['isActive'] });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('users');
}