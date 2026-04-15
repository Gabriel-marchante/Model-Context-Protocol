/**
 * 文本向量化工具
 * 使用 TensorFlow.js 和 Universal Sentence Encoder 提供高质量的文本嵌入
 */
import * as tf from '@tensorflow/tfjs';
import * as use from '@tensorflow-models/universal-sentence-encoder';
import logger from './logger.js';

// 缓存配置
const CACHE_SIZE_LIMIT = 1000; // 最大缓存条目数
const DEFAULT_DIMENSIONS = 512; // Universal Sentence Encoder 默认输出维度

/**
 * 嵌入提供者接口
 * 允许插入不同的嵌入生成实现
 */
export interface EmbeddingProvider {
  /**
   * 生成文本嵌入
   * @param text 输入文本
   * @param dimensions 向量维度 (可能被忽略，取决于模型)
   * @returns 归一化的向量表示
   */
  generateEmbedding(text: string, dimensions?: number): Promise<number[]>;

  /**
   * 批量生成文本嵌入
   * @param texts 输入文本数组
   * @param dimensions 向量维度 (可能被忽略，取决于模型)
   * @returns 归一化的向量表示数组
   */
  generateEmbeddings(texts: string[], dimensions?: number): Promise<number[][]>;

  /**
   * 获取提供者名称
   */
  getName(): string;

  /**
   * 获取模型是否已加载
   */
  isModelLoaded(): boolean;

  /**
   * 确保模型已加载
   */
  ensureModelLoaded(): Promise<void>;
}

/**
 * 创建固定长度的零向量
 */
export const createZeroVector = (size: number): number[] =>
  new Array(size).fill(0);

/**
 * 向量归一化
 */
export const normalizeVector = (vector: number[]): number[] => {
  const magnitude = calculateMagnitude(vector);

  if (magnitude === 0 || !isFinite(magnitude)) {
    return vector;
  }

  return vector.map(val => val / magnitude);
};

/**
 * 计算向量幅度
 */
export const calculateMagnitude = (vector: number[]): number => {
  const sumOfSquares = vector.reduce((sum, val) => sum + val * val, 0);
  return Math.sqrt(sumOfSquares);
};

/**
 * 计算两个向量的余弦相似度
 */
export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (vecA.length !== vecB.length) {
    throw new Error(
      `Vector dimensions do not match: ${vecA.length} vs ${vecB.length}`,
    );
  }

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }

  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);

  if (magA === 0 || magB === 0) {
    return 0;
  }

  return dotProduct / (magA * magB);
};

/**
 * Universal Sentence Encoder 嵌入提供者
 * 使用 TensorFlow.js 的 USE 模型生成高质量的文本嵌入
 */
class UniversalSentenceEncoderProvider implements EmbeddingProvider {
  private model: use.UniversalSentenceEncoder | null = null;
  private modelLoading: Promise<void> | null = null;
  private fallbackProvider: EmbeddingProvider | null = null;

  constructor(fallbackProvider: EmbeddingProvider | null = null) {
    this.fallbackProvider = fallbackProvider;
    // 初始化时开始加载模型
    this.ensureModelLoaded().catch(err => {
      logger.error(
        `Failed to load Universal Sentence Encoder model: ${err.message}`,
        { error: err },
      );
    });
  }

  /**
   * 获取提供者名称
   */
  getName(): string {
    return 'UniversalSentenceEncoderProvider';
  }

  /**
   * 检查模型是否已加载
   */
  isModelLoaded(): boolean {
    return this.model !== null;
  }

  /**
   * 确保模型已加载
   */
  async ensureModelLoaded(): Promise<void> {
    // 如果模型已经加载，直接返回
    if (this.model !== null) {
      return;
    }

    // 如果模型正在加载，等待完成
    if (this.modelLoading !== null) {
      return this.modelLoading;
    }

    // 开始加载模型
    this.modelLoading = (async () => {
      try {
        logger.info('Loading Universal Sentence Encoder model...');
        // 加载模型
        this.model = await use.load();
        logger.info('Universal Sentence Encoder model loaded successfully');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(
          `Error loading Universal Sentence Encoder model: ${message}`,
          { error },
        );
        // 重置加载状态，允许重试
        this.modelLoading = null;
        throw error;
      }
    })();

    return this.modelLoading;
  }

