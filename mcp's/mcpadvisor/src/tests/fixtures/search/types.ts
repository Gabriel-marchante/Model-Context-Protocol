import { SearchOptions } from '../../../types/index.js';

export interface SearchTestCase {
  name: string;
  query: string;
  options: SearchOptions;
  textWeight?: number;
  expectedKeywords: string[];
  expectedServerNames?: string[];
  description: string;
  skip?: boolean;
}

export const DEFAULT_OPTIONS: SearchOptions = {
  limit: 5,
  minSimilarity: 0.1,
};
