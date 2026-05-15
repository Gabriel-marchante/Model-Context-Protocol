import { FullConfig } from '@playwright/test';
import fs from 'fs';

interface ServiceStatus {
  name: string;
  url: string;
  healthy: boolean;
  error?: string;
}

async function checkServiceHealth(url: string, timeout = 5000): Promise<{ healthy: boolean; error?: string }> {
  try {
    const fetch = (await import('node-fetch')).default;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'MCPAdvisor-E2E-Tests' }
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      return { healthy: true };
    } else {
      return { healthy: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }
  } catch (error: any) {
    return { healthy: false, error: error.message };
  }
}

async function globalSetup(config: FullConfig) {
  console.log('🔧 开始全局测试设置...');
  
  // Create test results directory
  const resultDir = 'test-results';
  if (!fs.existsSync(resultDir)) {
    fs.mkdirSync(resultDir, { recursive: true });
    console.log(`📁 创建测试结果目录: ${resultDir}`);
  }
  
  // Check environment variables
  const authToken = process.env.MCP_AUTH_TOKEN;
  if (!authToken) {
    console.log('⚠️ 警告: 未设置 MCP_AUTH_TOKEN 环境变量');
    console.log('请设置令牌: export MCP_AUTH_TOKEN=your-token-here');
  } else {
    console.log('✅ MCP认证令牌已设置');
  }
  
  // Check required services
  const services: ServiceStatus[] = [];
  
  // Check MCP Inspector
  const inspectorUrl = process.env.MCP_INSPECTOR_URL || 'http://localhost:6274';
  const inspectorResult = await checkServiceHealth(`${inspectorUrl}/health`);
  services.push({
    name: 'MCP Inspector',
    url: inspectorUrl,
    ...inspectorResult
  });
  
  // Check Meilisearch if configured
  const meilisearchHost = process.env.TEST_MEILISEARCH_HOST || 'http://localhost:7700';
  const meilisearchResult = await checkServiceHealth(`${meilisearchHost}/health`);
  services.push({
    name: 'Meilisearch',
    url: meilisearchHost,
    ...meilisearchResult
  });
  
  // Report service status
  let allHealthy = true;
  for (const service of services) {
    if (service.healthy) {
      console.log(`✅ ${service.name} 运行正常`);
    } else {
      console.log(`⚠️ 警告: ${service.name} 不可用 (${service.url}) - ${service.error}`);
      allHealthy = false;
    }
  }
  
  if (!allHealthy) {
    console.log('⚠️ 部分服务不可用，某些测试可能会失败');
    console.log('请确保所有必需的服务正在运行：');
    console.log('  - MCP Inspector: http://localhost:6274');
    console.log('  - Meilisearch: http://localhost:7700');
  }
  
  // Set up performance monitoring
  process.env.PLAYWRIGHT_PERFORMANCE_MONITORING = 'true';
  
  console.log('✅ 全局设置完成\n');
}

export default globalSetup;