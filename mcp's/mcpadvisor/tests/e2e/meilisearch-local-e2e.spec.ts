import { test } from '@playwright/test';
import {
  TEST_CONFIG,
  EnvironmentManager,
  SmartWaiter,
  MCPConnectionManager,
  SearchOperations,
  ScreenshotManager,
  TestValidator,
  ConfigurationTester
} from '../helpers/test-helpers.js';

test.describe('MCPAdvisor 本地 Meilisearch 功能测试', () => {
  let envManager: EnvironmentManager;
  let waiter: SmartWaiter;
  let mcpConnection: MCPConnectionManager;
  let searchOps: SearchOperations;
  let screenshotManager: ScreenshotManager;
  let configTester: ConfigurationTester;
  
  test.beforeEach(async ({ page }) => {
    // Initialize helpers first
    envManager = new EnvironmentManager();
    waiter = new SmartWaiter(page);
    mcpConnection = new MCPConnectionManager(page, waiter);
    searchOps = new SearchOperations(page, waiter);
    screenshotManager = new ScreenshotManager(page);
    configTester = new ConfigurationTester(envManager, searchOps, TestValidator, screenshotManager);
    
    // Skip E2E tests in CI if MCP_AUTH_TOKEN is not available
    if (!TEST_CONFIG.authToken) {
      test.skip(true, 'Skipping E2E tests: MCP_AUTH_TOKEN environment variable not set');
    }
    
    // Save and setup environment
    envManager.saveEnvironment();
    envManager.setMeilisearchConfig({
      instance: 'local',
      host: process.env.TEST_MEILISEARCH_HOST || 'http://localhost:7700',
      key: process.env.TEST_MEILISEARCH_KEY || 'testkey'
    });
    
    // Connect to MCP
    await mcpConnection.connectToMCP();
  });
  
  test.afterEach(async () => {
    // Restore environment only if envManager was initialized
    if (envManager) {
      envManager.restoreEnvironment();
    }
  });
  
  test('本地 Meilisearch 搜索功能验证', async ({ page }) => {
    // Perform search with smart waiting
    await searchOps.performSearch('本地文件管理和数据处理工具');
    
    // Validate results
    const results = await searchOps.getSearchResults();
    TestValidator.validateSearchResults(results);
    
    // Take screenshot
    await screenshotManager.takeScreenshot('meilisearch-local-search.png');
    
    console.log('✅ 本地 Meilisearch 搜索测试完成');
  });
  
  test('本地 Meilisearch 故障转移测试', async ({ page }) => {
    // 模拟本地实例不可用，测试 fallback 到云端
    envManager.setMeilisearchConfig({ host: 'http://localhost:9999' }); // 无效端口
    
    await searchOps.performSearch('测试故障转移机制');
    
    // 应该仍然能获得结果（来自 fallback）
    const results = await searchOps.getSearchResults();
    const pageContent = await page.content();
    
    // Check for indicators of fallback to cloud service
    const hasFallbackIndicators = pageContent.includes('fallback') || 
                                  pageContent.includes('cloud') ||
                                  pageContent.includes('备用') ||
                                  results.length > 0; // At minimum, should have results
    
    if (hasFallbackIndicators && results.length > 0) {
      console.log('✅ 故障转移成功：检测到fallback机制并获得结果');
    } else {
      console.log('⚠️ 故障转移未按预期工作：未检测到有效的fallback结果');
    }
    
    await screenshotManager.takeScreenshot('meilisearch-fallback-test.png');
  });
  
  test('性能对比测试：本地 vs 云端', async ({ page }) => {
    const testCases = [
      { 
        instance: 'local', 
        description: '本地实例性能测试',
        host: process.env.TEST_MEILISEARCH_HOST || 'http://localhost:7700'
      },
      { 
        instance: 'cloud', 
        description: '云端实例性能测试',
        host: process.env.MEILISEARCH_CLOUD_HOST || 'https://edge.meilisearch.com',
        key: process.env.MEILISEARCH_CLOUD_KEY || process.env.MEILISEARCH_MASTER_KEY
      }
    ];
    
    const results: Array<{ instance: string; responseTime: number }> = [];
    
    for (const testCase of testCases) {
      // 更新环境变量
      envManager.setMeilisearchConfig({
        instance: testCase.instance,
        host: testCase.host,
        key: testCase.key
      });
      
      const responseTime = await searchOps.performSearch('文件系统操作和数据分析', testCase.description);
      
      results.push({ instance: testCase.instance, responseTime });
      
      await screenshotManager.takeScreenshot(`performance-${testCase.instance}.png`);
    }
    
    // 比较性能结果
    const localTime = results.find(r => r.instance === 'local')?.responseTime || 0;
    const cloudTime = results.find(r => r.instance === 'cloud')?.responseTime || 0;
    
    console.log(`📊 性能对比 - 本地: ${localTime}ms, 云端: ${cloudTime}ms`);
    
    // 验证响应时间都在合理范围内
    TestValidator.validateResponseTime(localTime);
    TestValidator.validateResponseTime(cloudTime);
  });
  
  test('本地 Meilisearch 环境变量配置测试', async () => {
    // 测试不同的环境变量配置
    const configTests = [
      {
        name: '默认本地配置',
        env: {
          MEILISEARCH_INSTANCE: 'local',
          MEILISEARCH_LOCAL_HOST: 'http://localhost:7700',
          MEILISEARCH_MASTER_KEY: 'developmentKey123',
          MEILISEARCH_INDEX_NAME: 'mcp_servers_test'
        }
      },
      {
        name: '自定义本地配置',
        env: {
          MEILISEARCH_INSTANCE: 'local',
          MEILISEARCH_LOCAL_HOST: 'http://localhost:7700',
          MEILISEARCH_MASTER_KEY: 'customkey',
          MEILISEARCH_INDEX_NAME: 'custom_index'
        }
      }
    ];
    
    for (const configTest of configTests) {
      await configTester.testConfiguration(configTest.name, configTest.env);
    }
  });
  
  test('本地 Meilisearch 错误处理测试', async () => {
    // 测试各种错误情况
    const errorTests = [
      {
        name: '无效主机地址',
        env: {
          MEILISEARCH_INSTANCE: 'local',
          MEILISEARCH_LOCAL_HOST: 'http://invalid-host:7700'
        }
      },
      {
        name: '无效端口',
        env: {
          MEILISEARCH_INSTANCE: 'local',
          MEILISEARCH_LOCAL_HOST: 'http://localhost:9999'
        }
      }
    ];
    
    for (const errorTest of errorTests) {
      await configTester.testErrorHandling(errorTest.name, errorTest.env);
    }
  });
  
  test('数据一致性验证测试', async ({ page }) => {
    // 测试本地和云端搜索结果的一致性
    const testQuery = '数据处理和分析工具';
    const results: Record<string, string[]> = {};
    
    // 测试云端搜索
    envManager.setMeilisearchConfig({ instance: 'cloud' });
    await searchOps.performSearch(testQuery);
    results.cloud = await searchOps.getSearchResults();
    
    // 测试本地搜索
    envManager.setMeilisearchConfig({
      instance: 'local',
      host: process.env.TEST_MEILISEARCH_HOST || 'http://localhost:7700'
    });
    await searchOps.performSearch(testQuery);
    results.local = await searchOps.getSearchResults();
    
    // 比较结果
    console.log('🔍 数据一致性分析:');
    console.log(`云端结果数量: ${results.cloud.length}, 本地结果数量: ${results.local.length}`);
    
    // 验证两者都有结果
    TestValidator.validateSearchResults(results.cloud);
    TestValidator.validateSearchResults(results.local);
    
    // 验证结果数量在合理范围内（差异不应过大）
    const quantityDiff = Math.abs(results.cloud.length - results.local.length);
    const maxAllowedDiff = Math.max(3, Math.max(results.cloud.length, results.local.length) * 0.2); // 允许20%的差异或最多3个
    
    if (quantityDiff > maxAllowedDiff) {
      console.warn(`⚠️ 警告：结果数量差异过大 (${quantityDiff} > ${maxAllowedDiff})`);
    } else {
      console.log(`✅ 结果数量差异在合理范围内 (${quantityDiff})`);
    }
    
    // 验证结果内容的相关性
    const relevantKeywords = ['data', 'file', 'analysis', '数据', '文件', '分析', '处理'];
    TestValidator.validateResultRelevance(results.cloud, relevantKeywords);
    TestValidator.validateResultRelevance(results.local, relevantKeywords);
    
    // 检查是否有重复的结果（表明数据同步正确）
    TestValidator.compareResults(results.local, results.cloud);
    
    await screenshotManager.takeScreenshot('data-consistency-test.png');
  });
});