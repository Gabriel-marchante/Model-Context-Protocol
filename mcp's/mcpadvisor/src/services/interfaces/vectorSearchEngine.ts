import { MCPServerResponse } from '../../types/index.js';

/**
 * 向量搜索引擎接口
 */
export interface IVectorSearchEngine {
  /**
   * 添加向量条目到搜索引擎
   * @param id 条目唯一标识符
   * @param vector 向量表示
   * @param data 关联的 MCP 服务器数据
   */
  addEntry(
    id: string,
    vector: number[],
    data: MCPServerResponse,
  ): Promise<void>;

  /**
   * 搜索与查询向量相似的条目
   * @param queryVector 查询向量
   * @param limit 返回结果数量限制
   * @returns 按相似度排序的 MCP 服务器响应
   */
  search(queryVector: number[], limit?: number): Promise<MCPServerResponse[]>;

  /**
   * 清除所有索引条目
   */
  clear(): Promise<void>;
}
