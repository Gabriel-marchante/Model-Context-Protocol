import { InstallationContentType } from '../types/InstallationGuideTypes.js';
/**
 * MCP guide formatter
 * Specialized in formatting MCP server installation guides
 */
export class McpGuideFormatter {
    /**
     * Format MCP installation guide based on context
     * @param context - Installation guide context
     * @returns Formatted guide result
     */
    formatGuide(context) {
        try {
            let guide = `我将指导你如何安装和配置 ${context.mcpName} MCP 服务器。\n\n`;
            guide += `GitHub 仓库地址：${context.githubUrl}\n\n`;
            guide += `## MCP 服务器配置步骤\n\n`;
            guide += `根据项目文档，这是一个 MCP (Model Context Protocol) 服务器，需要通过配置文件进行集成：\n\n`;
            if (context.installationSection) {
                guide += `${context.installationSection.content}\n\n`;
                guide += this.generateMcpSpecificGuidance(context.installationSection.content);
            }
            guide += this.generateHelpSection(context.githubUrl);
            return {
                content: guide,
                type: InstallationContentType.MCP_CONFIGURATION,
                success: true,
            };
        }
        catch (error) {
            return {
                content: '',
                type: InstallationContentType.MCP_CONFIGURATION,
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
    canHandle(context) {
        return context.installationSection?.type === InstallationContentType.MCP_CONFIGURATION;
    }
    /**
     * Get the priority of this formatter (higher number = higher priority)
     * @returns Priority number
     */
    getPriority() {
        return 100; // High priority for MCP configurations
    }
    /**
     * Generate MCP-specific configuration guidance
     * @param installationContent - Installation section content
     * @returns MCP-specific guidance
     */
    generateMcpSpecificGuidance(installationContent) {
        let guidance = `## 配置说明\n\n`;
        // Claude Desktop configuration guidance
        if (this.containsClaudeDesktopConfig(installationContent)) {
            guidance += this.generateClaudeDesktopGuidance();
        }
        // Other MCP clients guidance
        if (this.containsOtherMcpClients(installationContent)) {
            guidance += this.generateOtherClientsGuidance();
        }
        // Environment variables guidance
        if (this.containsEnvironmentVariables(installationContent)) {
            guidance += this.generateEnvironmentVariablesGuidance();
        }
        // NPX-specific guidance
        if (this.containsNpxUsage(installationContent)) {
            guidance += this.generateNpxGuidance();
        }
        return guidance;
    }
    /**
     * Check if content contains Claude Desktop configuration
     * @param content - Content to check
     * @returns True if contains Claude Desktop config
     */
    containsClaudeDesktopConfig(content) {
        return content.includes('claude_desktop_config') || content.includes('Claude Desktop');
    }
    /**
     * Check if content mentions other MCP clients
     * @param content - Content to check
     * @returns True if mentions other clients
     */
    containsOtherMcpClients(content) {
        return content.includes('Cursor') || content.includes('Windsurf');
    }
    /**
     * Check if content contains environment variables
     * @param content - Content to check
     * @returns True if contains env vars
     */
    containsEnvironmentVariables(content) {
        return content.includes('"env"') || content.includes('环境变量');
    }
    /**
     * Check if content uses NPX
     * @param content - Content to check
     * @returns True if uses NPX
     */
    containsNpxUsage(content) {
        return content.includes('npx');
    }
    /**
     * Generate Claude Desktop configuration guidance
     * @returns Claude Desktop guidance
     */
    generateClaudeDesktopGuidance() {
        let guidance = `### Claude Desktop 配置\n\n`;
        guidance += `1. 找到 Claude Desktop 配置文件：\n`;
        guidance += `   - **Windows**: \`%APPDATA%\\Claude\\claude_desktop_config.json\`\n`;
        guidance += `   - **macOS**: \`~/Library/Application Support/Claude/claude_desktop_config.json\`\n`;
        guidance += `   - **Linux**: \`~/.config/claude/claude_desktop_config.json\`\n\n`;
        guidance += `2. 将上述 JSON 配置添加到配置文件中\n`;
        guidance += `3. 保存文件并重启 Claude Desktop\n\n`;
        return guidance;
    }
    /**
     * Generate other MCP clients guidance
     * @returns Other clients guidance
     */
    generateOtherClientsGuidance() {
        let guidance = `### 其他 MCP 客户端\n\n`;
        guidance += `该 MCP 服务器也支持其他客户端，如 Cursor、Windsurf 等。请参考各客户端的 MCP 配置文档。\n\n`;
        return guidance;
    }
    /**
     * Generate environment variables guidance
     * @returns Environment variables guidance
     */
    generateEnvironmentVariablesGuidance() {
        let guidance = `### 环境变量配置\n\n`;
        guidance += `如果需要自定义工作目录或其他设置，可以在配置中添加 \`env\` 字段。\n\n`;
        return guidance;
    }
    /**
     * Generate NPX usage guidance
     * @returns NPX guidance
     */
    generateNpxGuidance() {
        let guidance = `### 注意事项\n\n`;
        guidance += `- 该服务器使用 \`npx\` 运行，确保你的系统已安装 Node.js\n`;
        guidance += `- 首次运行时可能需要下载依赖，请耐心等待\n`;
        guidance += `- 如果遇到网络问题，可以尝试使用国内 npm 镜像\n\n`;
        return guidance;
    }
    /**
     * Generate help section
     * @param githubUrl - GitHub repository URL
     * @returns Help section
     */
    generateHelpSection(githubUrl) {
        let help = `## 需要帮助？\n\n`;
        help += `如果你在安装过程中遇到任何问题，可以：\n`;
        help += `- 查看项目的 [Issues 页面](${githubUrl}/issues)\n`;
        help += `- 创建新的 Issue 寻求帮助\n`;
        help += `- 查看项目文档了解更多详细信息\n`;
        return help;
    }
}
