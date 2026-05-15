import { IReadmeContentExtractor } from './interfaces/IReadmeContentExtractor.js';
import { InstallationGuideContext, InstallationContentType } from './types/InstallationGuideTypes.js';
import { GitHubReadmeExtractor } from './extractors/GitHubReadmeExtractor.js';
import { ExtractorFactory } from './factories/ExtractorFactory.js';
import { FormatterFactory } from './factories/FormatterFactory.js';
import logger from '../../../utils/logger.js';

/**
 * Installation Guide Service
 * Follows SOLID principles with dependency injection and separation of concerns
 * 
 * Single Responsibility: Orchestrates the installation guide generation process
 * Open/Closed: Extensible through new extractors and formatters without modification
 * Liskov Substitution: All extractors and formatters are interchangeable
 * Interface Segregation: Focused interfaces for specific responsibilities
 * Dependency Inversion: Depends on abstractions, not concrete implementations
 */
export class InstallationGuideService {
  private readonly readmeExtractor: IReadmeContentExtractor;

  /**
   * Constructor with dependency injection
   * @param readmeExtractor - README content extractor (defaults to GitHub extractor)
   */
  constructor(readmeExtractor?: IReadmeContentExtractor) {
    this.readmeExtractor = readmeExtractor || new GitHubReadmeExtractor();
  }

  /**
   * Generate MCP installation guide
   * Main orchestration method that coordinates different components
   *
   * @param githubUrl - GitHub repository URL
   * @param mcpName - MCP name
   * @returns Installation guide content
   */
  public async generateInstallationGuide(
    githubUrl: string,
    mcpName: string,
  ): Promise<string> {
    try {
      // Step 1: Extract README content
      const readmeContent = await this.readmeExtractor.extractReadmeContent(githubUrl);

      if (!readmeContent) {
        return this.generateDefaultGuide(mcpName, githubUrl);
      }

      // Step 2: Create installation guide context
      const context = await this.createInstallationGuideContext(
        readmeContent,
        mcpName,
        githubUrl,
      );

      // Step 3: Select appropriate formatter and generate guide
      const formatter = FormatterFactory.getBestFormatter(context);
      const result = formatter.formatGuide(context);

      if (!result.success) {
        logger.error(`Failed to format guide: ${result.error}`);
        return this.generateDefaultGuide(mcpName, githubUrl);
      }

      return result.content;
    } catch (error) {
      logger.error(
        `Failed to generate installation guide: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.generateDefaultGuide(mcpName, githubUrl);
    }
  }

  /**
   * Create installation guide context by extracting relevant information
   * @param readmeContent - README content
   * @param mcpName - MCP name
   * @param githubUrl - GitHub repository URL
   * @returns Installation guide context
   */


  private async createInstallationGuideContext(
    readmeContent: string,
    mcpName: string,
    githubUrl: string,
  ): Promise<InstallationGuideContext> {
    // Extract repository name from URL
    const repoName = this.extractRepoName(githubUrl);

    // Select best extractor for the content
    const extractor = ExtractorFactory.getBestExtractor(readmeContent);

    // Extract installation section
    const installationSection = extractor.extractInstallationSection(readmeContent);

    return {
      mcpName,
      githubUrl,
      repoName,
      installationSection,
    };
  }

  /**
   * Generate default installation guide when README is not available
   * @param mcpName - MCP name
   * @param githubUrl - GitHub repository URL
   * @returns Default installation guide
   */
  private generateDefaultGuide(mcpName: string, githubUrl: string): string {
    const repoName = this.extractRepoName(githubUrl);
    
    let guide = `我将指导你如何安装和配置 ${mcpName} MCP 服务器。\n\n`;
    guide += `GitHub 仓库地址：${githubUrl}\n\n`;
    guide += `## 安装步骤\n\n`;
    guide += `由于无法获取项目的 README 文档，请按照以下通用步骤进行安装：\n\n`;
    
    guide += `1. **克隆仓库**：\n`;
    guide += `   \`\`\`bash\n   git clone ${githubUrl}\n   \`\`\`\n\n`;
    guide += `2. **进入项目目录**：\n`;
    guide += `   \`\`\`bash\n   cd ${repoName}\n   \`\`\`\n\n`;
    guide += `3. **安装依赖**：\n`;
    guide += `   \`\`\`bash\n   npm install\n   \`\`\`\n\n`;
    guide += `4. **查看项目文档**：\n`;
    guide += `   请查看项目中的 README.md、package.json 或其他文档文件了解具体的安装和配置步骤。\n\n`;
    
    guide += `## MCP 配置\n\n`;
    guide += `如果这是一个 MCP 服务器，你可能需要：\n\n`;
    guide += `1. 查看项目文档了解如何配置 MCP 客户端\n`;
    guide += `2. 将服务器配置添加到 Claude Desktop 或其他 MCP 客户端的配置文件中\n`;
    guide += `3. 重启 MCP 客户端以加载新配置\n\n`;
    
    guide += `## 需要帮助？\n\n`;
    guide += `- 查看项目的 [GitHub 页面](${githubUrl}) 获取最新文档\n`;
    guide += `- 查看项目的 [Issues 页面](${githubUrl}/issues) 寻找解决方案\n`;
    guide += `- 创建新的 Issue 寻求帮助\n`;

    return guide;
  }

  /**
   * Extract repository name from GitHub URL
   * @param githubUrl - GitHub repository URL
   * @returns Repository name
   */
  /**
   * Extract repository name from GitHub URL
   * (kept public for backward-compatibility with existing tests)
   */
  private extractRepoName(githubUrl: string): string {
    try {
      const url = new URL(githubUrl);
      const pathParts = url.pathname.split('/').filter(part => part.length > 0);
      let repo = pathParts[1] || 'unknown-repo';
      // Remove .git suffix if present for compatibility with legacy tests
      if (repo.endsWith('.git')) {
        repo = repo.replace(/\.git$/i, '');
      }
      return repo;
    } catch {
      return 'unknown-repo';
    }
  }
}
