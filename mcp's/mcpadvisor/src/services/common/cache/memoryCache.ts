import { ICache, CacheEntry } from '../../interfaces/cache.js';
import logger from '../../../utils/logger.js';

/**
 * 内存缓存实现
 */
export class MemoryCache<T> implements ICache<T> {
  private cache: CacheEntry<T> | null = null;
  private ttlMs: number;

  /**
   * 构造函数
   * @param ttlMs 缓存有效期（毫秒）
   */
  constructor(ttlMs: number = 3600000) {
    // 默认1小时
    this.ttlMs = ttlMs;
    logger.debug(`Created memory cache with TTL: ${ttlMs}ms`);
  }

  /**
   * 获取缓存数据
   */
  get(): T | null {
    if (!this.isValid()) {
      return null;
    }

    return this.cache?.data || null;
  }

  /**
   * 设置缓存数据
   */
  set(data: T): void {
    this.cache = {
      data,
      timestamp: Date.now(),
    };

    logger.debug('Cache updated');
  }

  /**
   * 检查缓存是否有效
   */
  isValid(): boolean {
    if (!this.cache) {
      return false;
    }

    const isValid = Date.now() - this.cache.timestamp <= this.ttlMs;

    if (!isValid) {
      this.clear();
    }

    return isValid;
  }

  /**
   * 清除缓存
   */
  clear(): void {
    this.cache = null;
    logger.debug('Cache cleared');
  }
}
