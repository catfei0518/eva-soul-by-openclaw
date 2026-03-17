/**
 * 性能监控 - 记录系统运行指标
 */

class PerformanceMonitor {
  constructor() {
    this.stats = {
      apiCalls: 0,
      apiSuccess: 0,
      apiFailures: 0,
      totalResponseTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: [],
      startTime: Date.now()
    };
  }
  
  // 记录API调用
  recordApiCall(success, responseTime, error = null) {
    this.stats.apiCalls++;
    if (success) {
      this.stats.apiSuccess++;
    } else {
      this.stats.apiFailures++;
      if (error) {
        this.stats.errors.push({
          time: new Date().toISOString(),
          error: error.message || String(error)
        });
        // 只保留最近50个错误
        if (this.stats.errors.length > 50) {
          this.stats.errors = this.stats.errors.slice(-50);
        }
      }
    }
    this.stats.totalResponseTime += responseTime;
  }
  
  // 记录缓存命中
  recordCacheHit(hit) {
    if (hit) {
      this.stats.cacheHits++;
    } else {
      this.stats.cacheMisses++;
    }
  }
  
  // 获取平均响应时间
  getAverageResponseTime() {
    if (this.stats.apiCalls === 0) return 0;
    return Math.round(this.stats.totalResponseTime / this.stats.apiCalls);
  }
  
  // 获取成功率
  getSuccessRate() {
    if (this.stats.apiCalls === 0) return 100;
    return ((this.stats.apiSuccess / this.stats.apiCalls) * 100).toFixed(1);
  }
  
  // 获取缓存命中率
  getCacheHitRate() {
    const total = this.stats.cacheHits + this.stats.cacheMisses;
    if (total === 0) return 0;
    return ((this.stats.cacheHits / total) * 100).toFixed(1);
  }
  
  // 获取运行时间
  getUptime() {
    const ms = Date.now() - this.stats.startTime;
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }
  
  // 获取内存使用 (MB)
  getMemoryUsage() {
    const used = process.memoryUsage();
    return {
      heapUsed: Math.round(used.heapUsed / 1024 / 1024),
      heapTotal: Math.round(used.heapTotal / 1024 / 1024),
      rss: Math.round(used.rss / 1024 / 1024)
    };
  }
  
  // 获取完整报告
  getReport() {
    const mem = this.getMemoryUsage();
    return {
      uptime: this.getUptime(),
      api: {
        calls: this.stats.apiCalls,
        success: this.stats.apiSuccess,
        failures: this.stats.apiFailures,
        successRate: this.getSuccessRate() + '%',
        avgResponseTime: this.getAverageResponseTime() + 'ms'
      },
      cache: {
        hits: this.stats.cacheHits,
        misses: this.stats.cacheMisses,
        hitRate: this.getCacheHitRate() + '%'
      },
      memory: {
        heap: mem.heapUsed + 'MB / ' + mem.heapTotal + 'MB',
        rss: mem.rss + 'MB'
      },
      errors: this.stats.errors.length
    };
  }
  
  // 打印报告
  printReport() {
    const report = this.getReport();
    
    console.log('📊 性能报告');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⏱️  运行时间: ' + report.uptime);
    console.log('');
    console.log('📡 API调用');
    console.log('   调用次数: ' + report.api.calls);
    console.log('   成功: ' + report.api.success + ' (' + report.api.successRate + ')');
    console.log('   失败: ' + report.api.failures);
    console.log('   平均响应: ' + report.api.avgResponseTime);
    console.log('');
    console.log('💾 缓存');
    console.log('   命中: ' + report.cache.hits);
    console.log('   未命中: ' + report.cache.misses);
    console.log('   命中率: ' + report.cache.hitRate);
    console.log('');
    console.log('🧠 内存');
    console.log('   堆: ' + report.memory.heap);
    console.log('   RSS: ' + report.memory.rss);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }
  
  // 重置统计
  reset() {
    this.stats = {
      apiCalls: 0,
      apiSuccess: 0,
      apiFailures: 0,
      totalResponseTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: [],
      startTime: Date.now()
    };
  }
}

// 全局实例
const perfMonitor = new PerformanceMonitor();

module.exports = {
  PerformanceMonitor,
  perfMonitor
};
