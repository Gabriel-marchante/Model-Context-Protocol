import express from 'express';
import cors from 'cors';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import logger from '../../../../utils/logger.js';
export class ExpressServer {
    app;
    sseTransports = {};
    constructor() {
        this.app = express();
        this.app.use(cors());
    }
    getApp() {
        return this.app;
    }
    setupSSEEndpoint(path, messagePath, onConnect) {
        // Define the SSE handler with proper typing
        const sseHandler = async (req, res, next) => {
            try {
                const transport = new SSEServerTransport(messagePath, res);
                this.sseTransports[transport.sessionId] = transport;
                res.on('close', () => {
                    logger.info(`SSE connection closed for session ${transport.sessionId}`);
                    delete this.sseTransports[transport.sessionId];
                });
                logger.info(`New SSE connection started on ${path}`);
                await onConnect(transport);
                logger.info(`SSE connection established for session ${transport.sessionId}`);
            }
            catch (error) {
                logger.error(`Error connecting transport: ${error instanceof Error ? error.message : String(error)}`);
                next(error);
            }
        };
        // Register the handler with Express
        this.app.get(path, (req, res, next) => {
            sseHandler(req, res, next).catch(next);
        });
    }
    setupMessageEndpoint(path) {
        const messageHandler = async (req, res, next) => {
            const sessionId = req.query.sessionId;
            logger.info(`Received message for session ${sessionId}`);
            const transport = this.sseTransports[sessionId];
            if (!transport) {
                logger.warn(`No transport found for session ${sessionId}`);
                res.status(400).json({ error: 'No transport found for sessionId' });
                return;
            }
            try {
                await transport.handlePostMessage(req, res);
            }
            catch (error) {
                logger.error(`Error handling message: ${error instanceof Error ? error.message : String(error)}`);
                next(error);
            }
        };
        this.app.post(path, (req, res, next) => {
            messageHandler(req, res, next).catch(next);
        });
    }
    setupHealthCheck(serverName, version) {
        this.app.get('/health', (_, res) => {
            res.status(200).json({
                status: 'ok',
                server: serverName,
                version,
                connections: Object.keys(this.sseTransports).length,
            });
        });
    }
    start(port, host) {
        return new Promise((resolve, reject) => {
            try {
                this.app.listen(port, host, () => {
                    logger.info(`Server running on http://${host}:${port}`);
                    resolve();
                }).on('error', reject);
            }
            catch (error) {
                reject(error);
            }
        });
    }
}
