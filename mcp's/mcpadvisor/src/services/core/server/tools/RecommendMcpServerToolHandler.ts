import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { SearchService } from '../../../searchService.js';
import { formatServersToMCPContent } from '../../../../utils/formatter.js';
import { BaseToolHandler } from './BaseToolHandler.js';
import { GeneralArgumentsSchema } from '../types.js';
import logger from '../../../../utils/logger.js';

export class RecommendMcpServerToolHandler extends BaseToolHandler {
  constructor(private searchService: SearchService) {
    super();
  }

  getToolDefinition() {
    return {
      name: 'recommend-mcp-servers',
      description: `
        此工具用于寻找合适且专业MCP服务器。
        基于您的具体需求，从互联网资源库以及内部MCP库中筛选并推荐最适合的MCP服务器解决方案。
        返回结果包含服务器名称、功能描述、所属类别，为您的业务成功提供精准技术支持。
      `,
      inputSchema: {
        type: 'object',
        properties: {
          taskDescription: {
            type: 'string',
            description: `
              请提供所需MCP服务器的精确任务描述。
              
              有效查询示例：
              - '用于风控策略部署的MCP服务器'
              - '保险产品精算定价的MCP服务器'
              
              无效查询示例：
              - '保险MCP服务器'（过于宽泛）
              - '风控系统'（缺乏具体保险场景）
              - '精算工具'（未指明具体功能需求）
              
              查询应明确指定：
              1. 业务流程（如产品定价、核保、理赔、准备金计算等）
              2. 具体功能需求（如风险分析、策略部署、策略研发、特征研发等）
            `,
          },
          keywords: {
            type: 'array',
            items: { type: 'string' },
            description: '当前任务对应的搜索关键词列表，当提供关键词会优先对 MCP Server 筛选',
            default: [],
          },
          capabilities: {
            type: 'array',
            items: { type: 'string' },
            description: '当前任务所需功能列表，当提供功能列表会综合任务描述和功能列表对 MCP Server 筛选',
            default: [],
          },
        },
        required: ['taskDescription'],
      },
    };
  }

  canHandle(name: string): boolean {
    return name === 'recommend-mcp-servers';
  }

  async handleRequest(request: typeof CallToolRequestSchema._type) {
    try {
      const { arguments: args } = request.params;
      const parsedArgs = GeneralArgumentsSchema.parse(args);
      const { taskDescription, keywords = [], capabilities = [] } = parsedArgs;
      
      if (!taskDescription) {
        return this.createErrorResponse('taskDescription parameter is required for recommend-mcp-servers tool');
      }

      logger.info('Processing recommend-mcp-servers request', 'Search', {
        taskDescription,
        keywords,
        capabilities,
      });

      const searchParams = {
        taskDescription,
        keywords: Array.isArray(keywords) ? keywords : [keywords].filter(Boolean),
        capabilities: Array.isArray(capabilities) ? capabilities : [capabilities].filter(Boolean),
      };

      const servers = await this.searchService.search(searchParams);
      logger.debug('Found servers matching query', 'Search', {
        count: servers.length,
        taskDescription,
      });

      return this.createSuccessResponse(formatServersToMCPContent(servers));
    } catch (error) {
      logger.error(
        `Error in RecommendMcpServerToolHandler: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.createErrorResponse('Failed to process recommendation request');
    }
  }
}
