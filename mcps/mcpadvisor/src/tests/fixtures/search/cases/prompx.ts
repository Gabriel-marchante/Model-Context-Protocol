import { SearchTestCase } from '../types.js';

export const prompxTestCases: SearchTestCase[] = [
  {
    name: '查询管理 prompt 的 MCP',
    query: '有哪些管理 prompt 的 MCP',
    options: { limit: 5, minSimilarity: 0.05 },
    expectedKeywords: ['提示词', 'prompt'],
    expectedServerNames: ['promptx'], // 明确指定期望的服务器名称
    description: '测试管理 prompt 的 MCP',
  },
];
