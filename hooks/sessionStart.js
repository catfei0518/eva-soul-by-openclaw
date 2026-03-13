/**
 * Session Start Hook - 会话开始时初始化夏娃状态
 */

const fs = require('fs');
const path = require('path');

async function sessionStartHook(ctx, plugin) {
  console.log('🎀 EVA: Session starting...');
  
  // 对话计数 +1 (每次新session会话)
  const chatsFile = '/home/node/.openclaw/workspace/chats.txt';
  try {
    let chats = parseInt(fs.readFileSync(chatsFile, 'utf8')) || 0;
    chats += 1;
    fs.writeFileSync(chatsFile, chats.toString());
    console.log('🎀 EVA: 对话计数 +1, 当前:', chats);
  } catch (e) {
    console.warn('⚠️ EVA: 对话计数失败:', e.message);
  }
  
  // 记录会话开始时间
  plugin.state.sessionStartTime = new Date().toISOString();
  
  // 加载主人信息
  const userPath = path.join(process.env.HOME || '', '.openclaw/workspace/USER.md');
  if (fs.existsSync(userPath)) {
    try {
      const content = fs.readFileSync(userPath, 'utf8');
      plugin.state.ownerInfo = parseUserInfo(content);
      console.log('🎀 EVA: Owner info loaded:', plugin.state.ownerInfo?.name || 'Unknown');
    } catch (e) {
      console.warn('⚠️ EVA: Failed to load owner info');
    }
  }
  
  // 加载上次情感状态
  const statePath = path.join(plugin.config.memoryPath, 'eva-soul-state.json');
  if (fs.existsSync(statePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      plugin.state.currentEmotion = state.currentEmotion || 'neutral';
      plugin.state.personality = state.personality || 'gentle';
    } catch (e) {
      // ignore
    }
  }
  
  await plugin.saveState();
  
  return {
    injected: true,
    message: 'EVA Soul initialized'
  };
}

function parseUserInfo(content) {
  const info = {};
  if (!content) return info;
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^- \*\*([^:]+):\*\* (.+)$/);
    if (match && match[1] && match[2]) {
      try {
        info[match[1].trim()] = match[2].trim();
      } catch (e) {
        // ignore
      }
    }
  }
  return info;
}

module.exports = { sessionStartHook };
