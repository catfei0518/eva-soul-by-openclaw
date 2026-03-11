/**
 * Pre-Compaction Hook - 压缩前保存状态
 */

const fs = require('fs');
const path = require('path');

async function preCompactionHook(ctx, plugin) {
  console.log('🎀 EVA: Pre-compaction state save...');
  
  // 保存当前状态
  const stateData = {
    currentEmotion: plugin.state.currentEmotion,
    personality: plugin.state.personality,
    lastInteraction: plugin.state.lastInteraction,
    ownerInfo: plugin.state.ownerInfo,
    savedAt: new Date().toISOString()
  };
  
  // 创建锚点文件
  const anchorFile = path.join(plugin.config.memoryPath, 'eva-compaction-anchor.json');
  
  try {
    fs.writeFileSync(anchorFile, JSON.stringify(stateData, null, 2));
    console.log('🎀 EVA: State saved for compaction');
  } catch (e) {
    console.warn('⚠️ EVA: Failed to save state:', e.message);
  }
  
  return ctx;
}

module.exports = { preCompactionHook };
