/**
 * 缓存条目接口
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * 缓存接口
 */
export interface ICache<T> {
  /**
   * 获取缓存数据
   */
  get(): T | null;

  /**
   * 设置缓存数据
   * @param data 要缓存的数据
   */
  set(data: T): void;

  /**
   * 检查缓存是否有效
   */
  isValid(): boolean;

  /**
   * 清除缓存
   */
  clear(): void;
}
