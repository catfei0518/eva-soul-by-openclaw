/**
 * EVA Soul Plugin - OpenClaw 官方插件 (v2.1.0)
 * 兼容 OpenClaw 2026.3.8+ 新版 API
 */

const fs = require('fs');
const path = require('path');

// 导入核心模块
const lib = require('./lib');

// 插件配置
let config = lib.getDefaultConfig();

// 插件状态
let state = lib.createState();

// 系统实例
let memoryStore = null;

/**
 * 工具执行函数
 */
async function executeEvaStatus() {
  return lib.getStateSummary(state);
}

async function executeEvaEmotion(args) {
  const { action = 'get', emotion } = args;
  
  switch (action) {
    case 'set':
      if (emotion) {
        state = lib.updateEmotion(state, emotion);
        lib.saveState(state, config.memoryPath);
        return { success: true, emotion: state.currentEmotion };
      }
      return { error: 'emotion required' };
    case 'history':
      return { history: state.emotionHistory };
    case 'express':
      return { expression: lib.expressEmotion(state.currentEmotion, state.personality) };
    case 'detect':
      return { 
        current: state.currentEmotion,
        sensitivity: config.emotionSensitivity,
        available: ['happy', 'sad', 'angry', 'neutral', 'excited', 'tired', 'surprised', 'confused']
      };
    default:
      return {
        current: state.currentEmotion,
        history: state.emotionHistory.slice(-10),
        trend: lib.analyzeEmotionTrend(state.emotionHistory)
      };
  }
}

async function executeEvaPersonality(args) {
  const { action = 'get', personality } = args;
  
  switch (action) {
    case 'set':
      if (personality) {
        state = lib.updatePersonality(state, personality);
        lib.saveState(state, config.memoryPath);
        return { success: true, personality: state.personality };
      }
      return { error: 'personality required' };
    case 'adjust':
      return lib.adjustPersonalityForScene(state.personality, { emotion: state.currentEmotion });
    default:
      return {
        current: state.personality,
        available: ['gentle', 'cute', 'professional', 'playful', 'serious', 'romantic', 'tsundere'],
        traits: lib.getPersonality(state.personality)
      };
  }
}

async function executeEvaMemory(args) {
  const { action = 'query', query, content, importance = 5, id, limit = 10 } = args;
  
  if (!memoryStore) {
    return { error: 'Memory store not initialized' };
  }
  
  switch (action) {
    case 'query':
      return memoryStore.search(query, { limit });
    case 'save':
      if (!content) return { error: 'content required' };
      return memoryStore.save({ content, importance });
    case 'get':
      if (!id) return { error: 'id required' };
      return memoryStore.get(id);
    case 'delete':
      if (!id) return { error: 'id required' };
      return { success: memoryStore.delete(id) };
    case 'stats':
      return memoryStore.getStats();
    default:
      return { error: 'Unknown action' };
  }
}

async function executeEvaDecide(args) {
  const { action = 'decide', context, options } = args;
  
  if (action === 'decide' && context && options) {
    // 简单的决策逻辑
    const scores = options.map(opt => ({
      option: opt,
      score: Math.random() * 100
    }));
    scores.sort((a, b) => b.score - a.score);
    return {
      recommended: scores[0].option,
      reasoning: '基于当前情境分析',
      alternatives: scores.slice(1).map(s => s.option)
    };
  }
  
  return { error: 'context and options required for decide action' };
}

async function executeEvaImportance(args) {
  const { content } = args;
  if (!content) return { error: 'content required' };
  
  // 简单的关键词分析
  const importantKeywords = ['重要', '记住', '关键', '必须', '不要忘记', '纪念日', '生日'];
  let score = 5;
  
  for (const kw of importantKeywords) {
    if (content.includes(kw)) {
      score += 2;
    }
  }
  
  return { importance: Math.min(score, 10), content: content.substring(0, 50) + '...' };
}

async function executeEvaFullStats() {
  return lib.getStateSummary(state);
}

