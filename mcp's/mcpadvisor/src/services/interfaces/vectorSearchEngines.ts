/**
 * 向量搜索引擎接口定义
 * 遵循接口隔离原则，将读写操作分离
 */

import { MCPServerResponse } from '../../types/index.js';

/**
 * 向量搜索选项接口
 */
export interface VectorSearchOptions {
  /**
   * 分类过滤条件
   */
  categories?: string[];

  /**
   * 最小相似度阈值
   * 范围为 0-1，默认为 0.5
   */
  minSimilarity?: number;

  /**
   * 文本查询
   * 用于与向量搜索并行的元数据搜索
   */
  textQuery?: string;
}

/**
 * 基础向量搜索引擎接口 - 只读操作
 */
export interface IVectorSearchEngine {
  /**
   * 向量相似度搜索
   * @param queryVector 查询向量
   * @param limit 返回结果数量限制
   * @param options 搜索选项，包括分类过滤和相似度阈值
   * @returns 搜索结果列表
   */
  search(
    queryVector: number[],
    limit?: number,
    options?: VectorSearchOptions,
  ): Promise<MCPServerResponse[]>;
}

/**
 * 可写向量搜索引擎接口 - 扩展基础接口，添加写操作
 */
export interface IWritableVectorSearchEngine extends IVectorSearchEngine {
  /**
   * 添加向量条目
   * @param id 条目ID
   * @param vector 向量数据
   * @param data 服务器响应数据
   */
  addEntry(
    id: string,
    vector: number[],
    data: MCPServerResponse,
  ): Promise<void>;

  /**
   * 清除所有向量数据
   */
  clear(): Promise<void>;
}
