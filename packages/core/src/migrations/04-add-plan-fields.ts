import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface) {
  await queryInterface.addColumn('plans', 'slug', {
    type: DataTypes.STRING(50),
    allowNull: true,
    unique: true,
  });
  await queryInterface.addColumn('plans', 'description', {
    type: DataTypes.TEXT,
    allowNull: true,
  });
  await queryInterface.addColumn('plans', 'currency', {
    type: DataTypes.STRING(3),
    allowNull: true,
    defaultValue: 'TRY',
  });
  await queryInterface.addColumn('plans', 'storeLimit', {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 1,
  });
  await queryInterface.addColumn('plans', 'modules', {
    type: DataTypes.JSONB,
    allowNull: true,
  });
  await queryInterface.addColumn('plans', 'isActive', {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: true,
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.removeColumn('plans', 'slug');
  await queryInterface.removeColumn('plans', 'description');
  await queryInterface.removeColumn('plans', 'currency');
  await queryInterface.removeColumn('plans', 'storeLimit');
  await queryInterface.removeColumn('plans', 'modules');
  await queryInterface.removeColumn('plans', 'isActive');
}
