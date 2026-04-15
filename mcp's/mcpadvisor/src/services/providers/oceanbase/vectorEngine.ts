import { MCPServerResponse } from '../../../types/index.js';
import { IWritableVectorSearchEngine } from '../../interfaces/vectorSearchEngines.js';
import { oceanBaseClient } from './controller.js';
import { OCEANBASE_URL } from '../../../config/constants.js';
import logger from '../../../utils/logger.js';
import { normalizeVector } from '../../../utils/vectorUtils.js';

/**
 * 将 MCPServerResponse 转换为元数据
 */
const serverResponseToMetadata = (
  data: MCPServerResponse,
): Record<string, any> => {
  // 创建基本元数据
  const metadata: Record<string, any> = {
    title: data.title,
    description: data.description,
    github_url: data.sourceUrl,
  };

  // 处理分类信息
  if (data.categories) {
    metadata.categories = data.categories;
  }

  // 处理标签信息
  if (data.tags) {
    metadata.tags = data.tags;
  }

  return metadata;
};

/**
 * 将搜索结果转换为 MCPServerResponse
 */
const searchResultToServerResponse = (result: {
  id: string;
  similarity: number;
  metadata: Record<string, any>;
}): MCPServerResponse => {
  // 创建基本响应
  const response: MCPServerResponse = {
    id: result.id,
    title: result.metadata.title,
    description: result.metadata.description,
    sourceUrl: result.metadata.github_url,
    similarity: result.similarity,
  };

  // 添加分类信息（如果有）
  if (result.metadata.categories) {
    response.categories = result.metadata.categories;
  }

  // 添加标签信息（如果有）
  if (result.metadata.tags) {
    response.tags = result.metadata.tags;
  }

  return response;
};

/**
 * OceanBase 向量搜索引擎实现
 * 实现 IWritableVectorSearchEngine 接口，支持读写操作
 */
export class OceanBaseVectorEngine implements IWritableVectorSearchEngine {
  private isInitialized: boolean = false;

  /**
   * 构造函数
   */
  constructor() {
    if (OCEANBASE_URL) {
      this.initDatabase().catch(error => {
        this.handleError(error, 'initializing OceanBase');
      });
    } else {
      logger.warn(
        'OCEANBASE_URL is not set, OceanBase vector engine will not be initialized',
      );
    }
  }

  /**
   * 初始化数据库
   */
  private async initDatabase(): Promise<void> {
    try {
      await oceanBaseClient.connect();
      await oceanBaseClient.initDatabase();
      this.isInitialized = true;
      logger.info('OceanBase vector engine initialized');
    } catch (error) {
      this.handleError(error, 'OceanBase initialization');
    }
  }

  /**
   * 添加向量条目
   * 在存储前对向量进行归一化处理
   */
  async addEntry(
    id: string,
    vector: number[],
    data: MCPServerResponse,
  ): Promise<void> {
    if (!OCEANBASE_URL || !this.isInitialized) {
      logger.warn(
        'OceanBase vector engine is not initialized, cannot add entry',
      );
      return;
    }

    try {
      // 对向量进行归一化
      const normalizedVector = normalizeVector(vector);
      logger.debug(
        `Vector normalized from magnitude ${this.calculateMagnitude(vector).toFixed(4)} to ${this.calculateMagnitude(normalizedVector).toFixed(4)}`,
      );

      const metadata = serverResponseToMetadata(data);
      await oceanBaseClient.addVector(id, normalizedVector, metadata);
      logger.debug(`Added normalized vector entry for server: ${data.title}`);
    } catch (error) {
      this.handleError(error, 'adding vector entry');
    }
  }

  /**
   * 向量相似度搜索
   * 在搜索前对查询向量进行归一化处理
   * @param queryVector 查询向量
   * @param limit 结果数量限制
   * @param options 选项，包括分类过滤、相似度阈值和文本查询
   * @returns 搜索结果
   */
  async search(
    queryVector: number[],
    limit: number = 10,
    options: {
      categories?: string[];
      minSimilarity?: number;
      textQuery?: string; // 文本查询参数
    } = {},
  ): Promise<MCPServerResponse[]> {
    if (!OCEANBASE_URL || !this.isInitialized) {
      logger.warn(
        'OceanBase vector engine is not initialized, returning empty search results',
      );
      return [];
    }

    try {
      // 对查询向量进行归一化
      const normalizedQueryVector = normalizeVector(queryVector);
      logger.debug(
        `Query vector normalized from magnitude ${this.calculateMagnitude(queryVector).toFixed(4)} to ${this.calculateMagnitude(normalizedQueryVector).toFixed(4)}`,
      );

      // 记录搜索参数
      if (options.categories && options.categories.length > 0) {
        logger.debug(
          `Applying category filter: ${options.categories.join(', ')}`,
        );
      }

      if (options.minSimilarity) {
        logger.debug(
          `Using minimum similarity threshold: ${options.minSimilarity}`,
        );
      }

      if (options.textQuery) {
        logger.debug(`Using text query: "${options.textQuery}"`);
      }

      // 执行搜索，包含向量搜索和文本搜索
      const startTime = Date.now();
      const results = await oceanBaseClient.searchVectors(
        normalizedQueryVector,
        limit,
        options,
      );
      const duration = Date.now() - startTime;

      const serverResponses = results.map(searchResultToServerResponse);

      // 记录搜索结果
      const searchType = options.textQuery
        ? 'hybrid (vector + text)'
        : 'vector-only';
      logger.debug(
        `Found ${serverResponses.length} results from ${searchType} search in ${duration}ms`,
      );

      return serverResponses;
    } catch (error) {
      this.handleError(error, 'vector search');
    }
  }

  /**
   * 清除所有向量数据
   */
  async clear(): Promise<void> {
    if (!OCEANBASE_URL || !this.isInitialized) {
      logger.warn(
        'OceanBase vector engine is not initialized, cannot clear entries',
      );
      return;
    }

    try {
      await oceanBaseClient.deleteAll();
      logger.info('Cleared all vector entries');
    } catch (error) {
      this.handleError(error, 'clearing vector entries');
    }
  }

  /**
   * 计算向量的大小（模）
   * @param vector 输入向量
   * @returns 向量的模
   */
  private calculateMagnitude(vector: number[]): number {
    return Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  }

  /**
   * 统一错误处理
   */
  private handleError(error: unknown, operation: string): never {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error in ${operation}: ${message}`);
    throw error;
  }
}
