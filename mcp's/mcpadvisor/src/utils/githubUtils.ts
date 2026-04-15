import logger from './logger.js';

/**
 * Interface for GitHub repository information
 */
interface GitHubRepoInfo {
  owner: string;
  repo: string;
  branch?: string;
}

/**
 * Parse a GitHub URL to extract owner, repo, and branch information
 * @param url GitHub repository URL
 * @returns Parsed repository information or null if invalid URL
 */
export function parseGitHubUrl(url: string): GitHubRepoInfo | null {
  try {
    // Handle different GitHub URL formats
    const githubRegex = /github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+))?/;
    const match = url.match(githubRegex);

    if (!match) return null;

    const [, owner, repo, branch = 'main'] = match;

    // Remove .git suffix if present
    const cleanRepo = repo.endsWith('.git') ? repo.slice(0, -4) : repo;

    return {
      owner,
      repo: cleanRepo,
      branch,
    };
  } catch (error) {
    logger.error?.(`Failed to parse GitHub URL: ${url}`, { error });
    return null;
  }
}

/**
 * Fetch README.md content from GitHub using the API
 * @param repoInfo Repository information
 * @returns README content as markdown string or null if not found
 */
async function fetchReadmeUsingGitHubApi(
  repoInfo: GitHubRepoInfo,
): Promise<string | null> {
  try {
    const apiUrl = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/readme`;

    // Create an AbortController to implement timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    try {
      const response = await fetch(apiUrl, {
        headers: {
          Accept: 'application/vnd.github.raw+json',
          'User-Agent': 'mcpadvisor',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `GitHub API returned ${response.status}: ${response.statusText}`,
        );
      }

      return await response.text();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    // Don't log timeout errors as warnings
    if (error instanceof Error && error.name === 'AbortError') {
      logger.info?.(
        `GitHub API request timed out for ${repoInfo.owner}/${repoInfo.repo}`,
      );
    } else {
      logger.warn?.(
        `Failed to fetch README using GitHub API: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return null;
  }
}

/**
 * Fetch README.md content from GitHub using jsDelivr CDN
 * @param repoInfo Repository information
 * @returns README content as markdown string or null if not found
 */
async function fetchReadmeUsingJsDelivr(
  repoInfo: GitHubRepoInfo,
): Promise<string | null> {
  try {
    // jsDelivr URL format: https://cdn.jsdelivr.net/gh/user/repo@branch/file
    const cdnUrl = `https://cdn.jsdelivr.net/gh/${repoInfo.owner}/${repoInfo.repo}@${repoInfo.branch}/README.md`;

    // Create an AbortController to implement timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    try {
      const response = await fetch(cdnUrl, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `jsDelivr CDN returned ${response.status}: ${response.statusText}`,
        );
      }

      return await response.text();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    // Don't log timeout errors as warnings
    if (error instanceof Error && error.name === 'AbortError') {
      logger.info?.(
        `jsDelivr request timed out for ${repoInfo.owner}/${repoInfo.repo}`,
      );
    } else {
      logger.warn?.(
        `Failed to fetch README using jsDelivr: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return null;
  }
}

/**
 * Fetch README.md content from GitHub using raw.githubusercontent.com
 * @param repoInfo Repository information
 * @returns README content as markdown string or null if not found
 */
async function fetchReadmeUsingRawGitHub(
  repoInfo: GitHubRepoInfo,
): Promise<string | null> {
  try {
    const rawUrl = `https://raw.githubusercontent.com/${repoInfo.owner}/${repoInfo.repo}/${repoInfo.branch}/README.md`;

    // Create an AbortController to implement timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    try {
      const response = await fetch(rawUrl, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Raw GitHub returned ${response.status}: ${response.statusText}`,
        );
      }

      return await response.text();
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    // Don't log timeout errors as warnings
    if (error instanceof Error && error.name === 'AbortError') {
      logger.info?.(
        `Raw GitHub request timed out for ${repoInfo.owner}/${repoInfo.repo}`,
      );
    } else {
      logger.warn?.(
        `Failed to fetch README using raw GitHub: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return null;
  }
}

/**
 * Fetch README.md content from a GitHub repository URL
 * Tries multiple methods in sequence for better reliability
 * @param url GitHub repository URL
 * @returns README content as markdown string or null if not found
 */
export async function fetchGitHubReadme(url: string): Promise<string | null> {
  const repoInfo = parseGitHubUrl(url);

  if (!repoInfo) {
    logger.error?.(`Invalid GitHub URL: ${url}`);
    return null;
  }

  logger.info?.(`Fetching README for ${repoInfo.owner}/${repoInfo.repo}`);

  // Try multiple methods in sequence
  const methods = [
    { name: 'GitHub API', fn: fetchReadmeUsingGitHubApi },
    { name: 'jsDelivr CDN', fn: fetchReadmeUsingJsDelivr },
    { name: 'Raw GitHub', fn: fetchReadmeUsingRawGitHub },
  ];

  for (const { name, fn } of methods) {
    try {
      const content = await fn(repoInfo);
      if (content) {
        logger.info?.(`Successfully fetched README using ${name}`);
        return content;
      }
    } catch (error) {
      logger.warn?.(
        `Method ${name} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  logger.error?.(
    `Failed to fetch README for ${repoInfo.owner}/${repoInfo.repo} using all available methods`,
  );
  return null;
}
