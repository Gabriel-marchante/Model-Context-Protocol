/**
 * 嵌入工具单元测试
 * 测试 TensorFlow.js 和 Universal Sentence Encoder 实现
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getTextEmbedding,
  getTextEmbeddings,
  useSimpleEmbeddingProvider,
  useUniversalSentenceEncoder,
  cosineSimilarity,
  normalizeVector,
  createZeroVector,
} from '../../../utils/embedding.js';
import logger from '../../../utils/logger.js';

// 注意：logger 已在 setup.ts 中被模拟

describe('嵌入工具测试', () => {
  // 在每个测试前重置模拟
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 基础工具函数测试
  describe('基础工具函数', () => {
    test('createZeroVector 应创建指定长度的零向量', () => {
      const size = 10;
      const vector = createZeroVector(size);

      expect(vector).toHaveLength(size);
      expect(vector.every(v => v === 0)).toBe(true);
    });

    test('normalizeVector 应正确归一化向量', () => {
      const vector = [3, 4];
      const normalized = normalizeVector(vector);

      // 向量 [3, 4] 归一化后应为 [0.6, 0.8]
      expect(normalized[0]).toBeCloseTo(0.6, 5);
      expect(normalized[1]).toBeCloseTo(0.8, 5);

      // 归一化向量的幅度应为 1
      const magnitude = Math.sqrt(
        normalized.reduce((sum, val) => sum + val * val, 0),
      );
      expect(magnitude).toBeCloseTo(1, 5);
    });

    test('normalizeVector 应处理零向量', () => {
      const vector = [0, 0, 0];
      const normalized = normalizeVector(vector);

      expect(normalized).toEqual(vector);
    });

    test('cosineSimilarity 应计算两个向量的余弦相似度', () => {
      const vecA = [1, 0];
      const vecB = [0, 1];
      const vecC = [1, 1];

      // 正交向量相似度为 0
      expect(cosineSimilarity(vecA, vecB)).toBeCloseTo(0, 5);

      // 45度夹角向量相似度为 0.7071...
      expect(cosineSimilarity(vecA, vecC)).toBeCloseTo(0.7071, 4);

      // 相同向量相似度为 1
      expect(cosineSimilarity(vecA, vecA)).toBeCloseTo(1, 5);
    });
  });

  // 嵌入生成测试
  describe('嵌入生成', () => {
    // 使用简单提供者进行测试，避免加载大模型
    beforeAll(() => {
      useSimpleEmbeddingProvider();
    });

    test('getTextEmbedding 应生成非空向量', async () => {
      const text = '测试文本';
      const embedding = await getTextEmbedding(text);

      expect(embedding).toBeDefined();
      expect(embedding.length).toBeGreaterThan(0);

      // 向量应该已归一化，幅度接近 1
      const magnitude = Math.sqrt(
        embedding.reduce((sum, val) => sum + val * val, 0),
      );
      expect(magnitude).toBeCloseTo(1, 5);
    });

    test('getTextEmbedding 应处理空文本', async () => {
      const embedding = await getTextEmbedding('');

      expect(embedding).toBeDefined();
      expect(embedding.every(v => v === 0)).toBe(true);
    });

    test('getTextEmbeddings 应批量生成嵌入', async () => {
      const texts = ['文本1', '文本2', '文本3'];
      const embeddings = await getTextEmbeddings(texts);

      expect(embeddings).toHaveLength(texts.length);
      expect(embeddings[0].length).toBeGreaterThan(0);

      // 所有向量应该已归一化
      embeddings.forEach(embedding => {
        const magnitude = Math.sqrt(
          embedding.reduce((sum, val) => sum + val * val, 0),
        );
        expect(magnitude).toBeCloseTo(1, 5);
      });
    });

    test('相似文本应有较高的余弦相似度', async () => {
      const text1 = '查找适合风控策略部署的MCP服务器';
      const text2 = '寻找用于风险控制的MCP服务器';
      const text3 = '如何安装MCP服务器';

      const embedding1 = await getTextEmbedding(text1);
      const embedding2 = await getTextEmbedding(text2);
      const embedding3 = await getTextEmbedding(text3);

      const similarity12 = cosineSimilarity(embedding1, embedding2);
      const similarity13 = cosineSimilarity(embedding1, embedding3);

      // 相似文本的相似度应高于不相似文本
      expect(similarity12).toBeGreaterThan(similarity13);
    });
  });

  // 提供者切换测试
  describe('提供者切换', () => {
    test('应能在提供者之间切换', () => {
      // 切换到简单提供者
      useSimpleEmbeddingProvider();
      expect(logger.info).toHaveBeenCalledWith(
        'Switched to SimpleEmbeddingProvider',
      );

      // 切换到 Universal Sentence Encoder 提供者
      useUniversalSentenceEncoder();
      expect(logger.info).toHaveBeenCalledWith(
        'Switched to UniversalSentenceEncoderProvider',
      );
    });
  });
});
