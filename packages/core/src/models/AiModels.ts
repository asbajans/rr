import {
  Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt,
  AllowNull, Default, ForeignKey, BelongsTo, Index, Unique, HasMany,
} from 'sequelize-typescript';

@Table({ tableName: 'ai_providers', timestamps: true, indexes: [{ unique: true, fields: ['code'] }] })
export class AiProvider extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;

  @AllowNull(false) @Unique @Column(DataType.STRING(50)) declare code: string;
  @AllowNull(false) @Column(DataType.STRING(100)) declare name: string;
  @AllowNull(true) @Column(DataType.TEXT) declare description: string;

  @AllowNull(false) @Column(DataType.STRING(20)) declare type: string; // 'openai' | 'openrouter' | 'nvidia' | 'ollama' | 'comfyui' | 'custom'
  @AllowNull(true) @Column(DataType.STRING(500)) declare baseUrl: string;

  @AllowNull(true) @Column(DataType.JSONB) declare authConfig: object; // { authType: 'bearer' | 'api-key' | 'none', headerName?: string, apiKeyEnv?: string }
  @Default(true) @Column(DataType.BOOLEAN) declare isActive: boolean;

  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;

  @HasMany(() => AiModel, 'providerId') declare models: AiModel[];
  @HasMany(() => AiScenario, 'providerId') declare scenarios: AiScenario[];
  @HasMany(() => AiProviderRateLimit, 'providerId') declare rateLimits: AiProviderRateLimit[];
}

@Table({ tableName: 'ai_models', timestamps: true, indexes: [
  { fields: ['providerId'] },
  { unique: true, fields: ['providerId', 'modelId'] },
] })
export class AiModel extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;

  @ForeignKey(() => AiProvider) @AllowNull(false) @Index @Column(DataType.BIGINT) declare providerId: number;
  @AllowNull(false) @Column(DataType.STRING(100)) declare modelId: string; // e.g. 'gpt-4o', 'nvidia/nemotron-3-ultra'
  @AllowNull(false) @Column(DataType.STRING(200)) declare displayName: string;
  @AllowNull(true) @Column(DataType.STRING(50)) declare modality: string; // 'chat' | 'vision' | 'embedding' | 'image' | 'multimodal'
  @AllowNull(true) @Column(DataType.INTEGER) declare maxTokens: number;
  @AllowNull(true) @Column(DataType.JSONB) declare pricing: object; // { input: 0.001, output: 0.002, currency: 'USD' }
  @Default(true) @Column(DataType.BOOLEAN) declare isActive: boolean;

  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;

  @BelongsTo(() => AiProvider) declare provider: AiProvider;
}

@Table({ tableName: 'ai_scenarios', timestamps: true, indexes: [
  { unique: true, fields: ['code'] },
  { fields: ['providerId'] },
  { fields: ['isActive'] },
] })
export class AiScenario extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;

  @AllowNull(false) @Unique @Column(DataType.STRING(100)) declare code: string; // 'analyze-product' | 'generate-description' | 'chat' | 'search' | 'recommend'
  @AllowNull(false) @Column(DataType.STRING(200)) declare name: string;
  @AllowNull(true) @Column(DataType.TEXT) declare description: string;

  @ForeignKey(() => AiProvider) @AllowNull(true) @Index @Column(DataType.BIGINT) declare providerId: number;
  @ForeignKey(() => AiModel) @AllowNull(false) @Index @Column(DataType.BIGINT) declare modelId: number;

  @Default({}) @Column(DataType.JSONB) declare parameters: object; // { temperature: 0.7, top_p: 0.9, max_tokens: 2000 }
  @Default(1) @Column(DataType.INTEGER) declare costCredits: number;

  @Default(true) @Column(DataType.BOOLEAN) declare isActive: boolean;

  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;

  @BelongsTo(() => AiProvider) declare provider: AiProvider;
  @BelongsTo(() => AiModel) declare model: AiModel;
}

@Table({ tableName: 'ai_provider_rate_limits', timestamps: true, indexes: [
  { fields: ['providerId'] },
  { unique: true, fields: ['providerId', 'scope'] },
] })
export class AiProviderRateLimit extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;

  @ForeignKey(() => AiProvider) @AllowNull(false) @Index @Column(DataType.BIGINT) declare providerId: number;
  @AllowNull(false) @Column(DataType.ENUM('per_minute', 'per_hour', 'per_day')) declare scope: string;
  @AllowNull(false) @Column(DataType.INTEGER) declare maxRequests: number;
  @Default(true) @Column(DataType.BOOLEAN) declare isActive: boolean;

  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;
  @UpdatedAt @Column(DataType.DATE) declare updatedAt: Date;

  @BelongsTo(() => AiProvider) declare provider: AiProvider;
}

@Table({ tableName: 'ai_usage_logs', timestamps: true, indexes: [
  { fields: ['userId'] },
  { fields: ['storeId'] },
  { fields: ['providerId'] },
  { fields: ['scenarioId'] },
  { fields: ['createdAt'] },
] })
export class AiUsageLog extends Model {
  @PrimaryKey @AutoIncrement @Column(DataType.BIGINT) declare id: number;

  @ForeignKey(() => AiProvider) @AllowNull(true) @Index @Column(DataType.BIGINT) declare providerId: number;
  @ForeignKey(() => AiModel) @AllowNull(true) @Index @Column(DataType.BIGINT) declare modelId: number;
  @ForeignKey(() => AiScenario) @AllowNull(true) @Index @Column(DataType.BIGINT) declare scenarioId: number;

  @AllowNull(false) @Index @Column(DataType.BIGINT) declare userId: number;
  @AllowNull(false) @Index @Column(DataType.BIGINT) declare storeId: number;

  @AllowNull(false) @Column(DataType.INTEGER) declare creditsUsed: number;
  @AllowNull(false) @Column(DataType.INTEGER) declare balanceBefore: number;
  @AllowNull(false) @Column(DataType.INTEGER) declare balanceAfter: number;

  @AllowNull(true) @Column(DataType.JSONB) declare requestMeta: object;
  @AllowNull(true) @Column(DataType.JSONB) declare responseMeta: object;

  @CreatedAt @Column(DataType.DATE) declare createdAt: Date;

  @BelongsTo(() => AiProvider) declare provider: AiProvider;
  @BelongsTo(() => AiModel) declare model: AiModel;
  @BelongsTo(() => AiScenario) declare scenario: AiScenario;
}