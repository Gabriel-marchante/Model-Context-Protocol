import { NacosHttpClient } from './NacosHttpClient.js';
import logger from '../../../utils/logger.js';
import { VectorDB } from '../../common/vector/VectorDB.js';
export class NacosClient {
    config;
    httpClient;
    vectorDB = null;
    isInitialized = false;
    services = [];
    constructor(config) {
        this.config = config;
        this.httpClient = new NacosHttpClient(config.serverAddr, config.username, config.password);
    }
    async init() {
        if (this.isInitialized) {
            return;
        }
        try {
            // Check if Nacos server is reachable
            const isReady = await this.httpClient.isReady();
            if (!isReady) {
                throw new Error('Failed to connect to Nacos server');
            }
            // Initialize vector database
            this.vectorDB = new VectorDB();
            await this.vectorDB.start();
            await this.vectorDB.isReady();
            // Load initial services
            await this.loadServices();
            logger.info('Successfully connected to Nacos server and initialized vector database');
            this.isInitialized = true;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Failed to initialize NacosClient: ${errorMessage}`);
            throw error;
        }
    }
    /**
     * Load services from Nacos server
     */
    async loadServices() {
        try {
            // This is a simplified example - you'll need to implement the actual Nacos API call
            // to fetch services
            this.services = [];
            logger.info('Loaded services from Nacos server');
        }
        catch (error) {
            logger.error('Failed to load services from Nacos:', error);
            throw error;
        }
    }
    /**
     * Get all services from Nacos
     */
    async getAllServices() {
        if (!this.isInitialized) {
            throw new Error('NacosClient is not initialized');
        }
        return this.services;
    }
    /**
     * Get service details from Nacos server
     * @param serviceName The name of the service to fetch details for
     * @param groupName The group name of the service (default: 'DEFAULT_GROUP')
     * @returns Service details including metadata
     * @throws {Error} If the client is not initialized or service details cannot be fetched
     */
    async getServiceDetail(serviceName, groupName = 'DEFAULT_GROUP') {
        if (!this.isInitialized) {
            throw new Error('NacosClient is not initialized');
        }
        return this.httpClient.getServiceDetail(serviceName, groupName);
    }
    /**
     * Connect to Nacos server (alias for init)
     */
    async connect() {
        return this.init();
    }
    /**
     * Disconnect from Nacos server
     */
    async close() {
        if (this.vectorDB) {
            await this.vectorDB.clear();
        }
        this.isInitialized = false;
        logger.info('Disconnected from Nacos server');
    }
    /**
     * Alias for close() for backward compatibility
     */
    async disconnect() {
        return this.close();
    }
    async searchMcpByKeyword(keyword) {
        if (!this.isInitialized) {
            throw new Error('NacosClient is not initialized. Call init() first.');
        }
        try {
            const results = [];
            const services = await this.getAllServices();
            const searchTerm = keyword.toLowerCase();
            for (const service of services) {
                const serviceText = `${service.name} ${service.groupName}`.toLowerCase();
                if (serviceText.includes(searchTerm)) {
                    const detail = await this.getServiceDetail(service.name, service.groupName);
                    results.push({
                        name: service.name,
                        description: detail.metadata?.description || '',
                        agentConfig: {
                            name: service.name,
                            description: detail.metadata?.description,
                            tags: detail.metadata?.tags || [],
                            ...detail.metadata
                        },
                        mcpConfigDetail: null,
                        getName: () => service.name,
                        getDescription: () => detail.metadata?.description || '',
                        getAgentConfig: () => ({
                            name: service.name,
                            description: detail.metadata?.description,
                            tags: detail.metadata?.tags || [],
                            ...detail.metadata
                        }),
                        toDict: () => ({
                            name: service.name,
                            description: detail.metadata?.description,
                            agentConfig: {
                                name: service.name,
                                description: detail.metadata?.description,
                                tags: detail.metadata?.tags || [],
                                ...detail.metadata
                            },
                            mcpConfigDetail: null
                        })
                    });
                }
            }
            return results;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error searching MCP servers by keyword '${keyword}': ${errorMessage}`);
            throw error;
        }
    }
    async getMcpServer(description, limit = 10) {
        if (!this.isInitialized) {
            throw new Error('NacosClient is not initialized. Call init() first.');
        }
        try {
            const services = await this.getAllServices();
            const results = [];
            for (let i = 0; i < Math.min(limit, services.length); i++) {
                const service = services[i];
                const detail = await this.getServiceDetail(service.name, service.groupName);
                results.push({
                    name: service.name,
                    description: detail.metadata?.description || `Service ${service.name} in group ${service.groupName}`,
                    agentConfig: {
                        name: service.name,
                        description: detail.metadata?.description,
                        tags: detail.metadata?.tags || [],
                        ...detail.metadata
                    },
                    mcpConfigDetail: null,
                    getName: () => service.name,
                    getDescription: () => detail.metadata?.description || '',
                    getAgentConfig: () => ({
                        name: service.name,
                        description: detail.metadata?.description,
                        tags: detail.metadata?.tags || [],
                        ...detail.metadata
                    }),
                    toDict: () => ({
                        name: service.name,
                        description: detail.metadata?.description,
                        agentConfig: {
                            name: service.name,
                            description: detail.metadata?.description,
                            tags: detail.metadata?.tags || [],
                            ...detail.metadata
                        },
                        mcpConfigDetail: null
                    })
                });
            }
            return results;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error getting MCP server '${description}': ${errorMessage}`);
            throw error;
        }
    }
}
