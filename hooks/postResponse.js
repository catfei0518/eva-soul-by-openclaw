/**
 * Post-Response Hook - 回复后自动记忆和情感更新
 */

const fs = require('fs');
const path = require('path');

async function postResponseHook(ctx, plugin) {
  console.log('🎀 EVA: Post-response processing...');
  
  const userMessage = ctx.userMessage || '';
  const assistantMessage = ctx.assistantMessage || '';
  
  if (!userMessage) {
    return ctx;
  }
  
  // 1. 自动情感检测
  if (plugin.config.autoEmotion) {
    await detectEmotion(plugin, userMessage);
  }
  
  // 2. 自动记忆重要信息
  if (plugin.config.autoMemory) {
    await autoMemory(plugin, userMessage);
  }
  
  // 更新最后交互时间
  plugin.state.lastInteraction = new Date().toISOString();
  
  await plugin.saveState();
  
  return ctx;
}

async function detectEmotion(plugin, message) {
  const emotions = {
    happy: ['开心', '高兴', '快乐', '棒', '太好了', '哈哈', '爱你', '么么哒', '😊', '😍', '好耶', 'nice', 'good'],
    sad: ['难过', '伤心', '哭', '委屈', '郁闷', '累', '心累', '不舒服', '😭', '😢', '烦', '不爽'],
    angry: ['生气', '愤怒', '气死了', '烦', '滚', '怒', 'fuck', 'shit', '草', '操']
  };
  
  const msg = message.toLowerCase();
  let detected = null;
  
  for (const [emotion, keywords] of Object.entries(emotions)) {
    if (keywords.some(k => msg.includes(k))) {
      detected = emotion;
      break;
    }
  }
  
  if (detected && detected !== plugin.state.currentEmotion) {
    const oldEmotion = plugin.state.currentEmotion;
    plugin.state.currentEmotion = detected;
    
    // 记录历史
    plugin.state.emotionHistory = plugin.state.emotionHistory || [];
    plugin.state.emotionHistory.push({
      from: oldEmotion,
      to: detected,
      time: new Date().toISOString(),
      trigger: message.substring(0, 50)
    });
    
    // 保留最近20条
    plugin.state.emotionHistory = plugin.state.emotionHistory.slice(-20);
    
    console.log(`🎀 EVA: Emotion changed: ${oldEmotion} → ${detected}`);
  }
}

async function autoMemory(plugin, message) {
  // 检测是否需要自动记忆
  const autoMemoryKeywords = [
    '记住', '重要', '别忘了', '提醒我', '生日', '纪念日',
    '喜欢', '不喜欢', '讨厌', '爱吃', '怕', '记得',
    '这是我', '我叫', '我是'
  ];
  
  const msg = message.toLowerCase();
  const shouldRemember = autoMemoryKeywords.some(k => msg.includes(k));
  
  if (shouldRemember) {
    const entry = `## 🤖 自动记忆 [${new Date().toISOString()}]

${message}

*来源: 自动检测*
---
`;
    
    const autoFile = path.join(plugin.config.memoryPath, 'eva-auto-memory.md');
    
    try {
      fs.appendFileSync(autoFile, entry);
      console.log('🎀 EVA: Auto-memory saved');
    } catch (e) {
      console.warn('⚠️ EVA: Failed to save auto-memory:', e.message);
    }
  }
}

module.exports = { postResponseHook };
