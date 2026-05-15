import { SearchTestCase } from '../types.js';

export const edgeCaseTestCases: SearchTestCase[] = [
  {
    name: '边界-空查询',
    query: '',
    options: { limit: 5, minSimilarity: 0.1 },
    expectedKeywords: [],
    description: '测试空查询的处理',
  },
  {
    name: '边界-特殊字符',
    query: '!@#$%^&*()_+',
    options: { limit: 5, minSimilarity: 0 },
    expectedKeywords: [],
    description: '测试特殊字符查询的处理',
  },
];
