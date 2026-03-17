/**
 * Pre-Tool-Call Hook - 工具调用前检查
 */

const fs = require('fs');

const dangerousTools = ['exec', 'write', 'edit', 'delete', 'remove'];

async function preToolCallHook(ctx, plugin) {
  const toolName = ctx.toolName || '';
  
  // 对话计数 +1 (每次工具调用，代表一次对话)
<<<<<<< HEAD
  const chatsFile = path.join(process.env.HOME || '/root', '.openclaw/workspace/chats.txt');
=======
  const chatsFile = '/home/node/.openclaw/workspace/chats.txt';
>>>>>>> 3eebaf4ef800ec03d4416c665fd637daa76c1ba0
  try {
    let chats = parseInt(fs.readFileSync(chatsFile, 'utf8')) || 0;
    chats += 1;
    fs.writeFileSync(chatsFile, chats.toString());
  } catch (e) {
    // ignore
  }
  
  // 记录工具调用
  plugin.state.lastToolCall = {
    name: toolName,
    args: ctx.toolArgs ? JSON.stringify(ctx.toolArgs).substring(0, 100) : '',
    time: new Date().toISOString()
  };
  
  // 检查危险工具
  if (dangerousTools.includes(toolName.toLowerCase())) {
    console.log(`🎀 EVA: Tool call detected: ${toolName}`);
  }
  
  return ctx;
}

module.exports = { preToolCallHook };
