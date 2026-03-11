/**
 * Shutdown Hook - 关闭时保存状态
 */

async function shutdownHook(ctx, plugin) {
  console.log('🎀 EVA: Shutdown save...');
  
  // 更新最终状态
  plugin.state.lastShutdown = new Date().toISOString();
  plugin.state.sessionCount = (plugin.state.sessionCount || 0) + 1;
  
  // 保存状态
  await plugin.saveState();
  
  console.log('🎀 EVA: State saved, session ended');
  
  return ctx;
}

module.exports = { shutdownHook };
