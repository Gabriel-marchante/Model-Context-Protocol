/**
 * Interface for extracting README content from various sources
 */
export interface IReadmeContentExtractor {
  /**
   * Extract README content from a GitHub repository
   * @param githubUrl - GitHub repository URL
   * @returns Promise resolving to README content or null if not found
   */
  extractReadmeContent(githubUrl: string): Promise<string | null>;
}
