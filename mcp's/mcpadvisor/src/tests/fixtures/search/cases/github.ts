import { SearchTestCase } from '../types.js';

export const githubTestCases: SearchTestCase[] = [
  {
    name: 'GitHub-仓库搜索',
    query: '查找GitHub上的热门项目',
    options: { limit: 3, minSimilarity: 0.1 },
    expectedKeywords: ['github', 'repository', 'repo'],
    description: '测试GitHub仓库搜索功能',
    skip: true, // 根据实际情况启用
  },
];
