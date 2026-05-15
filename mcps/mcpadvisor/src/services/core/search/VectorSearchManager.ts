/**
 * 向量搜索管理器模块
 * 提供向量搜索相关的功能函数
 */

import { MCPServerResponse } from '../../../types/index.js';
import {
  IVectorSearchEngine,
  IWritableVectorSearchEngine,
} from '../../interfaces/vectorSearchEngines.js';
import { getTextEmbedding } from '../../../utils/embedding.js';
import {
  GetMcpApiResponse,
  GetMcpServerEntry,
} from '../../common/api/getMcpResourceFetcher.js';
import logger from '../../../utils/logger.js';

/**
 * 转换为 MCPServerResponse 格式
 */
export const convertToServerResponse = (
  key: string,
  server: GetMcpServerEntry,
): MCPServerResponse => ({
  id: key,
  title: server.display_name,
  description: server.description,
  sourceUrl: server.repository.url,
  similarity: 0, // 将在搜索时计算
});

/**
 * 处理并索引数据
 * 如果提供的引擎不支持写操作，将记录警告并跳过索引步骤
 * 实现基于时间的数据更新策略，只在数据过期时才重建索引
 */
export const processAndIndexData = async (
  data: GetMcpApiResponse,
  vectorEngine: IVectorSearchEngine,
  createSearchableText: (server: GetMcpServerEntry) => string,
  forceUpdate: boolean = false,
): Promise<void> => {
  // 检查引擎是否支持写操作
  const writableEngine = vectorEngine as IWritableVectorSearchEngine;
  const supportsWriteOperations =
    typeof writableEngine.addEntry === 'function' &&
    typeof writableEngine.clear === 'function';

  if (!supportsWriteOperations) {
    logger.warn(
      'Vector engine does not support write operations, skipping indexing',
    );
    return;
  }

  try {
    // 检查数据是否需要更新
    let needsUpdate = forceUpdate;

    if (!needsUpdate) {
      try {
        // 动态导入 DataUpdateManager，避免循环依赖
        const { DataUpdateManager, UpdateType } = await import(
          '../../providers/oceanbase/dataUpdateManager.js'
        );

        // 检查数据是否过期（默认 1 小时）
        needsUpdate = await DataUpdateManager.needsUpdate(
          UpdateType.VECTOR_DATA,
          1,
        );

        if (!needsUpdate) {
          logger.info('Vector data is still fresh, skipping indexing');
          return;
        }

        logger.info('Vector data is outdated, starting reindexing');
      } catch (error) {
        // 如果无法检查更新时间，默认需要更新
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(
          `Could not check data update time, defaulting to update: ${message}`,
        );
        needsUpdate = true;
      }
    }

    // 如果需要更新，清除并重建索引
    if (needsUpdate) {
      // 清除现有索引
      await writableEngine.clear();

      // 处理每个服务器条目
      const entries = Object.entries(data);
      const startTime = Date.now();

      for (const [key, server] of entries) {
        // 创建可搜索文本
        const searchableText = createSearchableText(server);

        // 获取文本嵌入
        const embedding = await getTextEmbedding(searchableText);

        // 转换为 MCPServerResponse 格式
        const serverResponse = convertToServerResponse(key, server);

        // 添加到向量索引
        await writableEngine.addEntry(key, embedding, serverResponse);
      }

      const duration = (Date.now() - startTime) / 1000;
      logger.info(
        `Indexed ${entries.length} MCP servers in ${duration.toFixed(2)} seconds`,
      );

      // 更新数据更新时间
      try {
        const { DataUpdateManager, UpdateType } = await import(
          '../../providers/oceanbase/dataUpdateManager.js'
        );
        await DataUpdateManager.updateLastUpdateTime(UpdateType.VECTOR_DATA);
        logger.info('Updated vector data timestamp');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(`Could not update data timestamp: ${message}`);
      }
    }
  } catch (error) {
    // 使用增强的日志记录方式，传递完整错误对象
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error indexing data: ${message}`, {
      error,
      data: {
        dataSize: Object.keys(data).length,
        engineType: vectorEngine.constructor.name,
        forceUpdate,
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
      },
    });
    throw error;
  }
};

/**
 * 执行向量搜索
 * 同时使用向量相似度和文本查询来提高搜索质量
 */
export const performVectorSearch = async (
  query: string,
  vectorEngine: IVectorSearchEngine,
): Promise<MCPServerResponse[]> => {
  try {
    // 获取查询嵌入
    const queryEmbedding = await getTextEmbedding(query);

    // 设置搜索选项，包括最小相似度和文本查询
    const searchOptions = {
      minSimilarity: 0.3, // 降低相似度阈值，确保能返回结果
      textQuery: query, // 使用原始查询作为文本查询
    };

    // 使用向量引擎搜索，传递向量、结果数量和搜索选项
    const results = await vectorEngine.search(queryEmbedding, 5, searchOptions);

    logger.debug(`Found ${results.length} results from hybrid vector search`);
    return results;
  } catch (error) {
    // 使用增强的日志记录方式，传递完整错误对象
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error in vector search: ${message}`, {
      error,
      data: {
        query,
        minSimilarity: 0.3,
        useTextQuery: true,
        errorType:
          error instanceof Error ? error.constructor.name : typeof error,
      },
    });
    throw error;
  }
};