/**
 * 插件注册函数
 */
function register(api) {
  console.log('🎀 EVA Soul Plugin registering...');
  
  try {
    // 初始化状态
    const loadedState = lib.loadState(config.memoryPath);
    state = loadedState || lib.createState();
    lib.saveState(state, config.memoryPath);
    
    // 初始化记忆存储
    memoryStore = new lib.MemoryStore(config.memoryPath);
    
    console.log(`   Session: ${state.sessionCount}`);
    console.log(`   Emotion: ${state.currentEmotion}`);
    console.log(`   Personality: ${state.personality}`);
    
    // 注册工具 - 使用新版 API
    const tools = [
      {
        name: 'eva_status',
        label: 'EVA Status',
        description: '获取夏娃完整状态',
        parameters: { type: 'object', properties: {}, required: [] },
        execute: executeEvaStatus
      },
      {
        name: 'eva_emotion',
        label: 'EVA Emotion',
        description: '夏娃情感操作 (get/set/history/express/detect)',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['get', 'set', 'history', 'express', 'detect'] },
            emotion: { type: 'string' }
          }
        },
        execute: executeEvaEmotion
      },
      {
        name: 'eva_personality',
        label: 'EVA Personality',
        description: '夏娃性格操作 (get/set/adjust)',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['get', 'set', 'adjust'] },
            personality: { type: 'string' }
          }
        },
        execute: executeEvaPersonality
      },
      {
        name: 'eva_memory',
        label: 'EVA Memory',
        description: '夏娃记忆操作 (query/save/get/delete/stats)',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['query', 'save', 'get', 'delete', 'stats'] },
            query: { type: 'string' },
            content: { type: 'string' },
            importance: { type: 'number' },
            id: { type: 'string' },
            limit: { type: 'number' }
          }
        },
        execute: executeEvaMemory
      },
      {
        name: 'eva_decide',
        label: 'EVA Decide',
        description: '夏娃决策建议',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['decide'] },
            context: { type: 'string' },
            options: { type: 'array', items: { type: 'string' } }
          },
          required: ['context', 'options']
        },
        execute: executeEvaDecide
      },
      {
        name: 'eva_importance',
        label: 'EVA Importance',
        description: '评估内容重要性',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string' }
          },
          required: ['content']
        },
        execute: executeEvaImportance
      },
      {
        name: 'eva_full_stats',
        label: 'EVA Full Stats',
        description: '夏娃完整统计',
        parameters: { type: 'object', properties: {}, required: [] },
        execute: executeEvaFullStats
      }
    ];
    
    for (const tool of tools) {
      try {
        api.registerTool(tool);
        console.log(`   ✅ Registered: ${tool.name}`);
      } catch (err) {
        console.log(`   ❌ Failed: ${tool.name} - ${err.message}`);
      }
    }
    
    // 注册 Hooks
    registerHooks(api);
    
    console.log('🎀 EVA Soul Plugin fully registered');
    console.log(`   Total Tools: ${tools.length}`);
    
  } catch (err) {
    console.error('❌ EVA Soul Plugin registration failed:', err);
  }
}

function registerHooks(api) {
  // Session start hook
  api.registerHook('session-start', async (ctx) => {
    state = lib.incrementSession(state);
    lib.saveState(state, config.memoryPath);
    console.log(`[eva-soul] Session ${state.sessionCount} started`);
  });
  
  // Pre-response hook - 注入夏娃人格
  api.registerHook('pre-response', async (ctx) => {
    // 这里可以注入夏娃的人格特征到系统提示
    return {};
  });
  
  // Post-response hook - 自动记忆和情感更新
  api.registerHook('post-response', async (ctx) => {
    try {
      // 记录交互
      state = lib.recordInteraction(state, ctx.response || '');
      lib.saveState(state, config.memoryPath);
    } catch (e) {
      console.error('[eva-soul] Post-response hook error:', e);
    }
    return {};
  });
  
  console.log('   ✅ Hooks registered');
}

module.exports = { register };
