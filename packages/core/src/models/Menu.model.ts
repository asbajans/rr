import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt,
  AllowNull, Default, ForeignKey, BelongsTo, Index,
} from 'sequelize-typescript';
import { Store } from './Store.model.js';

@Table({ tableName: 'store_menus', timestamps: true, indexes: [{ fields: ['storeId'] }, { fields: ['storeId', 'slug'] }] })
export class StoreMenu extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;
  @ForeignKey(() => Store) @AllowNull(false) @Index @Column(DataType.BIGINT) declare storeId: number;
  @AllowNull(false) @Column(DataType.STRING(100)) declare name: string;
  @AllowNull(false) @Column(DataType.STRING(100)) declare slug: string;
  @AllowNull(true) @Column(DataType.JSONB) declare items: object;
  @AllowNull(true) @Column(DataType.STRING(50)) declare location: string;
  @Default(true) @Column(DataType.BOOLEAN) declare isActive: boolean;
  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;

  @BelongsTo(() => Store) declare store: Store;
}
