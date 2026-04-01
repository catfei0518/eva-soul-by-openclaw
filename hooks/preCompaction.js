/**
 * Pre-Compaction Hook - 压缩前保存状态
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

async function preCompactionHook(ctx, plugin) {
  logger.hook('Pre-compaction state save...', 'preCompaction');

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
    logger.hook('State saved for compaction', 'preCompaction');
  } catch (e) {
    logger.hookWarn(`Failed to save state: ${e.message}`, 'preCompaction');
  }

  return ctx;
}

module.exports = { preCompactionHook };
