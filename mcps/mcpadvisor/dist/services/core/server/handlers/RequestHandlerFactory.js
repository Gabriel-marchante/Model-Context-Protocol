import logger from '../../../../utils/logger.js';
export class RequestHandlerFactory {
    static createListToolsHandler(toolHandlers) {
        return async () => {
            logger.debug('Handling ListTools request');
            return {
                tools: toolHandlers.map(handler => handler.getToolDefinition()),
            };
        };
    }
    static createCallToolHandler(toolHandlers) {
        return async (request) => {
            const { name } = request.params;
            logger.info(`Handling tool call: ${name}`);
            try {
                const handler = toolHandlers.find(h => h.canHandle(name));
                if (!handler) {
                    return RequestHandlerFactory.createErrorResponse(`Unknown tool: ${name}`);
                }
                return await handler.handleRequest(request);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                logger.error(`Error handling request: ${message}`);
                return RequestHandlerFactory.createErrorResponse(message);
            }
        };
    }
    static createListResourcesHandler(resourceHandlers) {
        return async () => {
            logger.debug('Handling ListResources request');
            try {
                const allResources = [];
                for (const handler of resourceHandlers) {
                    const resources = await handler.listResources();
                    allResources.push(...resources);
                }
                logger.info(`Listed ${allResources.length} resources`);
                return { resources: allResources };
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                logger.error(`Error listing resources: ${message}`);
                return { resources: [] };
            }
        };
    }
    static createReadResourceHandler(resourceHandlers) {
        return async (request) => {
            const { uri } = request.params;
            logger.info(`Handling resource read: ${uri}`);
            try {
                // Find a handler that supports this URI
                let supportingHandler = null;
                for (const handler of resourceHandlers) {
                    const supports = typeof handler.supportsUri === 'function'
                        ? await handler.supportsUri(uri)
                        : handler.supportsUri(uri);
                    if (supports) {
                        supportingHandler = handler;
                        break;
                    }
                }
                if (!supportingHandler) {
                    const errorMessage = `No handler found for URI: ${uri}`;
                    logger.error(errorMessage);
                    return RequestHandlerFactory.createErrorResponse(errorMessage);
                }
                const content = await supportingHandler.readResource(uri);
                logger.info(`Successfully read resource: ${uri}`);
                return content;
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                logger.error(`Error reading resource: ${message}`, 'RequestHandlerFactory', { error, uri });
                return RequestHandlerFactory.createErrorResponse(message);
            }
        };
    }
    static createErrorResponse(message) {
        return {
            content: [{
                    type: 'text',
                    text: `Error: ${message}`,
                }],
            isError: true,
        };
    }
}
