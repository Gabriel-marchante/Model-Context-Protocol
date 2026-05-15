import { InMemoryVectorEngine } from './providers/offline/vectorEngine.js';
import { OceanBaseVectorEngine } from './providers/oceanbase/vectorEngine.js';
import { MeilisearchVectorEngine } from './providers/meilisearch/vectorEngine.js';
import { VECTOR_ENGINE_TYPE, OCEANBASE_URL } from '../config/constants.js';
import logger from '../utils/logger.js';
/**
 * 向量引擎类型
 */
export var VectorEngineType;
(function (VectorEngineType) {
    VectorEngineType["MEMORY"] = "memory";
    VectorEngineType["OCEANBASE"] = "oceanbase";
    VectorEngineType["MEILISEARCH"] = "meilisearch";
})(VectorEngineType || (VectorEngineType = {}));
/**
 * 解析向量引擎类型
 */
const parseEngineType = (typeString) => {
    if (typeString === 'oceanbase') {
        return VectorEngineType.OCEANBASE;
    }
    if (typeString === 'meilisearch') {
        return VectorEngineType.MEILISEARCH;
    }
    return VectorEngineType.MEMORY;
};
/**
 * 创建内存向量引擎
 */
const createMemoryEngine = () => {
    logger.info('Creating in-memory vector engine');
    return new InMemoryVectorEngine();
};
/**
 * 创建 OceanBase 向量引擎
 */
const createOceanBaseEngine = () => {
    logger.info('Creating OceanBase vector engine');
    return new OceanBaseVectorEngine();
};
/**
 * 创建 Meilisearch 向量引擎
 */
const createMeilisearchEngine = () => {
    logger.info('Creating Meilisearch vector engine');
    return new MeilisearchVectorEngine();
};
/**
 * 向量引擎工厂
 */
export class VectorEngineFactory {
    /**
     * 创建向量引擎实例
     */
    static createEngine(type) {
        // 如果未指定类型，使用环境变量配置
        const engineType = type || parseEngineType(VECTOR_ENGINE_TYPE);
        switch (engineType) {
            case VectorEngineType.OCEANBASE:
                // 如果选择了 OceanBase 但未配置 URL，则回退到内存引擎
                if (!OCEANBASE_URL) {
                    logger.warn('OCEANBASE_URL is not set, falling back to in-memory vector engine');
                    return createMemoryEngine();
                }
                return createOceanBaseEngine();
            case VectorEngineType.MEILISEARCH:
                return createMeilisearchEngine();
            case VectorEngineType.MEMORY:
            default:
                return createMemoryEngine();
        }
    }
}
