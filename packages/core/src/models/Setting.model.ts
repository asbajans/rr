import {
  Table, Column, Model, DataType, PrimaryKey, AllowNull, CreatedAt, UpdatedAt,
} from 'sequelize-typescript';

@Table({ tableName: 'settings', timestamps: true })
export class Setting extends Model {
  @PrimaryKey
  @AllowNull(false)
  @Column(DataType.STRING(100))
  declare key: string;

  @AllowNull(true)
  @Column(DataType.JSONB)
  declare value: any;

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date;
}
