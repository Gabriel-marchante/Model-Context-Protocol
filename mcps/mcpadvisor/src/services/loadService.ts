// Add type annotations and fix type errors

import axios from 'axios';
import { promises as fs } from 'fs';
import { loadConfig } from '../config/configLoader.js';

type FieldMap = Record<string, string[]>;
type Item = Record<string, any>;

// Add types for sources
export type McpSources = {
  remote_urls: string[];
  local_files: string[];
};

/**
 * Generic function to process JSON data from any source
 */
function processJsonData(data: any): any[] {
  // Handle both array and object responses
  if (Array.isArray(data)) {
    return data;
  } else if (typeof data === 'object' && data !== null) {
    // Convert object with keys to array of objects
    return Object.entries(data).map(([key, value]) => {
      // Ensure the key is included in the object
      if (typeof value === 'object' && value !== null) {
        return { ...value, name: key };
      }
      return { name: key, value };
    });
  }

  return [];
}

/**
 * Fetch JSON data from a remote URL
 */
async function fetchJsonFromUrl(url: string): Promise<any[]> {
  try {
    const res = await axios.get(url, { timeout: 30000 });
    return processJsonData(res.data);
  } catch (error) {
    console.error(`Error fetching from URL ${url}:`, error);
    return [];
  }
}

/**
 * Fetch JSON data from a local file
 */
async function fetchJsonFromFile(filePath: string): Promise<any[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    return processJsonData(data);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return [];
  }
}

/**
 * Normalize data item according to field mapping
 */
function normalizeItem(item: Item, fieldMap: FieldMap): Item {
  const normalized: Item = {};
  for (const [canonical, aliases] of Object.entries(fieldMap)) {
    for (const alias of aliases) {
      if (item[alias] !== undefined) {
        normalized[canonical] = item[alias];
        break;
      }
    }
  }
  return normalized;
}

/**
 * Fetch data from multiple sources
 */
async function fetchFromSources(
  sources: string[],
  fetchFn: (source: string) => Promise<any[]>,
): Promise<any[]> {
  const results = await Promise.all(sources.map(fetchFn));
  return results.flat();
}

/**
 * Load all data from configured sources
 */
export async function loadAll(
  additionalSources?: McpSources,
  additionalFieldMap?: FieldMap,
): Promise<Item[]> {
  const config = await loadConfig();

  // Merge additional sources if provided
  const remote_urls = [
    ...(config.mcp_sources?.remote_urls || []),
    ...(additionalSources?.remote_urls || []),
  ];
  const local_files = [
    ...(config.mcp_sources?.local_files || []),
    ...(additionalSources?.local_files || []),
  ];

  // Merge field maps if provided
  const fieldMap = additionalFieldMap
    ? { ...config.mcp_index_fields, ...additionalFieldMap }
    : config.mcp_index_fields;

  const remoteItems = await fetchFromSources(remote_urls, fetchJsonFromUrl);
  const localItems = await fetchFromSources(local_files, fetchJsonFromFile);

  const allItems = [...remoteItems, ...localItems];
  const items = allItems.map(item => normalizeItem(item, fieldMap));
  // TODO: save to remote db
  return items;
}

/**
 * Add additional MCP sources dynamically at runtime
 * @param sources Additional MCP sources to add
 * @param fieldMap Additional field mappings to add
 * @returns Promise<Item[]> - All loaded and normalized items
 */
export async function addAdditionalSources(
  sources: Partial<McpSources>,
  fieldMap?: FieldMap,
): Promise<Item[]> {
  const additionalSources: McpSources = {
    remote_urls: sources.remote_urls || [],
    local_files: sources.local_files || [],
  };

  return loadAll(additionalSources, fieldMap);
}
