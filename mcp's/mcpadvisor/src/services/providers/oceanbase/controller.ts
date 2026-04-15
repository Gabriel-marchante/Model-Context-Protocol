import mysql, { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import {
  IVectorDBClient,
  SearchResult,
} from '../../interfaces/vectorDBClient.js';
import {
  OCEANBASE_URL,
  DB_MAX_CONNECTIONS,
  DB_TABLE_NAME,
} from '../../../config/constants.js';
import logger from '../../../utils/logger.js';
import { DataUpdateManager } from './dataUpdateManager.js';
import { normalizeVector } from '../../../utils/vectorUtils.js';

/**
 * 获取数据库连接池
 */
export const getClient = async (): Promise<Pool> => {
  if (!OCEANBASE_URL) {
    logger.warn(
      'OCEANBASE_URL is not set, OceanBase client will not be available',
    );
    return Promise.reject('OCEANBASE_URL is not set');
  }

  if (global.obClient) {
    return global.obClient;
  }

  try {
    // 解析连接URL以获取配置参数
    const connectionConfig = new URL(OCEANBASE_URL);
    const host = connectionConfig.hostname;
    const port = parseInt(connectionConfig.port || '3306');
    const user = connectionConfig.username;
    const password = connectionConfig.password;
    const database = connectionConfig.pathname.substring(1);

    global.obClient = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      // 禁用SSL连接，因为服务器不支持安全连接
      ssl: undefined,
      waitForConnections: true,
      connectionLimit: DB_MAX_CONNECTIONS,
      connectTimeout: 20000,
      idleTimeout: 60000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });

    logger.info(`OceanBase connected to ${OCEANBASE_URL}`);
    return global.obClient;
  } catch (error) {
    logger.error(
      `Failed to connect to OceanBase: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
};

/**
 * 查询条件类型
 */
type WhereProps = (string | [string, string | number])[];

/**
 * 插入数据类型
 */
type ValuesProps = { key: string; value?: string | number }[];

/**
 * 构建 WHERE 子句
 */
const buildWhereClause = (where?: WhereProps): string => {
  if (!where || where.length === 0) {
    return '';
  }

  const whereStr = where
    .map(item => {
      if (typeof item === 'string') {
        return item;
      }
      const val =
        typeof item[1] === 'number' ? item[1] : `'${String(item[1])}'`;
      return `${item[0]}=${val}`;
    })
    .join(' ');

  return `WHERE ${whereStr}`;
};

/**
 * 构建插入值字符串
 */
const buildInsertValues = (values: ValuesProps[]): string =>
  values
    .map(
      items =>
        `(${items
          .map(item =>
            typeof item.value === 'number'
              ? item.value
              : `'${String(item.value).replace(/\'/g, '"')}'`,
          )
          .join(',')})`,
    )
    .join(',');

/**
 * 执行自定义 SQL 查询
 */
export const executeQuery = async <T extends RowDataPacket[]>(
  sql: string,
): Promise<T> => {
  const client = await getClient();
  const start = Date.now();

  try {
    const [rows] = await client.query<T>(sql);
    const time = Date.now() - start;

    if (time > 300) {
      logger.warn(`OceanBase query time: ${time}ms, sql: ${sql}`);
    }

    return rows;
  } catch (error) {
    logger.error(
      `OceanBase query error: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
};

/**
 * 插入数据
 */
const insertData = async (
  values: ValuesProps,
): Promise<{ insertId: string }> => {
  if (values.length === 0) {
    return { insertId: '' };
  }

  const fields = values.map(item => item.key).join(',');
  const valuesStr = values
    .map(item =>
      typeof item.value === 'number'
        ? item.value
        : `'${String(item.value).replace(/\'/g, '"')}'`,
    )
    .join(',');

  const sql = `INSERT INTO ${DB_TABLE_NAME} (${fields}) VALUES (${valuesStr})`;

  try {
    const client = await getClient();
    const [result] = await client.query<ResultSetHeader>(sql);

    return {
      insertId: String(result.insertId),
    };
  } catch (error) {
    logger.error(
      `OceanBase insert error: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
};

/**
 * 删除数据
 */
const deleteData = async (where: WhereProps): Promise<void> => {
  const whereClause = buildWhereClause(where);
  const sql = `DELETE FROM ${DB_TABLE_NAME} ${whereClause}`;

  try {
    await executeQuery(sql);
  } catch (error) {
    logger.error(
      `OceanBase delete error: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
};

/**
 * 搜索结果类型
 */
type SearchResultItem = {
  id: string;
  server_id: string;
  server_name: string;
  github_url: string;
  description: string;
  categories?: string;
  tags?: string;
  score: number;
};

/**
 * 基于元数据搜索
 * 使用关键词匹配搜索标题、描述、分类和标签
 */
const searchByMetadata = async (
  query: string,
  limit: number = 10,
  categories?: string[],
): Promise<SearchResultItem[]> => {
  try {
    if (!query.trim()) {
      return [];
    }

    // 将查询分解为关键词
    const keywords = query
      .trim()
      .split(/\s+/)
      .filter(k => k.length > 1);
    if (keywords.length === 0) {
      return [];
    }

    // 构建基本查询
    let sql = `
      SELECT id, server_id, server_name, github_url, description, categories, tags, 0 AS score
      FROM ${DB_TABLE_NAME}
      WHERE 
    `;

    // 构建关键词匹配条件
    const keywordConditions = keywords
      .map(
        keyword =>
          `(server_name LIKE '%${keyword}%' OR description LIKE '%${keyword}%')`,
      )
      .join(' OR ');

    sql += `(${keywordConditions})`;

    // 添加分类过滤条件（如果有）
    if (categories && categories.length > 0) {
      const categoryConditions = categories
        .map(cat => `categories LIKE '%${cat}%'`)
        .join(' OR ');
      sql += ` AND (${categoryConditions})`;
    }

    // 添加限制
    sql += ` LIMIT ${limit}`;

    // 执行查询
    const startTime = Date.now();
    const results =
      await executeQuery<(SearchResultItem & RowDataPacket)[]>(sql);
    const queryTime = Date.now() - startTime;

    // 计算相关度分数
    const scoredResults = results.map(item => {
      // 简单的相关度计算：基于关键词匹配数量
      let score = 0;
      keywords.forEach(keyword => {
        if (item.server_name.toLowerCase().includes(keyword.toLowerCase()))
          score += 0.5;
        if (item.description.toLowerCase().includes(keyword.toLowerCase()))
          score += 0.3;
        if (
          item.categories &&
          item.categories.toLowerCase().includes(keyword.toLowerCase())
        )
          score += 0.2;
        if (
          item.tags &&
          item.tags.toLowerCase().includes(keyword.toLowerCase())
        )
          score += 0.2;
      });

      // 归一化分数到 0-1 范围
      score = Math.min(1, score / Math.max(1, keywords.length));

      return { ...item, score };
    });

    // 按分数排序
    scoredResults.sort((a, b) => b.score - a.score);

    logger.debug(
      `Metadata search: query="${query}", keywords=${keywords.length}, results=${results.length}, time=${queryTime}ms`,
    );

    return scoredResults;
  } catch (error) {
    logger.error(
      `OceanBase metadata search error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
};

/**
 * 向量相似度搜索
 * 使用内积计算归一化向量之间的相似度
 */
const searchVectorsByInnerProduct = async (
  vector: number[],
  limit: number = 10,
  categories?: string[],
  minSimilarity: number = 0.5,
): Promise<SearchResultItem[]> => {
  try {
    // 动态调整 ef_search 参数，基于查询复杂度
    // 向量维度越高，ef_search 参数应越大
    const vectorDimension = vector.length;
    const efSearch = Math.max(
      global.systemEnv?.hnswEfSearch || 100,
      Math.min(200, Math.ceil(vectorDimension / 10)),
    );

    // 构建基本查询
    let query = `
      BEGIN;
        SET ob_hnsw_ef_search = ${efSearch};
        SELECT id, server_id, server_name, github_url, description, categories, tags, inner_product(vector, [${vector}]) AS score
          FROM ${DB_TABLE_NAME}
    `;

    // 添加分类过滤条件（如果有）
    if (categories && categories.length > 0) {
      const categoryConditions = categories
        .map(cat => `categories LIKE '%${cat}%'`)
        .join(' OR ');
      query += `WHERE (${categoryConditions}) `;
    }

    // 添加排序和限制
    query += `
          ORDER BY score DESC APPROXIMATE 
          LIMIT ${limit * 2}; -- 获取更多结果，然后基于相似度过滤
      COMMIT;
    `;

    // 执行查询
    const startTime = Date.now();
    const client = await getClient();
    const [results] = await client.query<RowDataPacket[][]>(query);
    const queryTime = Date.now() - startTime;

    // 结果在第三个数组中（BEGIN 和 SET 语句后）
    const rows = results[2] as unknown as Array<
      SearchResultItem & RowDataPacket
    >;

    // 过滤相似度低于阈值的结果
    const filteredRows = rows.filter(item => item.score >= minSimilarity);

    // 只返回请求的数量
    const limitedRows = filteredRows.slice(0, limit);

    // 记录查询性能信息
    logger.debug(
      `Vector search: ef_search=${efSearch}, query_time=${queryTime}ms, results=${rows.length}, filtered=${filteredRows.length}, returned=${limitedRows.length}`,
    );

    return limitedRows.map(item => ({
      id: String(item.id),
      server_id: item.server_id,
      server_name: item.server_name,
      github_url: item.github_url,
      description: item.description,
      categories: item.categories,
      tags: item.tags,
      score: item.score,
    }));
  } catch (error) {
    logger.error(
      `OceanBase vector search error: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
};

/**
 * 合并搜索结果
 * 将向量搜索和元数据搜索的结果合并，并根据相关度排序
 */
const mergeSearchResults = (
  vectorResults: SearchResultItem[],
  metadataResults: SearchResultItem[],
  limit: number = 10,
): SearchResultItem[] => {
  // 创建结果映射，以server_id为键
  const resultMap = new Map<string, SearchResultItem>();

  // 先添加向量搜索结果
  vectorResults.forEach(item => {
    resultMap.set(item.server_id, { ...item, score: item.score * 0.7 }); // 向量搜索结果权重70%
  });

  // 合并元数据搜索结果
  metadataResults.forEach(item => {
    if (resultMap.has(item.server_id)) {
      // 如果已存在，合并分数（向量搜索权重70%，元数据搜索权重30%）
      const existingItem = resultMap.get(item.server_id)!;
      existingItem.score = existingItem.score + item.score * 0.3;
    } else {
      // 如果不存在，添加新结果（元数据搜索结果权重30%）
      resultMap.set(item.server_id, { ...item, score: item.score * 0.3 });
    }
  });

  // 转换为数组并按分数排序
  const mergedResults = Array.from(resultMap.values());
  mergedResults.sort((a, b) => b.score - a.score);

  // 限制结果数量
  return mergedResults.slice(0, limit);
};

/**
 * 初始化数据库表和索引
 */
const initDatabaseSchema = async (): Promise<void> => {
  try {
    // 创建表
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS ${DB_TABLE_NAME} (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        vector VECTOR(1536) NOT NULL,
        server_id VARCHAR(50) NOT NULL,
        server_name VARCHAR(100) NOT NULL,
        description TEXT,
        github_url VARCHAR(255) NOT NULL,
        categories VARCHAR(255),
        tags VARCHAR(255),
        createtime TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 创建向量索引
    try {
      // 先检查索引是否存在
      const checkIndexSql = `
        SELECT COUNT(*) as count FROM information_schema.statistics 
        WHERE table_schema = DATABASE() AND table_name = '${DB_TABLE_NAME}' AND index_name = 'vector_hnsw_idx';
      `;

      const [checkResult] = await executeQuery<RowDataPacket[]>(checkIndexSql);

      if (checkResult[0].count === 0) {
        try {
          // 尝试使用标准 HNSW 语法
          await executeQuery(`
            CREATE INDEX vector_hnsw_idx ON ${DB_TABLE_NAME} (vector) USING HNSW;
          `);
          logger.info(
            `HNSW index created on ${DB_TABLE_NAME} using standard syntax`,
          );
        } catch (indexError1) {
          logger.warn(
            `Standard HNSW syntax failed: ${indexError1 instanceof Error ? indexError1.message : String(indexError1)}`,
          );

          try {
            // 尝试使用替代语法
            await executeQuery(`
              ALTER TABLE ${DB_TABLE_NAME} ADD INDEX vector_hnsw_idx (vector) ALGORITHM=HNSW;
            `);
            logger.info(
              `HNSW index created on ${DB_TABLE_NAME} using ALTER TABLE syntax`,
            );
          } catch (indexError2) {
            logger.warn(
              `ALTER TABLE HNSW syntax failed: ${indexError2 instanceof Error ? indexError2.message : String(indexError2)}`,
            );
            logger.info(
              'Proceeding without vector index - vector search performance will be degraded',
            );
          }
        }
      } else {
        logger.info(`HNSW index already exists on ${DB_TABLE_NAME}`);
      }
    } catch (error) {
      logger.warn(
        `Could not create or verify vector index: ${error instanceof Error ? error.message : String(error)}`,
      );
      // 索引创建失败不应该阻止整个初始化过程
    }

    // 创建服务器ID索引
    try {
      await executeQuery(`
        CREATE INDEX IF NOT EXISTS server_id_idx ON ${DB_TABLE_NAME} (server_id);
      `);
      logger.info(
        `Server ID index created or already exists on ${DB_TABLE_NAME}`,
      );
    } catch (error) {
      logger.warn(
        `Could not create server_id index: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // 创建分类索引
    try {
      await executeQuery(`
        CREATE INDEX IF NOT EXISTS categories_idx ON ${DB_TABLE_NAME} (categories);
      `);
      logger.info(
        `Categories index created or already exists on ${DB_TABLE_NAME}`,
      );
    } catch (error) {
      logger.warn(
        `Could not create categories index: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    logger.info('OceanBase database schema initialized');
  } catch (error) {
    logger.error(
      `Error initializing database schema: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
};

/**
 * OceanBase 客户端实现
 */
export class OceanBaseClient implements IVectorDBClient {
  private isInitialized: boolean = false;

  /**
   * 连接到数据库
   */
  async connect(): Promise<void> {
    await getClient();
    this.isInitialized = true;
  }

  /**
   * 断开数据库连接
   */
  async disconnect(): Promise<void> {
    if (global.obClient) {
      await global.obClient.end();
      global.obClient = undefined;
      this.isInitialized = false;
      logger.info('OceanBase disconnected');
    }
  }

  /**
   * 添加向量到数据库
   * @param id 服务器ID
   * @param vector 向量数据
   * @param metadata 元数据，包括服务器信息、分类和标签
   */
  async addVector(
    id: string,
    vector: number[],
    metadata: Record<string, any>,
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.connect();
    }

    try {
      // 对向量进行归一化处理
      const normalizedVector = normalizeVector(vector);
      logger.debug(
        `Vector normalized from magnitude ${this.calculateMagnitude(vector).toFixed(4)} to ${this.calculateMagnitude(normalizedVector).toFixed(4)}`,
      );

      // 处理分类信息，确保存储为字符串
      let categories = '';
      if (metadata.categories) {
        if (Array.isArray(metadata.categories)) {
          categories = metadata.categories.join(',');
        } else if (typeof metadata.categories === 'string') {
          categories = metadata.categories;
        }
      }

      // 处理标签信息，确保存储为字符串
      let tags = '';
      if (metadata.tags) {
        if (Array.isArray(metadata.tags)) {
          tags = metadata.tags.join(',');
        } else if (typeof metadata.tags === 'string') {
          tags = metadata.tags;
        }
      }

      // 基本字段，这些是必须的
      const values = [
        { key: 'vector', value: `[${normalizedVector}]` },
        { key: 'server_id', value: id },
        { key: 'server_name', value: metadata.title || '' },
        { key: 'description', value: metadata.description || '' },
        { key: 'github_url', value: metadata.github_url || '' },
      ];

      // 添加分类和标签字段（如果有）
      if (categories) {
        values.push({ key: 'categories', value: categories });
      }

      if (tags) {
        values.push({ key: 'tags', value: tags });
      }

      await insertData(values);
      logger.debug(
        `Added normalized vector for server: ${metadata.title} with categories: ${categories || 'none'} and tags: ${tags || 'none'}`,
      );
    } catch (error) {
      // 如果插入失败，尝试只使用基本字段
      if (error instanceof Error && error.message.includes('Unknown column')) {
        logger.warn(`Falling back to basic fields only: ${error.message}`);
        const basicValues = [
          { key: 'vector', value: `[${normalizeVector(vector)}]` },
          { key: 'server_id', value: id },
          { key: 'server_name', value: metadata.title || '' },
          { key: 'description', value: metadata.description || '' },
          { key: 'github_url', value: metadata.github_url || '' },
        ];

        try {
          await insertData(basicValues);
          logger.debug(
            `Added basic normalized vector for server: ${metadata.title}`,
          );
        } catch (basicError) {
          logger.error(
            `Failed to add vector: ${basicError instanceof Error ? basicError.message : String(basicError)}`,
          );
          throw basicError;
        }
      } else {
        logger.error(
          `Failed to add vector: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    }
  }

  /**
   * 搜索相似向量
   * @param vector 查询向量
   * @param limit 结果数量限制
   * @param options 选项，包括分类过滤、相似度阈值和文本查询
   * @returns 搜索结果
   */
  async searchVectors(
    vector: number[],
    limit: number = 10,
    options: {
      categories?: string[];
      minSimilarity?: number;
      textQuery?: string; // 文本查询参数
    } = {},
  ): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      await this.connect();
    }

    try {
      const { categories, minSimilarity = 0.5, textQuery } = options;

      // 对查询向量进行归一化
      const normalizedQueryVector = normalizeVector(vector);

      // 并行执行向量搜索和元数据搜索
      const [vectorResults, metadataResults] = await Promise.all([
        // 向量搜索
        searchVectorsByInnerProduct(
          normalizedQueryVector,
          limit,
          categories,
          minSimilarity,
        ),
        // 元数据搜索（如果有文本查询）
        textQuery
          ? searchByMetadata(textQuery, limit, categories)
          : Promise.resolve([]),
      ]);

      // 记录搜索结果数量
      logger.debug(
        `Search results: vector=${vectorResults.length}, metadata=${metadataResults.length}`,
      );

      // 合并结果
      const mergedResults = textQuery
        ? mergeSearchResults(vectorResults, metadataResults, limit)
        : vectorResults;

      // 将结果转换为标准格式
      return mergedResults.map(item => ({
        id: item.server_id,
        similarity: item.score,
        metadata: {
          title: item.server_name,
          description: item.description,
          github_url: item.github_url,
          categories: item.categories,
          tags: item.tags,
        },
      }));
    } catch (error) {
      logger.error(
        `Error searching vectors: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * 删除所有向量
   */
  async deleteAll(): Promise<void> {
    if (!this.isInitialized) {
      await this.connect();
    }

    try {
      await deleteData([]);
      logger.info('All vectors deleted');
    } catch (error) {
      logger.error(
        `Error deleting all vectors: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * 初始化数据库
   */
  async initDatabase(): Promise<void> {
    if (!this.isInitialized) {
      await this.connect();
    }

    try {
      await initDatabaseSchema();

      // 初始化数据更新管理器
      try {
        await DataUpdateManager.initUpdateInfoTable();
        logger.info('Data update manager initialized');
      } catch (error) {
        logger.warn(
          `Could not initialize data update manager: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      logger.info('OceanBase database initialized');
    } catch (error) {
      logger.error(
        `Error initializing database: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
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
}

// 导出单例
export const oceanBaseClient = new OceanBaseClient();
