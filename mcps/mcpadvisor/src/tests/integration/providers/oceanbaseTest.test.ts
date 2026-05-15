/**
 * OceanBase 连接测试
 * 用于验证 OceanBase 向量搜索功能
 */

import { oceanBaseClient } from '../../../services/providers/oceanbase/controller.js';
import { OceanBaseVectorEngine } from '../../../services/providers/oceanbase/vectorEngine.js';
import { getTextEmbedding } from '../../../utils/embedding.js';
import { MCPServerResponse } from '../../../types/index.js';

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// 注意：logger 已在 setup.ts 中被模拟
vi.mock('../utils/logger.js', () => ({
  __esModule: true,
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

/**
 * 测试数据
 */
const testData: MCPServerResponse[] = [
  {
    title: 'AI Assistant MCP Server',
    description:
      'A powerful MCP server for AI assistants with advanced capabilities',
    sourceUrl: 'https://github.com/example/ai-assistant-mcp',
    similarity: 0,
  },
  {
    title: 'Data Processing MCP Server',
    description: 'Process and transform data with this efficient MCP server',
    sourceUrl: 'https://github.com/example/data-processing-mcp',
    similarity: 0,
  },
  {
    title: 'Vector Search Engine',
    description:
      'High-performance vector search engine for similarity matching',
    sourceUrl: 'https://github.com/example/vector-search-engine',
    similarity: 0,
  },
];

// 跳过实际数据库测试，除非明确启用
const ENABLE_DB_TESTS = process.env.ENABLE_DB_TESTS === 'true';

describe('OceanBase Integration', () => {
  // 如果数据库测试被禁用，则跳过所有测试
  beforeAll(() => {
    if (!ENABLE_DB_TESTS) {
      console.log(
        'Database tests are disabled. Set ENABLE_DB_TESTS=true to enable.',
      );
    }
  });

  describe('Connection Tests', () => {
    it('should connect to OceanBase successfully', async () => {
      if (!ENABLE_DB_TESTS) {
        return;
      }

      try {
        const client = oceanBaseClient;
        await client.connect();
        expect(true).toBe(true); // 如果没有抛出异常，则测试通过
      } catch (error) {
        // 如果连接失败，则测试失败
        fail(
          `Connection test failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

    it('should initialize database schema', async () => {
      if (!ENABLE_DB_TESTS) {
        return;
      }

      try {
        const client = oceanBaseClient;
        await client.initDatabase();
        expect(true).toBe(true); // 如果没有抛出异常，则测试通过
      } catch (error) {
        fail(
          `Schema initialization failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  });

  describe('Vector Engine Tests', () => {
    it('should store and retrieve vectors', async () => {
      if (!ENABLE_DB_TESTS) {
        return;
      }

      try {
        // 创建向量引擎实例
        const vectorEngine = new OceanBaseVectorEngine();

        // 为测试数据生成嵌入向量
        const embeddedData = await Promise.all(
          testData.map(async server => {
            const searchableText = `${server.title} ${server.description}`;
            const embedding = await getTextEmbedding(searchableText);
            return {
              ...server,
              vector: embedding,
            };
          }),
        );

        // 存储向量数据
        for (const data of embeddedData) {
          await vectorEngine.addEntry(
            data.sourceUrl.split('/').pop() || 'unknown',
            data.vector,
            data,
          );
        }

        // 测试相似度搜索
        const queryText = 'AI assistant for data processing';
        const queryEmbedding = await getTextEmbedding(queryText);
        const searchResults = await vectorEngine.search(queryEmbedding, 3);

        // 验证搜索结果
        expect(searchResults).toBeDefined();
        expect(Array.isArray(searchResults)).toBe(true);

        if (searchResults.length > 0) {
          // 验证结果格式
          const firstResult = searchResults[0];
          expect(firstResult).toHaveProperty('title');
          expect(firstResult).toHaveProperty('description');
          expect(firstResult).toHaveProperty('github_url');
          expect(firstResult).toHaveProperty('similarity');
          expect(typeof firstResult.similarity).toBe('number');
        }
      } catch (error) {
        fail(
          `Vector engine test failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  });
});
