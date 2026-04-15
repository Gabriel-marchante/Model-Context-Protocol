/**
 * 配置指南服务
 * 负责为不同MCP客户端生成配置指南
 */

/**
 * MCP客户端类型
 */
export enum McpClientType {
  CLAUDE = 'claude',
  CLAUDE_DESKTOP = 'claude desktop',
  WINDSURF = 'windsurf',
  CASCADE = 'cascade',
  CURSOR = 'cursor',
  CLINE = 'cline',
  CHATGPT = 'chatgpt',
  OPENAI = 'openai',
  OTHER = 'other',
}

/**
 * 配置指南服务
 * 负责为不同MCP客户端生成配置指南
 */
export class ConfigurationGuideService {
  /**
   * 生成MCP配置指南
   * @param mcpName - MCP服务器名称
   * @param mcpClient - 用户使用的MCP客户端
   * @returns 配置指南文本
   */
  public generateConfigurationGuide(
    mcpName: string,
    mcpClient: string = '',
  ): string {
    const clientType = this.normalizeClientType(mcpClient);
    const baseConfigTemplate = this.getBaseConfigTemplate(mcpName);

    switch (clientType) {
      case McpClientType.CLAUDE:
      case McpClientType.CLAUDE_DESKTOP:
        return this.getClaudeConfigGuide(mcpName, baseConfigTemplate);

      case McpClientType.WINDSURF:
      case McpClientType.CASCADE:
        return this.getWindsurfConfigGuide(mcpName, baseConfigTemplate);

      case McpClientType.CURSOR:
        return this.getCursorConfigGuide(mcpName, baseConfigTemplate);

      case McpClientType.CLINE:
        return this.getClineConfigGuide(mcpName, baseConfigTemplate);

      case McpClientType.CHATGPT:
      case McpClientType.OPENAI:
        return this.getChatGptConfigGuide(mcpName);

      case McpClientType.OTHER:
      default:
        return this.getDefaultConfigGuide(mcpName, baseConfigTemplate);
    }
  }

  /**
   * 标准化客户端类型
   * @param mcpClient - 用户输入的客户端名称
   * @returns 标准化的客户端类型
   */
  private normalizeClientType(mcpClient: string): McpClientType {
    const clientLower = mcpClient.toLowerCase().trim();

    if (clientLower === 'claude' || clientLower === 'claude desktop') {
      return clientLower as McpClientType;
    }

    if (clientLower === 'windsurf' || clientLower === 'cascade') {
      return clientLower as McpClientType;
    }

    if (clientLower === 'cursor') {
      return McpClientType.CURSOR;
    }

    if (clientLower === 'cline') {
      return McpClientType.CLINE;
    }

    if (clientLower === 'chatgpt' || clientLower === 'openai') {
      return clientLower as McpClientType;
    }

    return McpClientType.OTHER;
  }

  /**
   * 获取基本配置模板
   * @param mcpName - MCP服务器名称
   * @returns 配置模板字符串
   */
  private getBaseConfigTemplate(mcpName: string): string {
    return `
{
  "mcpServers": {
    "${mcpName}": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-${mcpName.toLowerCase()}"
      ],
      "env": {}
    }
  }
}`;
  }

  /**
   * 获取Claude Desktop的配置指南
   * @param mcpName - MCP服务器名称
   * @param baseConfigTemplate - 基本配置模板
   * @returns 配置指南文本
   */
  private getClaudeConfigGuide(
    mcpName: string,
    baseConfigTemplate: string,
  ): string {
    return `## Claude Desktop配置指南

将以下配置添加到Claude Desktop的MCP配置文件中：

${baseConfigTemplate}

配置文件位置：
- MacOS/Linux: ~/Library/Application Support/Claude/claude_desktop_config.json
- Windows: %AppData%\\Claude\\claude_desktop_config.json

添加后重启Claude Desktop应用以使配置生效。`;
  }

