/**
 * Pre-Tool-Call Hook - 工具调用前检查
 */

const dangerousTools = ['exec', 'write', 'edit', 'delete', 'remove'];

async function preToolCallHook(ctx, plugin) {
  const toolName = ctx.toolName || '';
  
  // 记录工具调用
  plugin.state.lastToolCall = {
    name: toolName,
    args: ctx.toolArgs ? JSON.stringify(ctx.toolArgs).substring(0, 100) : '',
    time: new Date().toISOString()
  };
  
  // 检查危险工具
  if (dangerousTools.includes(toolName.toLowerCase())) {
    console.log(`🎀 EVA: Tool call detected: ${toolName}`);
    
    // 可以在这里添加确认逻辑
    // 当前只是记录，不拦截
  }
  
  return ctx;
}

module.exports = { preToolCallHook };
