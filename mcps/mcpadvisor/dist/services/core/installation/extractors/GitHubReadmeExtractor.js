import { fetchGitHubReadme } from '../../../../utils/githubUtils.js';
import logger from '../../../../utils/logger.js';
/**
 * GitHub README content extractor
 * Responsible for fetching README content from GitHub repositories
 */
export class GitHubReadmeExtractor {
    /**
     * Extract README content from a GitHub repository
     * @param githubUrl - GitHub repository URL
     * @returns Promise resolving to README content or null if not found
     */
    async extractReadmeContent(githubUrl) {
        try {
            return await fetchGitHubReadme(githubUrl);
        }
        catch (error) {
            logger.error(`Failed to extract README content from ${githubUrl}: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
}
