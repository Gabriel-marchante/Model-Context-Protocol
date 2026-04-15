/**
 * Installation guide types and interfaces
 */

/**
 * Installation content type
 */
export enum InstallationContentType {
  MCP_CONFIGURATION = 'mcp_configuration',
  TRADITIONAL_INSTALLATION = 'traditional_installation',
  UNKNOWN = 'unknown',
}

/**
 * Installation section data
 */
export interface InstallationSection {
  content: string;
  type: InstallationContentType;
  hasJsonConfig: boolean;
  mcpKeywords: string[];
}

/**
 * Installation guide context
 */
export interface InstallationGuideContext {
  mcpName: string;
  githubUrl: string;
  repoName: string;
  installationSection: InstallationSection | null;
}

/**
 * Guide generation result
 */
export interface GuideGenerationResult {
  content: string;
  type: InstallationContentType;
  success: boolean;
  error?: string;
}
