/**
 * 搜索结果接口
 */
export interface SearchResult {
  id: string;
  similarity: number;
  metadata: Record<string, any>;
}

/**
 * 向量数据库客户端接口
 */
export interface IVectorDBClient {
  /**
   * 连接到数据库
   */
  connect(): Promise<void>;

  /**
   * 断开数据库连接
   */
  disconnect(): Promise<void>;

  /**
   * 添加向量到数据库
   * @param id 向量唯一标识符
   * @param vector 向量数据
   * @param metadata 关联元数据
   */
  addVector(
    id: string,
    vector: number[],
    metadata: Record<string, any>,
  ): Promise<void>;

  /**
   * 搜索相似向量
   * @param vector 查询向量
   * @param limit 结果数量限制
   * @returns 搜索结果数组
   */
  searchVectors(vector: number[], limit: number): Promise<SearchResult[]>;

  /**
   * 删除所有向量
   */
  deleteAll(): Promise<void>;

  /**
   * 初始化数据库表和索引
   */
  initDatabase(): Promise<void>;
}
