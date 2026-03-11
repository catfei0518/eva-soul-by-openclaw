/**
 * EVA Soul - 核心配置模块
 */

const path = require('path');
const fs = require('fs');

// 默认配置
const DEFAULT_CONFIG = {
  // 路径配置
  workspacePath: '~/.openclaw/workspace',
  memoryPath: '~/.openclaw/workspace/memory',
  soulScriptsPath: '~/.openclaw/workspace/skills/eva-soul-integration/eva-soul-github/scripts',
  
  // Python 配置
  pythonPath: 'python3',
  
  // 功能开关
  autoEmotion: true,
  autoMemory: true,
  autoPersonality: true,
  autoConcept: true,
  autoPattern: true,
  autoImportance: true,
  
  // 阈值配置
  importanceThreshold: 5,
  emotionSensitivity: 0.7,
  
  // 记忆配置
  memoryUpgradeDays: {
    short: 7,
    medium: 30,
    long: 90
  },
  
  // 性格配置
  personalityTraits: {
    gentle: { weight: 1.0, description: '温柔可爱' },
    cute: { weight: 1.0, description: '活泼俏皮' },
    professional: { weight: 1.0, description: '专业正式' },
    playful: { weight: 1.0, description: '轻松幽默' },
    serious: { weight: 1.0, description: '认真严谨' }
  },
  
  // 情感配置
  emotionTypes: ['happy', 'sad', 'angry', 'neutral', 'excited', 'tired', 'surprised', 'confused'],
  
  // 概念配置
  conceptUpdateInterval: 3600000, // 1小时
  conceptMinImportance: 5,
  
  // 模式配置
  patternMinOccurrence: 3,
  patternTimeWindow: 7 * 24 * 60 * 60 * 1000 // 7天
};

/**
 * 展开路径 ~
 */
function expandPath(p) {
  if (typeof p !== 'string') return p;
  if (p.startsWith('~/')) {
    return path.join(process.env.HOME || '', p.slice(2));
  }
  return p;
}

/**
 * 加载配置
 */
function loadConfig(customConfig = {}) {
  const config = { ...DEFAULT_CONFIG };
  
  // 合并自定义配置
  for (const key in customConfig) {
    if (typeof customConfig[key] === 'object' && !Array.isArray(customConfig[key])) {
      config[key] = { ...config[key], ...customConfig[key] };
    } else {
      config[key] = customConfig[key];
    }
  }
  
  // 展开路径
  config.workspacePath = expandPath(config.workspacePath);
  config.memoryPath = expandPath(config.memoryPath);
  config.soulScriptsPath = expandPath(config.soulScriptsPath);
  
  return config;
}

/**
 * 获取默认配置
 */
function getDefaultConfig() {
  return { ...DEFAULT_CONFIG };
}

module.exports = {
  DEFAULT_CONFIG,
  loadConfig,
  getDefaultConfig,
  expandPath
};
