import { InstallationSection } from '../types/InstallationGuideTypes.js';

/**
 * Interface for extracting installation sections from README content
 */
export interface IInstallationSectionExtractor {
  /**
   * Extract installation section from README content
   * @param readmeContent - README content to extract from
   * @returns Installation section data or null if not found
   */
  extractInstallationSection(readmeContent: string): InstallationSection | null;

  /**
   * Check if this extractor can handle the given content
   * @param readmeContent - README content to check
   * @returns True if this extractor can handle the content
   */
  canHandle(readmeContent: string): boolean;

  /**
   * Get the priority of this extractor (higher number = higher priority)
   * @returns Priority number
   */
  getPriority(): number;
}
