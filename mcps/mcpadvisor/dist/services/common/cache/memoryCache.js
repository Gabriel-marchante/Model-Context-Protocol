import logger from '../../../utils/logger.js';
/**
 * 内存缓存实现
 */
export class MemoryCache {
    cache = null;
    ttlMs;
    /**
     * 构造函数
     * @param ttlMs 缓存有效期（毫秒）
     */
    constructor(ttlMs = 3600000) {
        // 默认1小时
        this.ttlMs = ttlMs;
        logger.debug(`Created memory cache with TTL: ${ttlMs}ms`);
    }
    /**
     * 获取缓存数据
     */
    get() {
        if (!this.isValid()) {
            return null;
        }
        return this.cache?.data || null;
    }
    /**
     * 设置缓存数据
     */
    set(data) {
        this.cache = {
            data,
            timestamp: Date.now(),
        };
        logger.debug('Cache updated');
    }
    /**
     * 检查缓存是否有效
     */
    isValid() {
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
    clear() {
        this.cache = null;
        logger.debug('Cache cleared');
    }
}
