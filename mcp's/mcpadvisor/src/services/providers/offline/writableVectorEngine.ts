/**
 * 可写内存向量引擎实现
 * 提供基于内存的向量搜索和写入功能
 */

import { MCPServerResponse } from '../../../types/index.js';
import { IWritableVectorSearchEngine } from '../../interfaces/vectorSearchEngines.js';
import logger from '../../../utils/logger.js';

/**
 * 向量条目类型
 */
interface VectorEntry {
  id: string;
  vector: number[];
  data: MCPServerResponse;
}

/**
 * 可写内存向量引擎实现
 */
export class WritableInMemoryVectorEngine
  implements IWritableVectorSearchEngine
{
  private entries: VectorEntry[] = [];

  /**
   * 构造函数
   */
  constructor() {
    logger.info('Writable in-memory vector engine initialized');
  }

  /**
   * 添加向量条目
   */
  async addEntry(
    id: string,
    vector: number[],
    data: MCPServerResponse,
  ): Promise<void> {
    try {
      this.entries.push({ id, vector, data });
      logger.debug(`Added vector entry for server: ${data.title}`);
    } catch (error) {
      this.handleError(error, 'adding vector entry');
    }
  }

  /**
   * 向量相似度搜索
   */
  async search(
    queryVector: number[],
    limit: number = 10,
  ): Promise<MCPServerResponse[]> {
    try {
      // 计算每个条目与查询向量的相似度
      const results = this.entries.map(entry => {
        const similarity = this.calculateCosineSimilarity(
          queryVector,
          entry.vector,
        );
        return {
          ...entry.data,
          similarity,
        };
      });

      // 按相似度排序并限制结果数量
      const sortedResults = results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      logger.debug(
        `Found ${sortedResults.length} results from in-memory search`,
      );
      return sortedResults;
    } catch (error) {
      this.handleError(error, 'in-memory search');
    }
  }

  /**
   * 清除所有向量数据
   */
  async clear(): Promise<void> {
    try {
      this.entries = [];
      logger.info('Cleared all in-memory vector entries');
    } catch (error) {
      this.handleError(error, 'clearing vector entries');
    }
  }

  /**
   * 计算余弦相似度
   */
  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    // 确保向量长度相同
    const length = Math.min(vecA.length, vecB.length);

    // 计算点积
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    // 避免除以零
    if (normA === 0 || normB === 0) {
      return 0;
    }

    // 计算余弦相似度
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
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
