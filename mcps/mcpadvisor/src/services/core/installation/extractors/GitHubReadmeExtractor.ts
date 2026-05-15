import { IReadmeContentExtractor } from '../interfaces/IReadmeContentExtractor.js';
import { fetchGitHubReadme } from '../../../../utils/githubUtils.js';
import logger from '../../../../utils/logger.js';

/**
 * GitHub README content extractor
 * Responsible for fetching README content from GitHub repositories
 */
export class GitHubReadmeExtractor implements IReadmeContentExtractor {
  /**
   * Extract README content from a GitHub repository
   * @param githubUrl - GitHub repository URL
   * @returns Promise resolving to README content or null if not found
   */
  public async extractReadmeContent(githubUrl: string): Promise<string | null> {
    try {
      return await fetchGitHubReadme(githubUrl);
    } catch (error) {
      logger.error(
        `Failed to extract README content from ${githubUrl}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }
}
