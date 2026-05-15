import { McpConfigurationExtractor } from '../extractors/McpConfigurationExtractor.js';
import { TraditionalInstallationExtractor } from '../extractors/TraditionalInstallationExtractor.js';
/**
 * Factory for creating installation section extractors
 * Implements the Factory pattern to select appropriate extractors
 */
export class ExtractorFactory {
    static extractors = [
        new McpConfigurationExtractor(),
        new TraditionalInstallationExtractor(),
    ];
    /**
     * Get the best extractor for the given README content
     * @param readmeContent - README content to analyze
     * @returns Best matching extractor
     */
    static getBestExtractor(readmeContent) {
        // Find all extractors that can handle the content
        const capableExtractors = this.extractors.filter(extractor => extractor.canHandle(readmeContent));
        // Sort by priority (highest first)
        capableExtractors.sort((a, b) => b.getPriority() - a.getPriority());
        // Return the highest priority extractor, or fallback to traditional
        return capableExtractors[0] || new TraditionalInstallationExtractor();
    }
    /**
     * Get all available extractors
     * @returns Array of all extractors
     */
    static getAllExtractors() {
        return [...this.extractors];
    }
    /**
     * Register a new extractor
     * @param extractor - Extractor to register
     */
    static registerExtractor(extractor) {
        this.extractors.push(extractor);
    }
}
