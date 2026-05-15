import { SearchTestCase } from '../types.js';

export const redbookTestCases: SearchTestCase[] = [
  {
    name: '小红书-文本匹配',
    query: '我想要看看小红书今天的热点问题，你再锐评一下',
    options: { limit: 5, minSimilarity: 0.1 },
    textWeight: 0.7, // 高文本权重
    expectedKeywords: ['rednote', '红书', 'xiaohongshu'],
    expectedServerNames: ['rednote-mcp', 'mcp-hotnews-server'], // 验证特定服务器名称
    description: '测试文本匹配为主的搜索能否找到小红书相关服务器',
  },
  {
    name: '小红书-向量搜索',
    query: '请帮我查找小红书的热门内容',
    options: { limit: 3, minSimilarity: 0.1 },
    textWeight: 0.3, // 低文本权重，主要依赖向量搜索
    expectedKeywords: ['rednote', '红书', 'xiaohongshu'],
    expectedServerNames: ['rednote-mcp', 'mcp-hotnews-server'], // 验证特定服务器名称
    description: '测试向量搜索为主的搜索能否找到小红书相关服务器',
  },
];