  /**
   * 生成单个文本的嵌入
   */
  async generateEmbedding(
    text: string,
    dimensions?: number,
  ): Promise<number[]> {
    try {
      // 确保模型已加载
      await this.ensureModelLoaded();

      if (!text) {
        return createZeroVector(DEFAULT_DIMENSIONS);
      }

      if (!this.model) {
        throw new Error('Model not loaded');
      }

      // 使用模型生成嵌入
      const embeddings = await this.model.embed(text);

      // 转换为 JavaScript 数组
      const embeddingArray = await embeddings.array();
      const result = embeddingArray[0];

      // 释放张量资源
      embeddings.dispose();

      // 归一化向量
      return normalizeVector(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(
        `Error generating embedding with Universal Sentence Encoder: ${message}`,
        { error, text },
      );

      // 如果有备用提供者，使用备用提供者
      if (this.fallbackProvider) {
        logger.warn(
          `Falling back to ${this.fallbackProvider.getName()} for embedding generation`,
        );
        return this.fallbackProvider.generateEmbedding(text, dimensions);
      }

      // 如果没有备用提供者，抛出错误
      throw error;
    }
  }

  /**
   * 批量生成文本嵌入
   */
  async generateEmbeddings(
    texts: string[],
    dimensions?: number,
  ): Promise<number[][]> {
    try {
      // 确保模型已加载
      await this.ensureModelLoaded();

      if (!texts || texts.length === 0) {
        return [];
      }

      if (!this.model) {
        throw new Error('Model not loaded');
      }

      // 使用模型生成嵌入
      const embeddings = await this.model.embed(texts);

      // 转换为 JavaScript 数组
      const embeddingArrays = await embeddings.array();

      // 释放张量资源
      embeddings.dispose();

      // 归一化所有向量
      return embeddingArrays.map(vector => normalizeVector(vector));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(
        `Error generating batch embeddings with Universal Sentence Encoder: ${message}`,
        { error, textCount: texts.length },
      );

      // 如果有备用提供者，使用备用提供者
      if (this.fallbackProvider) {
        logger.warn(
          `Falling back to ${this.fallbackProvider.getName()} for batch embedding generation`,
        );
        return this.fallbackProvider.generateEmbeddings(texts, dimensions);
      }

      // 如果没有备用提供者，抛出错误
      throw error;
    }
  }
}

/**
 * 简单嵌入提供者
 * 使用基本的哈希和字符编码方法生成向量
 * 作为备用提供者，当主要提供者失败时使用
 */
class SimpleEmbeddingProvider implements EmbeddingProvider {
  /**
   * 获取提供者名称
   */
  getName(): string {
    return 'SimpleEmbeddingProvider';
  }

  /**
   * 模型始终被认为已加载
   */
  isModelLoaded(): boolean {
    return true;
  }

  /**
   * 简单提供者不需要加载模型
   */
  async ensureModelLoaded(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * 生成单个文本的嵌入
   */
  async generateEmbedding(
    text: string,
    dimensions: number = DEFAULT_DIMENSIONS,
  ): Promise<number[]> {
    if (!text) {
      return createZeroVector(dimensions);
    }

    // 创建初始向量
    const vector = createZeroVector(dimensions);

    // 使用简单的算法更新向量
    const updatedVector = this.generateVectorFromText(text, vector, dimensions);

    // 归一化向量
    return normalizeVector(updatedVector);
  }

  /**
   * 批量生成文本嵌入
   */
  async generateEmbeddings(
    texts: string[],
    dimensions: number = DEFAULT_DIMENSIONS,
  ): Promise<number[][]> {
    return Promise.all(
      texts.map(text => this.generateEmbedding(text, dimensions)),
    );
  }

  /**
   * 使用简单的算法从文本生成向量
   */
  protected generateVectorFromText(
    text: string,
    vector: number[],
    dimensions: number,
  ): number[] {
    const result = [...vector];
    const normalizedText = text.toLowerCase();

    // 基本字符编码映射
    for (let i = 0; i < normalizedText.length; i++) {
      const charCode = normalizedText.charCodeAt(i);
      result[i % dimensions] += charCode / 255;
    }

    // 添加n-gram特征
    this.addNgramFeatures(normalizedText, result, dimensions);

    return result;
  }

  /**
   * 添加n-gram特征
   */
  protected addNgramFeatures(
    text: string,
    vector: number[],
    dimensions: number,
  ): void {
    // 处理2-gram和3-gram
    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i < text.length - n + 1; i++) {
        const ngram = text.substring(i, i + n);
        const hash = this.simpleHash(ngram);
        const position = hash % dimensions;
        vector[position] += 0.5; // 较小的权重
      }
    }
  }

  /**
   * 简单的字符串哈希函数
   */
  protected simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

/**
 * 嵌入缓存类
 * 使用LRU策略缓存生成的嵌入
 */
class EmbeddingCache {
  private cache: Map<string, number[]>;
  private keyOrder: string[];
  private readonly maxSize: number;

