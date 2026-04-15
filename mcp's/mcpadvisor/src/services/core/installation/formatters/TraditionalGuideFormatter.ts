import { IInstallationGuideFormatter } from '../interfaces/IInstallationGuideFormatter.js';
import { InstallationGuideContext, GuideGenerationResult, InstallationContentType } from '../types/InstallationGuideTypes.js';

/**
 * Traditional guide formatter
 * Specialized in formatting traditional installation guides
 */
export class TraditionalGuideFormatter implements IInstallationGuideFormatter {
  /**
   * Format traditional installation guide based on context
   * @param context - Installation guide context
   * @returns Formatted guide result
   */
  public formatGuide(context: InstallationGuideContext): GuideGenerationResult {
    try {
      let guide = `我将指导你如何安装和配置 ${context.mcpName} MCP 服务器。\n\n`;
      guide += `GitHub 仓库地址：${context.githubUrl}\n\n`;

      if (context.installationSection) {
        guide += `## 安装步骤\n\n`;
        guide += `根据项目 README 文档：\n\n${context.installationSection.content}\n\n`;
      } else {
        guide += `## 项目信息\n\n`;
        guide += `项目 README 中没有明确的安装部分，但这里是项目的基本信息。\n\n`;
      }

      guide += this.generateTraditionalInstallationGuidance(context.githubUrl, context.repoName);
      guide += this.generateHelpSection(context.githubUrl);

      return {
        content: guide,
        type: InstallationContentType.TRADITIONAL_INSTALLATION,
        success: true,
      };
    } catch (error) {
      return {
        content: '',
        type: InstallationContentType.TRADITIONAL_INSTALLATION,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if this formatter can handle the given context
   * @param context - Installation guide context
   * @returns True if this formatter can handle the context
   */
  public canHandle(context: InstallationGuideContext): boolean {
    return context.installationSection?.type === InstallationContentType.TRADITIONAL_INSTALLATION ||
           context.installationSection === null;
  }

  /**
   * Get the priority of this formatter (higher number = higher priority)
   * @returns Priority number
   */
  public getPriority(): number {
    return 10; // Low priority as fallback
  }

  /**
   * Generate traditional installation guidance
   * @param githubUrl - GitHub repository URL
   * @param repoName - Repository name
   * @returns Traditional installation guidance
   */
  private generateTraditionalInstallationGuidance(githubUrl: string, repoName: string): string {
    let guidance = `## 通用安装步骤\n\n`;
    guidance += `基于常见的 Node.js 项目模式，你可能需要执行以下步骤：\n\n`;
    guidance += `1. **克隆仓库**：\n`;
    guidance += `   \`\`\`bash\n   git clone ${githubUrl}\n   \`\`\`\n\n`;
    guidance += `2. **进入项目目录**：\n`;
    guidance += `   \`\`\`bash\n   cd ${repoName}\n   \`\`\`\n\n`;
    guidance += `3. **安装依赖**：\n`;
    guidance += `   \`\`\`bash\n   npm install\n   # 或者\n   yarn install\n   # 或者\n   pnpm install\n   \`\`\`\n\n`;

    guidance += `## 配置和运行\n\n`;
    guidance += `安装后，你可能需要：\n\n`;
    guidance += `- 检查项目是否需要环境变量配置（查看 \`.env.example\` 文件）\n`;
    guidance += `- 查看 \`package.json\` 中的脚本命令来运行服务器\n`;
    guidance += `- 参考项目文档了解如何集成到你的应用中\n`;
    guidance += `- 如果是 MCP 服务器，查看如何配置到 Claude Desktop 或其他 MCP 客户端\n\n`;

    return guidance;
  }

  /**
   * Generate help section
   * @param githubUrl - GitHub repository URL
   * @returns Help section
   */
  private generateHelpSection(githubUrl: string): string {
    let help = `## 需要帮助？\n\n`;
    help += `如果你在安装过程中遇到任何问题，可以：\n`;
    help += `- 查看项目的 [Issues 页面](${githubUrl}/issues)\n`;
    help += `- 创建新的 Issue 寻求帮助\n`;
    help += `- 查看项目文档了解更多详细信息\n`;
    return help;
  }
}
