import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { RestServerTransport } from '@chatmcp/sdk/server/rest.js';
import { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { SERVER_NAME, SERVER_VERSION } from '../../../config/constants.js';
import { TransportType } from './types.js';
import { RecommendMcpServerToolHandler } from './tools/RecommendMcpServerToolHandler.js';
import { InstallMcpServerToolHandler } from './tools/InstallMcpServerToolHandler.js';
import { LogResourceHandler } from './resources/LogResourceHandler.js';
import express from 'express';
import { ExpressServer } from './transports/ExpressServer.js';
import { SourcesEndpoint } from './endpoints/SourcesEndpoint.js';
import { RequestHandlerFactory } from './handlers/RequestHandlerFactory.js';
import logger from '../../../utils/logger.js';
export class ServerService {
    server;
    searchService;
    toolHandlers = [];
    resourceHandlers = [];
    expressServer;
    constructor(searchService) {
        if (!searchService) {
            throw new Error('SearchService is required');
        }
        this.searchService = searchService;
        try {
            this.server = this.initializeServer();
            this.initializeToolHandlers();
            this.initializeResourceHandlers();
            this.registerHandlers();
            logger.info('ServerService initialized successfully');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown initialization error';
            logger.error(`Failed to initialize ServerService: ${message}`);
            throw error;
        }
    }
    initializeServer() {
        logger.info('Initializing ServerService', 'Server', {
            name: SERVER_NAME,
            version: SERVER_VERSION,
        });
        return new Server({ name: SERVER_NAME, version: SERVER_VERSION }, { capabilities: { tools: {}, resources: {} } });
    }
    initializeToolHandlers() {
        this.toolHandlers = [
            new RecommendMcpServerToolHandler(this.searchService),
            new InstallMcpServerToolHandler(),
        ];
    }
    initializeResourceHandlers() {
        this.resourceHandlers = [
            new LogResourceHandler(),
        ];
    }
    registerHandlers() {
        try {
            // Register listTools handler
            this.server.setRequestHandler(ListToolsRequestSchema, RequestHandlerFactory.createListToolsHandler(this.toolHandlers));
            // Register callTool handler
            this.server.setRequestHandler(CallToolRequestSchema, RequestHandlerFactory.createCallToolHandler(this.toolHandlers));
            // Register listResources handler
            this.server.setRequestHandler(ListResourcesRequestSchema, RequestHandlerFactory.createListResourcesHandler(this.resourceHandlers));
            // Register readResource handler
            this.server.setRequestHandler(ReadResourceRequestSchema, RequestHandlerFactory.createReadResourceHandler(this.resourceHandlers));
            logger.debug('Successfully registered all request handlers');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error during handler registration';
            logger.error(`Failed to register handlers: ${message}`);
            throw error; // Re-throw to prevent server from starting with invalid handlers
        }
    }
    async setupExpressServer(config) {
        const { ssePath: path = '/sse', messagePath = '/messages' } = config;
        const expressServer = new ExpressServer();
        expressServer.setupSSEEndpoint(path, messagePath, async (transport) => {
            await this.server.connect(transport);
        });
        expressServer.setupMessageEndpoint(messagePath);
        expressServer.setupHealthCheck(SERVER_NAME, SERVER_VERSION);
        const app = expressServer.getApp();
        const sourcesHandler = (req, res, next) => {
            SourcesEndpoint.handleRequest(req, res).catch(next);
        };
        app.post('/api/sources', express.json(), sourcesHandler);
        return expressServer;
    }
    async startWithStdio() {
        logger.info('Starting server with stdio transport');
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        logger.info(`${SERVER_NAME} Server running on stdio`);
    }
    async startWithSSE(config) {
        const { port, host = 'localhost' } = config;
        const baseUrl = `http://${host}:${port}`;
        const sseUrl = `${baseUrl}/sse`;
        const messagePath = config.messagePath || '/messages';
        const messagesUrl = `${baseUrl}${messagePath}`;
        logger.info('Starting server with SSE transport', { host, port });
        this.expressServer = await this.setupExpressServer(config);
        await this.expressServer.start(port, host);
        console.log(`\n${'='.repeat(70)}`);
        console.log(`🚀 Server is running on ${baseUrl}`);
        console.log(`🔌 SSE endpoint: ${sseUrl}`);
        console.log(`📨 Messages endpoint: ${messagesUrl}`);
        console.log(`${'='.repeat(70)}\n`);
        logger.info(`${SERVER_NAME} Server running on ${baseUrl}`);
    }
    /**
     * Start the server with REST transport
     */
    async startWithRest(config) {
        logger.info('Starting server with REST transport');
        const transport = new RestServerTransport({
            port: config.port,
            endpoint: config.endpoint,
        });
        await this.server.connect(transport);
        await transport.startServer();
    }
    async start(transportType = TransportType.STDIO, transportConfig) {
        try {
            switch (transportType) {
                case TransportType.SSE:
                    if (!transportConfig) {
                        throw new Error('SSE configuration required for SSE transport');
                    }
                    return this.startWithSSE(transportConfig);
                case TransportType.REST:
                    if (!transportConfig) {
                        throw new Error('Configuration required for REST transport');
                    }
                    return this.startWithRest(transportConfig);
                default:
                    return this.startWithStdio();
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`Failed to start server: ${message}`);
            throw error;
        }
    }
}
export * from './types.js';