  constructor(maxSize: number = CACHE_SIZE_LIMIT) {
    this.cache = new Map<string, number[]>();
    this.keyOrder = [];
    this.maxSize = maxSize;
  }

  /**
   * 获取缓存的嵌入
   */
  get(key: string): number[] | undefined {
    const value = this.cache.get(key);

    if (value) {
      // 更新LRU顺序
      this.keyOrder = this.keyOrder.filter(k => k !== key);
      this.keyOrder.push(key);
    }

    return value;
  }

  /**
   * 设置缓存的嵌入
   */
  set(key: string, value: number[]): void {
    // 如果缓存已满，移除最久未使用的项
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.keyOrder.shift();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    // 添加新项
    this.cache.set(key, value);
    this.keyOrder = this.keyOrder.filter(k => k !== key);
    this.keyOrder.push(key);
  }

  /**
   * 清除缓存
   */
  clear(): void {
    this.cache.clear();
    this.keyOrder = [];
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }
}

// 创建全局缓存实例
const embeddingCache = new EmbeddingCache();

// 创建简单嵌入提供者作为备用
const simpleProvider = new SimpleEmbeddingProvider();

// 创建主要嵌入提供者
const mainProvider = new UniversalSentenceEncoderProvider(simpleProvider);

// 默认使用 Universal Sentence Encoder 提供者
let currentProvider: EmbeddingProvider = mainProvider;

/**
 * 设置当前嵌入提供者
 */
export const setEmbeddingProvider = (provider: EmbeddingProvider): void => {
  currentProvider = provider;
  // 切换提供者时清除缓存
  embeddingCache.clear();
};

/**
 * 获取当前嵌入提供者
 */
export const getEmbeddingProvider = (): EmbeddingProvider => currentProvider;

/**
 * 生成缓存键
 */
const generateCacheKey = (text: string, dimensions: number): string =>
  `${text}_${dimensions}_${currentProvider.getName()}`;

/**
 * 将文本转换为向量表示
 * @param text 输入文本
 * @param dimensions 向量维度
 * @returns 归一化的向量表示
 */
export const getTextEmbedding = async (
  text: string,
  dimensions: number = DEFAULT_DIMENSIONS,
): Promise<number[]> => {
  if (!text) {
    return createZeroVector(dimensions);
  }

  // 生成缓存键
  const cacheKey = generateCacheKey(text, dimensions);

  // 检查缓存
  const cachedVector = embeddingCache.get(cacheKey);
  if (cachedVector) {
    return cachedVector;
  }

  try {
    // 使用当前提供者生成嵌入
    const vector = await currentProvider.generateEmbedding(text, dimensions);

    // 缓存结果
    embeddingCache.set(cacheKey, vector);

    return vector;
  } catch (error) {
    logger.error(
      `Error generating embedding: ${error instanceof Error ? error.message : String(error)}`,
      { error },
    );

    // 如果出错，返回零向量
    return createZeroVector(dimensions);
  }
};

/**
 * 批量生成文本嵌入
 * @param texts 输入文本数组
 * @param dimensions 向量维度
 * @returns 归一化的向量表示数组
 */
export const getTextEmbeddings = async (
  texts: string[],
  dimensions: number = DEFAULT_DIMENSIONS,
): Promise<number[][]> => {
  if (!texts || texts.length === 0) {
    return [];
  }

  try {
    // 尝试使用批量生成
    return await currentProvider.generateEmbeddings(texts, dimensions);
  } catch (error) {
    logger.error(
      `Error generating batch embeddings: ${error instanceof Error ? error.message : String(error)}`,
      { error },
    );

    // 如果出错，返回零向量数组
    return texts.map(() => createZeroVector(dimensions));
  }
};

/**
 * 清除嵌入缓存
 */
export const clearEmbeddingCache = (): void => {
  embeddingCache.clear();
};

/**
 * 切换到简单嵌入提供者
 * 当需要轻量级处理或主要提供者失败时使用
 */
export const useSimpleEmbeddingProvider = (): void => {
  setEmbeddingProvider(simpleProvider);
  logger.info('Switched to SimpleEmbeddingProvider');
};

/**
 * 切换到 Universal Sentence Encoder 嵌入提供者
 * 提供高质量的文本嵌入
 */
export const useUniversalSentenceEncoder = (): void => {
  setEmbeddingProvider(mainProvider);
  logger.info('Switched to UniversalSentenceEncoderProvider');
};

// 初始化时预加载模型
mainProvider.ensureModelLoaded().catch(err => {
  logger.warn(
    `Failed to preload Universal Sentence Encoder model: ${err.message}. Will use fallback provider.`,
    { error: err },
  );
  // 如果预加载失败，切换到简单提供者
  useSimpleEmbeddingProvider();
});
