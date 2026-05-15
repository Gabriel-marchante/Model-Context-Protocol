import { fetchGitHubReadme } from '../utils/githubUtils.js';

/**
 * Example demonstrating how to use the fetchGitHubReadme utility
 */
async function main() {
  // Example URL from the requirements
  const url = 'https://github.com/seansoreilly/abs';

  console.log(`Fetching README from: ${url}`);

  try {
    const readmeContent = await fetchGitHubReadme(url);

    if (readmeContent) {
      console.log('\nREADME Content:');
      console.log('-----------------------------------');
      console.log(readmeContent);
      console.log('-----------------------------------');
    } else {
      console.error('Failed to fetch README content');
    }
  } catch (error) {
    console.error(
      'Error:',
      error instanceof Error ? error.message : String(error),
    );
  }
}

// Run the example
main().catch(console.error);