  /**
   * 获取Windsurf/Cascade的配置指南
   * @param mcpName - MCP服务器名称
   * @param baseConfigTemplate - 基本配置模板
   * @returns 配置指南文本
   */
  private getWindsurfConfigGuide(
    mcpName: string,
    baseConfigTemplate: string,
  ): string {
    return `## Windsurf/Cascade配置指南

将以下配置添加到Windsurf的MCP配置文件中：

${baseConfigTemplate}

配置文件位置：
- MacOS/Linux: ~/.codeium/windsurf/mcp_config.json
- Windows: %USERPROFILE%\\.codeium\\windsurf\\mcp_config.json

添加后重启Windsurf/Cascade环境以使配置生效。`;
  }

  /**
   * 获取Cursor的配置指南
   * @param mcpName - MCP服务器名称
   * @param baseConfigTemplate - 基本配置模板
   * @returns 配置指南文本
   */
  private getCursorConfigGuide(
    mcpName: string,
    baseConfigTemplate: string,
  ): string {
    return `## Cursor配置指南

将以下配置添加到Cursor的MCP配置文件中：

${baseConfigTemplate}

配置文件位置：
- MacOS/Linux: ~/.cursor/mcp_config.json
- Windows: %USERPROFILE%\\.cursor\\mcp_config.json

配置步骤：
1. 如果配置文件不存在，请创建它
2. 添加上述配置
3. 重启Cursor应用
4. 在Cursor设置中启用MCP功能（如果需要）

注意：Cursor的MCP支持可能会根据版本不同而有所变化，请参考官方文档了解最新的配置方式。`;
  }

  /**
   * 获取Cline的配置指南
   * @param mcpName - MCP服务器名称
   * @param baseConfigTemplate - 基本配置模板
   * @returns 配置指南文本
   */
  private getClineConfigGuide(
    mcpName: string,
    baseConfigTemplate: string,
  ): string {
    return `## Cline配置指南

将以下配置添加到Cline的MCP配置文件中：

${baseConfigTemplate}

配置文件位置：
- MacOS/Linux: ~/.config/cline/mcp_config.json
- Windows: %APPDATA%\\cline\\mcp_config.json

配置步骤：
1. 如果配置目录不存在，请创建它: 使用命令"mkdir -p ~/.config/cline"
2. 创建或编辑配置文件
3. 重启Cline或使用命令"cline reload-config"重新加载配置

注意：Cline是一个命令行工具，可能需要额外的配置来使用MCP功能。请参考Cline的最新文档了解详细信息。`;
  }

  /**
   * 获取ChatGPT/OpenAI的配置指南
   * @param mcpName - MCP服务器名称
   * @returns 配置指南文本
   */
  private getChatGptConfigGuide(mcpName: string): string {
    return `## ChatGPT/OpenAI配置指南

目前OpenAI的ChatGPT不直接支持MCP协议。

您可以考虑使用以下替代方法：
1. 使用支持MCP的AI助手，如Claude、Cursor或Cline
2. 通过API集成方式使用此MCP服务器
3. 关注OpenAI的更新，他们可能在未来支持MCP协议`;
  }

  /**
   * 获取默认配置指南
   * @param mcpName - MCP服务器名称
   * @param baseConfigTemplate - 基本配置模板
   * @returns 配置指南文本
   */
  private getDefaultConfigGuide(
    mcpName: string,
    baseConfigTemplate: string,
  ): string {
    return `## MCP配置指南

将以下配置添加到您的AI助手的MCP配置文件中：

${baseConfigTemplate}

常见配置文件位置：
- Claude Desktop (MacOS/Linux): ~/Library/Application Support/Claude/claude_desktop_config.json
- Claude Desktop (Windows): %AppData%\\Claude\\claude_desktop_config.json
- Windsurf/Cascade (MacOS/Linux): ~/.codeium/windsurf/mcp_config.json
- Windsurf/Cascade (Windows): %USERPROFILE%\\.codeium\\windsurf\\mcp_config.json
- Cursor (MacOS/Linux): ~/.cursor/mcp_config.json
- Cursor (Windows): %USERPROFILE%\\.cursor\\mcp_config.json
- Cline (MacOS/Linux): ~/.config/cline/mcp_config.json
- Cline (Windows): %APPDATA%\\cline\\mcp_config.json

添加配置后，请重启您的AI助手应用以使配置生效。`;
  }
}
