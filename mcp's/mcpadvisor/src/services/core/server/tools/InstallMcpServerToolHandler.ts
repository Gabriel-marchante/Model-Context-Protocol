import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { InstallationGuideService } from '../../installation/installationGuideService.js';
import { ConfigurationGuideService } from '../../installation/configurationGuideService.js';
import { BaseToolHandler } from './BaseToolHandler.js';
import { GeneralArgumentsSchema } from '../types.js';
import logger from '../../../../utils/logger.js';

export class InstallMcpServerToolHandler extends BaseToolHandler {
  private installationGuideService: InstallationGuideService;
  private configurationGuideService: ConfigurationGuideService;

  constructor() {
    super();
    this.installationGuideService = new InstallationGuideService();
    this.configurationGuideService = new ConfigurationGuideService();
  }

  getToolDefinition() {
    return {
      name: 'install-mcp-server',
      description: `
        此工具用于安装MCP服务器。
        请告诉我您想要安装哪个 MCP 以及其来源 Url比如 githubUrl，我将会告诉您如何安装对应的 MCP，
        并指导您在不同AI助手环境中正确配置MCP服务器。
      `,
      inputSchema: {
        type: 'object',
        properties: {
          mcpName: {
            type: 'string',
            description: `请输入您想要安装的MCP名称。`,
          },
          sourceUrl: {
            type: 'string',
            description: `请输入您想要安装的MCP的来源 Url。`,
          },
          mcpClient: {
            type: 'string',
            description: `可选，请指定您使用的MCP客户端（如Claude Desktop、Windsurf、Cursor、Cline等）。不同客户端的配置方式可能不同。`,
          },
        },
        required: ['mcpName', 'sourceUrl'],
      },
    };
  }

  canHandle(name: string): boolean {
    return name === 'install-mcp-server';
  }

  async handleRequest(request: typeof CallToolRequestSchema._type) {
    try {
      const { arguments: args } = request.params;
      const parsedArgs = GeneralArgumentsSchema.parse(args);
      const mcpName = parsedArgs.mcpName;
      const sourceUrl = parsedArgs.sourceUrl;
      const mcpClient = parsedArgs.mcpClient || '';

      if (!mcpName || !sourceUrl) {
        return this.createErrorResponse('Both mcpName and Url parameters are required for install-mcp-server tool');
      }

      logger.info('Processing install-mcp-server request', 'Installation', {
        mcpName,
        sourceUrl,
        mcpClient,
      });
      const installationGuide = await this.installationGuideService.generateInstallationGuide(
        sourceUrl,
        mcpName,
      );

      // Generate client-specific configuration guide
      const configGuide = this.configurationGuideService.generateConfigurationGuide(
        mcpName,
        mcpClient,
      );

      // Combine installation guide and configuration guide
      const completeGuide = `${installationGuide}\n\n${configGuide}`;

      return this.createSuccessResponse(completeGuide);
    } catch (error) {
      logger.error(
        `Error in InstallMcpServerToolHandler: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.createErrorResponse('Failed to process installation request');
    }
  }
}
