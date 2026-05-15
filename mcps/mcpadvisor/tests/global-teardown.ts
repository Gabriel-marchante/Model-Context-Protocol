import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('\n🧹 开始全局测试清理...');
  
  // Clean up any temporary files or test artifacts
  try {
    // Clean up any temporary test data
    if (process.env.PLAYWRIGHT_PERFORMANCE_MONITORING) {
      console.log('📊 性能监控数据已收集');
    }
    
    // Log test execution summary
    const resultDir = 'test-results';
    const fs = await import('fs/promises');
    try {
      const stats = await fs.stat(resultDir);
      if (stats.isDirectory()) {
        const files = await fs.readdir(resultDir);
        const screenshots = files.filter(f => f.endsWith('.png')).length;
        const videos = files.filter(f => f.endsWith('.webm')).length;
        
        if (screenshots > 0 || videos > 0) {
          console.log(`📸 生成了 ${screenshots} 个截图和 ${videos} 个视频`);
          console.log(`📁 测试结果保存在: ${resultDir}`);
        }
      }
    } catch (error) {
      // Directory doesn't exist or other error, skip reporting
    }
    
    // Environment cleanup
    delete process.env.PLAYWRIGHT_PERFORMANCE_MONITORING;
    
  } catch (error: any) {
    console.log('⚠️ 清理过程中出现警告:', error.message);
  }
  
  console.log('✅ 全局清理完成');
}

export default globalTeardown;