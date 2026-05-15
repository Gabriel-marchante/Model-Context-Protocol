import { MCPServerResponse } from '../../../types/index.js';
import {
  IWritableVectorSearchEngine,
  VectorSearchOptions,
} from '../../interfaces/vectorSearchEngines.js';
import logger from '../../../utils/logger.js';
import { normalizeVector } from '../../../utils/vectorUtils.js';

/**
 * 内存向量条目
 */
interface VectorEntry {
  id: string;
  vector: number[];
  data: MCPServerResponse;
  categories?: string[];
  tags?: string[];
}

/**
 * 计算余弦相似度
 * 使用归一化向量计算相似度
 */
const calculateCosineSimilarity = (vecA: number[], vecB: number[]): number => {
  // 归一化向量
  const normalizedVecA = normalizeVector(vecA);
  const normalizedVecB = normalizeVector(vecB);

  let dotProduct = 0;

  // 确保向量长度相同
  const length = Math.min(normalizedVecA.length, normalizedVecB.length);

  // 已归一化向量的点积就是余弦相似度
  for (let i = 0; i < length; i++) {
    dotProduct += normalizedVecA[i] * normalizedVecB[i];
  }

  return dotProduct;
};

/**
 * 计算条目相似度
 */
const calculateEntrySimilarity = (
  entry: VectorEntry,
  queryVector: number[],
): MCPServerResponse => {
  const similarity = calculateCosineSimilarity(queryVector, entry.vector);

  return {
    ...entry.data,
    similarity,
  };
};

/**
 * 按相似度排序结果
 */
const sortByHighestSimilarity = (
  a: MCPServerResponse,
  b: MCPServerResponse,
): number => b.similarity - a.similarity;

/**
 * 内存向量搜索引擎实现
 * 用于开发和测试，或作为 OceanBase 的备选方案
 * 实现 IWritableVectorSearchEngine 接口，支持读写操作
 */
export class InMemoryVectorEngine implements IWritableVectorSearchEngine {
  private entries: VectorEntry[] = [];

  /**
   * 构造函数
   */
  constructor() {
    logger.info('In-memory vector engine initialized');
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
    try {
      // 对向量进行归一化
      const normalizedVector = normalizeVector(vector);

      // 提取分类和标签信息（如果有）
      const categories = data.categories
        ? typeof data.categories === 'string'
          ? [data.categories]
          : data.categories
        : undefined;

      const tags = data.tags
        ? typeof data.tags === 'string'
          ? [data.tags]
          : data.tags
        : undefined;

      // 检查是否已存在相同 ID 的条目
      const existingIndex = this.entries.findIndex(entry => entry.id === id);

      if (existingIndex >= 0) {
        // 替换现有条目
        this.entries[existingIndex] = {
          id,
          vector: normalizedVector,
          data,
          categories,
          tags,
        };
        logger.debug(
          `Updated normalized vector entry for server: ${data.title}`,
        );
      } else {
        // 添加新条目
        this.entries.push({
          id,
          vector: normalizedVector,
          data,
          categories,
          tags,
        });
        logger.debug(`Added normalized vector entry for server: ${data.title}`);
      }
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
    options: VectorSearchOptions = {},
  ): Promise<MCPServerResponse[]> {
    try {
      if (this.entries.length === 0) {
        logger.debug('No vector entries available for search');
        return [];
      }

      // 对查询向量进行归一化
      const normalizedQueryVector = normalizeVector(queryVector);

      // 提取搜索选项
      const { categories, minSimilarity = 0.5, textQuery } = options;

      // 记录搜索参数
      if (categories && categories.length > 0) {
        logger.debug(`Applying category filter: ${categories.join(', ')}`);
      }

      if (textQuery) {
        logger.debug(`Using text query: "${textQuery}"`);
      }

      // 先过滤分类（如果指定）
      let filteredEntries = this.entries;
      if (categories && categories.length > 0) {
        filteredEntries = this.entries.filter(entry => {
          if (!entry.categories) return false;
          return categories.some(category =>
            entry.categories?.some(entryCategory =>
              entryCategory.toLowerCase().includes(category.toLowerCase()),
            ),
          );
        });
        logger.debug(
          `Filtered to ${filteredEntries.length} entries by category`,
        );
      }

      // 文本查询过滤（如果指定）
      if (textQuery) {
        const keywords = textQuery
          .toLowerCase()
          .split(/\s+/)
          .filter(k => k.length > 1);
        if (keywords.length > 0) {
          filteredEntries = filteredEntries.filter(entry => {
            // 检查标题、描述、分类和标签是否包含关键词
            const title = entry.data.title?.toLowerCase() || '';
            const description = entry.data.description?.toLowerCase() || '';
            const categories = entry.categories?.join(' ').toLowerCase() || '';
            const tags = entry.tags?.join(' ').toLowerCase() || '';

            // 只要有一个关键词匹配就返回 true
            return keywords.some(
              keyword =>
                title.includes(keyword) ||
                description.includes(keyword) ||
                categories.includes(keyword) ||
                tags.includes(keyword),
            );
          });
          logger.debug(
            `Filtered to ${filteredEntries.length} entries by text query`,
          );
        }
      }

      const startTime = Date.now();

      // 计算每个条目的相似度
      const results = filteredEntries.map(entry => {
        const vectorSimilarity = calculateEntrySimilarity(
          entry,
          normalizedQueryVector,
        );

        // 如果有文本查询，计算文本相关度并结合向量相似度
        if (textQuery) {
          const keywords = textQuery
            .toLowerCase()
            .split(/\s+/)
            .filter(k => k.length > 1);
          let textScore = 0;

          if (keywords.length > 0) {
            const title = entry.data.title?.toLowerCase() || '';
            const description = entry.data.description?.toLowerCase() || '';
            const categories = entry.categories?.join(' ').toLowerCase() || '';
            const tags = entry.tags?.join(' ').toLowerCase() || '';

            // 计算文本相关度
            keywords.forEach(keyword => {
              if (title.includes(keyword)) textScore += 0.5;
              if (description.includes(keyword)) textScore += 0.3;
              if (categories.includes(keyword)) textScore += 0.2;
              if (tags.includes(keyword)) textScore += 0.2;
            });

            // 归一化分数
            textScore = Math.min(1, textScore / Math.max(1, keywords.length));
          }

          // 向量相似度权重 70%，文本相关度权重 30%
          const combinedSimilarity =
            vectorSimilarity.similarity * 0.7 + textScore * 0.3;
          return { ...vectorSimilarity, similarity: combinedSimilarity };
        }

        return vectorSimilarity;
      });

      // 过滤相似度低于阈值的结果
      const filteredResults = results.filter(
        result => (result.similarity || 0) >= minSimilarity,
      );

      // 按相似度降序排序并限制数量
      const sortedResults = filteredResults
        .sort(sortByHighestSimilarity)
        .slice(0, limit);

      const duration = Date.now() - startTime;
      const searchType = textQuery ? 'hybrid (vector + text)' : 'vector-only';
      logger.debug(
        `Found ${sortedResults.length} results from in-memory ${searchType} search in ${duration}ms`,
      );

      return sortedResults;
    } catch (error) {
      this.handleError(error, 'vector search');
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
   * 统一错误处理
   */
  private handleError(error: unknown, operation: string): never {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error in ${operation}: ${message}`);
    throw error;
  }
}
