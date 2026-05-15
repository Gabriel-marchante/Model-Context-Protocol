/**
 * Meilisearch 向量搜索引擎实现
 * 提供基于 Meilisearch 的搜索功能
 * 注意：由于 API 密钥只有读取权限，此实现只支持搜索操作
 */
import { meilisearchClient } from './controller.js';
import logger from '../../../utils/logger.js';
/**
 * 将 Meilisearch 搜索结果转换为 MCPServerResponse
 */
const hitToServerResponse = (hit) => ({
    id: hit.id,
    title: hit.title,
    description: hit.description,
    sourceUrl: hit.github_url,
    similarity: hit._rankingScore || 0.5,
    installations: hit.installations || {},
});
/**
 * Meilisearch 向量搜索引擎实现
 */
export class MeilisearchVectorEngine {
    client;
    /**
     * 构造函数
     */
    constructor(client) {
        this.client = client || meilisearchClient;
        logger.info('Meilisearch vector engine initialized');
    }
    /**
     * 向量相似度搜索
     * 注意：Meilisearch 不直接支持向量搜索，这里使用文本搜索作为替代
     */
    async search(queryVector, limit = 10) {
        try {
            const queryText = this.vectorToTextQuery(queryVector);
            const results = await this.client.search(queryText, { limit });
            const serverResponses = results.hits.map(hitToServerResponse);
            logger.debug(`Found ${serverResponses.length} results from Meilisearch search`);
            return serverResponses;
        }
        catch (error) {
            this.handleError(error, 'Meilisearch search');
        }
    }
    /**
     * 将向量转换为文本查询
     * 由于 Meilisearch 不直接支持向量搜索，我们使用文本查询作为替代
     */
    vectorToTextQuery(queryVector) {
        // 使用查询向量的前几个值构造查询
        const queryTerms = queryVector
            .slice(0, 3)
            .map(v => v.toFixed(2))
            .join(' ');
        // 如果查询为空，使用通用查询
        return queryTerms || 'mcp server';
    }
    /**
     * 统一错误处理
     */
    handleError(error, operation) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Error in ${operation}: ${message}`);
        throw error;
    }
}
