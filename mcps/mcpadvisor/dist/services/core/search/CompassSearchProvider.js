/**
 * Default COMPASS API search provider implementation
 */
import { COMPASS_API_BASE } from '../../../config/constants.js';
import logger from '../../../utils/logger.js';
export class CompassSearchProvider {
    apiBase;
    constructor(apiBase = COMPASS_API_BASE) {
        this.apiBase = apiBase;
        logger.info(`CompassSearchProvider initialized with API base: ${this.apiBase}`);
    }
    /**
     * Search for MCP servers using the COMPASS API
     * @param query - The search query
     * @returns Promise with array of MCP server responses
     */
    async search(params) {
        const query = [params.taskDescription, ...(params.keywords || []), ...(params.capabilities || [])].join(' ').trim();
        try {
            logger.info(`Searching for MCP servers with query: ${query}`);
            const requestUrl = `${this.apiBase}/recommend?description=${encodeURIComponent(query)}`;
            const response = await fetch(requestUrl);
            if (!response.ok) {
                const errorMsg = `COMPASS API request failed with status ${response.status}`;
                const responseError = new Error(errorMsg);
                // 添加响应状态和文本信息
                responseError.status = response.status;
                responseError.statusText = response.statusText;
                responseError.url = requestUrl;
                // 使用增强的日志记录方式，传递完整错误对象
                logger.error(errorMsg, {
                    error: responseError,
                    data: {
                        url: requestUrl,
                        status: response.status,
                        statusText: response.statusText,
                    },
                });
                throw responseError;
            }
            const data = await response.json();
            logger.debug(`Received ${data.length} results from COMPASS API`);
            const res = [];
            for (const d of data) {
                res.push({
                    similarity: d.score,
                    sourceUrl: d.github_url,
                    ...d,
                });
            }
            return res;
        }
        catch (error) {
            // 使用增强的日志记录方式，传递完整错误对象
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`Error fetching from COMPASS API: ${message}`, {
                error,
                data: {
                    query,
                    provider: 'CompassSearchProvider',
                    apiBase: this.apiBase,
                    errorType: error instanceof Error ? error.constructor.name : typeof error,
                    timestamp: new Date().toISOString(),
                },
            });
            throw error;
        }
    }
}
