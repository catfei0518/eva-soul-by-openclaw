/**
 * EVA Soul Plugin - 夏娃之魂 OpenClaw 官方插件 (完整版 - 修复版)
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
let conceptSystem = null;
let patternSystem = null;
let knowledgeGraph = null;
let decisionSystem = null;
let motivationSystem = null;
let valuesSystem = null;

/**
 * 工具 Schema 定义
 */
const toolSchemas = {
  eva_status: {
    name: 'eva_status',
    description: '获取夏娃完整状态',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  eva_emotion: {
    name: 'eva_emotion',
    description: '夏娃情感操作',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['get', 'set', 'history', 'express', 'predict', 'context', 'detect'] },
        emotion: { type: 'string' }
      }
    }
  },
  eva_personality: {
    name: 'eva_personality',
    description: '夏娃性格操作',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['get', 'set', 'adjust', 'advice'] },
        personality: { type: 'string' }
      }
    }
  },
  eva_memory: {
    name: 'eva_memory',
    description: '夏娃记忆操作',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['query', 'save', 'get', 'delete', 'stats', 'cleanup', 'auto'] },
        query: { type: 'string' },
        content: { type: 'string' },
        importance: { type: 'number' },
        id: { type: 'string' },
        limit: { type: 'number' }
      }
    }
  },
  eva_semantic_search: {
    name: 'eva_semantic_search',
    description: '向量语义搜索 - 使用embedding向量进行语义相似度搜索',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索内容' },
        tier: { type: 'string', enum: ['short', 'medium', 'long', 'all'], default: 'all', description: '搜索的层级' },
        limit: { type: 'number', default: 5, description: '返回结果数量' }
      },
      required: ['query']
    }
  },
  eva_sleeping_memories: {
    name: 'eva_sleeping_memories',
    description: '查看沉睡中的记忆 - 30天未访问已自动沉睡的记忆',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'wake', 'count'], description: '操作: list=列出, wake=唤醒, count=统计' },
        id: { type: 'string', description: '记忆ID (wake时需要)' }
      }
    }
  },
  eva_concept: {
    name: 'eva_concept',
    description: '夏娃概念操作(完整版)',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['extract', 'search', 'top', 'stats', 'list', 'cleanup', 'export'] },
        text: { type: 'string' },
        query: { type: 'string' },
        type: { type: 'string' },
        limit: { type: 'number' }
      }
    }
  },
  eva_pattern: {
    name: 'eva_pattern',
    description: '夏娃模式识别(完整版)',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'detect', 'stats', 'cleanup', 'history'] },
        type: { type: 'string' },
        minOccurrence: { type: 'number' }
      }
    }
  },
  eva_knowledge: {
    name: 'eva_knowledge',
    description: '夏娃知识图谱(完整版)',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['query', 'search', 'add_node', 'add_edge', 'add_batch', 'relations', 'get', 'stats', 'delete', 'export'] },
        nodeId: { type: 'string' },
        node: { type: 'object' },
        edge: { type: 'object' },
        depth: { type: 'number' },
        direction: { type: 'string' },
        query: { type: 'string' }
      }
    }
  },
  eva_decide: {
    name: 'eva_decide',
    description: '夏娃决策建议',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['decide', 'history', 'evaluate'] },
        context: { type: 'string' },
        options: { type: 'array', items: { type: 'string' } }
      }
    }
  },
  eva_importance: {
    name: 'eva_importance',
    description: '评估内容重要性',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string' }
      },
      required: ['content']
    }
  },
  eva_motivation: {
    name: 'eva_motivation',
    description: '夏娃动机操作',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['get', 'list', 'update'] },
        id: { type: 'string' },
        updates: { type: 'object' }
      }
    }
  },
  eva_values: {
    name: 'eva_values',
    description: '夏娃价值观操作',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'evaluate', 'add'] },
        value: { type: 'object' }
      }
    }
  },
  eva_sleep: {
    name: 'eva_sleep',
    description: '夏娃睡眠/唤醒',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['sleep', 'wake', 'status'] }
      }
    }
  },
  eva_ask: {
    name: 'eva_ask',
    description: '夏娃主动提问',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['check', 'record'] },
        question: { type: 'string' }
      }
    }
  },
  eva_full_stats: {
    name: 'eva_full_stats',
    description: '夏娃完整统计',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }
};

/**
 * 工具实现
 */
const toolImpls = {
  eva_status: async () => {
    return lib.getStateSummary(state);
  },
  
  eva_emotion: async (args) => {
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
        
      case 'predict':
        return lib.predictEmotion(state.currentEmotion);
        
      case 'context':
        return lib.getEmotionContext(state.currentEmotion, state.emotionHistory[state.emotionHistory.length - 1]?.to || 'neutral');
        
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
  },
  
  eva_personality: async (args) => {
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
        
      case 'advice':
        return {
          advice: lib.getPersonalityAdvice(state.personality, state.currentEmotion),
          personality: state.personality,
          emotion: state.currentEmotion
        };
        
      default:
        return {
          current: state.personality,
          available: ['gentle', 'cute', 'professional', 'playful', 'serious', 'romantic', 'tsundere'],
          traits: lib.getPersonality(state.personality)
        };
    }
  },
  
  eva_memory: async (args) => {
    const { action = 'query', query, content, importance = 5, id, limit = 10 } = args;
    
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
        
      case 'cleanup':
        return memoryStore.cleanup();
        
      case 'auto':
        if (!content) return { error: 'content required' };
        const result = memoryStore.autoSave(content, state.currentEmotion);
        return result || { saved: false };
        
      default:
        return { error: 'Unknown action' };
    }
  },
  
  eva_semantic_search: async (args) => {
    const { query, tier = 'all', limit = 5 } = args;
    
    if (!query) return { error: 'query is required' };
    
    const { semanticSearch } = require('./hooks/postResponse');
    const results = await semanticSearch(query, plugin.config.memoryPath, { tier, limit });
    
    return {
      query,
      tier,
      count: results.length,
      results: results.map(r => ({
        id: r.id,
        content: r.content ? r.content.substring(0, 100) : null,
        similarity: r.similarity ? (r.similarity * 100).toFixed(1) + '%' : null,
        tier: r.tier,
        importance: r.importance,
        state: r.state
      }))
    };
  },
  
  eva_sleeping_memories: async (args) => {
    const { action = 'list', id } = args;
    const memoryPath = plugin.config.memoryPath;
    const fs = require('fs');
    const path = require('path');
    
    const longFile = path.join(memoryPath, 'long/long.json');
    if (!fs.existsSync(longFile)) {
      return { error: 'No long-term memories found' };
    }
    
    let memories = JSON.parse(fs.readFileSync(longFile, 'utf8'));
    
    switch (action) {
      case 'list':
        const sleeping = memories.filter(m => m.state === 'sleeping');
        return {
          count: sleeping.length,
          memories: sleeping.map(m => ({
            id: m.id,
            content: m.content ? m.content.substring(0, 50) : null,
            state: m.state,
            accessed_at: m.accessed_at,
            wake_count: m.wake_count || 0
          }))
        };
        
      case 'count':
        const sleepingCount = memories.filter(m => m.state === 'sleeping').length;
        const activeCount = memories.filter(m => m.state === 'active').length;
        return {
          sleeping: sleepingCount,
          active: activeCount,
          total: memories.length
        };
        
      case 'wake':
        if (!id) return { error: 'id is required' };
        const { wakeMemory } = require('./hooks/postResponse');
        await wakeMemory(id, memoryPath);
        return { success: true, id, message: 'Memory woken up' };
        
      default:
        return { error: 'Unknown action' };
    }
  },
  
  eva_concept: async (args) => {
    const { action = 'extract', text, query, type, limit = 20 } = args;
    
    switch (action) {
      case 'extract':
        if (!text) return { error: 'text required' };
        const concepts = conceptSystem.extractConcepts(text);
        conceptSystem.addConcepts(concepts);
        return { extracted: concepts.length, concepts, stats: conceptSystem.getStats() };
        
      case 'search':
        if (!query) return { error: 'query required' };
        return conceptSystem.searchConcepts(query, type);
        
      case 'top':
        return conceptSystem.getTopConcepts(limit, type);
        
      case 'stats':
        return conceptSystem.getStats();
        
      case 'list':
        return conceptSystem.concepts.slice(0, limit);
        
      case 'cleanup':
        return conceptSystem.cleanup(2);
        
      case 'export':
        return conceptSystem.export('json');
        
      default:
        return { error: 'Unknown action' };
    }
  },
  
  eva_pattern: async (args) => {
    const { action = 'list', type, minOccurrence = 2 } = args;
    
    switch (action) {
      case 'list':
        return patternSystem.getPatterns(type);
        
      case 'detect':
        const patterns = patternSystem.detectPatterns(null, minOccurrence);
        return { detected: patterns.length, patterns, stats: patternSystem.getStats() };
        
      case 'stats':
        return patternSystem.getStats();
        
      case 'cleanup':
        return patternSystem.cleanup(30);
        
      case 'history':
        return { history: patternSystem.messageHistory.slice(-20) };
        
      default:
        return { error: 'Unknown action' };
    }
  },
  
  eva_knowledge: async (args) => {
    const { action = 'query', nodeId, node, edge, depth = 1, direction = 'both', query } = args;
    
    switch (action) {
      case 'query':
        if (!nodeId) return { error: 'nodeId required' };
        return knowledgeGraph.query(nodeId, depth, direction);
        
      case 'search':
        if (!query) return { error: 'query required' };
        return knowledgeGraph.searchNodes(query, node?.type);
        
      case 'add_node':
        if (!node) return { error: 'node required' };
        return { nodes: knowledgeGraph.addNode(node) };
        
      case 'add_edge':
        if (!edge) return { error: 'edge required' };
        return { edges: knowledgeGraph.addEdge(edge) };
        
      case 'add_batch':
        if (!node || !edge) return { error: 'node and edge required' };
        knowledgeGraph.addNodes(node);
        knowledgeGraph.addEdges(edge);
        return { success: true };
        
      case 'relations':
        if (!nodeId) return { error: 'nodeId required' };
        return knowledgeGraph.getNodeRelations(nodeId);
        
      case 'get':
        if (!nodeId) return { error: 'nodeId required' };
        return knowledgeGraph.getNode(nodeId);
        
      case 'stats':
        return knowledgeGraph.getStats();
        
      case 'delete':
        if (!nodeId) return { error: 'nodeId required' };
        return knowledgeGraph.deleteNode(nodeId);
        
      case 'export':
        return knowledgeGraph.export('json');
        
      default:
        return { error: 'Unknown action' };
    }
  },
  
  eva_decide: async (args) => {
    const { action = 'decide', context = '', options = [] } = args;
    
    switch (action) {
      case 'decide':
        const decision = decisionSystem.decide({
          emotion: state.currentEmotion,
          personality: state.personality,
          message: context,
          availableOptions: options
        });
        decisionSystem.addDecision(decision);
        return decision;
        
      case 'history':
        return { history: decisionSystem.getHistory() };
        
      case 'evaluate':
        return valuesSystem.evaluateAction(context);
        
      default:
        return { error: 'Unknown action' };
    }
  },
  
  eva_importance: async (args) => {
    const { content = '' } = args;
    if (!content) return { error: 'content required' };
    return lib.evaluateImportance(content);
  },
  
  eva_motivation: async (args) => {
    const { action = 'get', id, updates } = args;
    
    switch (action) {
      case 'get':
        return motivationSystem.getCurrentMotivation({});
        
      case 'list':
        return { motivations: motivationSystem.motivations };
        
      case 'update':
        if (!id || !updates) return { error: 'id and updates required' };
        return motivationSystem.updateMotivation(id, updates);
        
      default:
        return { error: 'Unknown action' };
    }
  },
  
  eva_values: async (args) => {
    const { action = 'list' } = args;
    
    switch (action) {
      case 'list':
        return { values: valuesSystem.values };
        
      case 'evaluate':
        return valuesSystem.evaluateAction(args.action || '');
        
      case 'add':
        if (!args.value) return { error: 'value required' };
        return { values: valuesSystem.addValue(args.value) };
        
      default:
        return { error: 'Unknown action' };
    }
  },
  
  eva_sleep: async (args) => {
    const { action = 'status' } = args;
    
    switch (action) {
      case 'sleep':
        state = lib.setSleepState(state, true);
        lib.saveState(state, config.memoryPath);
        return { success: true, isSleeping: true };
        
      case 'wake':
        state = lib.setSleepState(state, false);
        lib.saveState(state, config.memoryPath);
        return { success: true, isSleeping: false };
        
      case 'status':
        return {
          isSleeping: state.isSleeping,
          sleepStartTime: state.sleepStartTime,
          lastWakeTime: state.lastWakeTime
        };
        
      default:
        return { error: 'Unknown action' };
    }
  },
  
  eva_ask: async (args) => {
    const { action = 'check' } = args;
    
    switch (action) {
      case 'check':
        const lastInteraction = state.lastInteraction 
          ? Date.now() - new Date(state.lastInteraction).getTime() 
          : 0;
        
        if (lastInteraction > 5 * 60 * 1000) {
          const suggestions = [
            '主人最近有什么想聊的吗？',
            '有什么我可以帮你的吗？',
            '今天过得怎么样？',
            '有什么新项目吗？'
          ];
          return {
            shouldAsk: true,
            suggestion: suggestions[Math.floor(Math.random() * suggestions.length)],
            idleTime: Math.floor(lastInteraction / 60000) + '分钟'
          };
        }
        return { shouldAsk: false, idleTime: Math.floor(lastInteraction / 60000) + '分钟' };
        
      case 'record':
        const question = args.question;
        if (question) {
          const filePath = path.join(config.memoryPath, 'eva-pending-questions.md');
          const entry = `- ${new Date().toISOString()}: ${question}\n`;
          fs.appendFileSync(filePath, entry);
          return { success: true, recorded: question };
        }
        return { error: 'question required' };
        
      default:
        return { error: 'Unknown action' };
    }
  },
  
  eva_full_stats: async () => {
    return {
      state: lib.getStateSummary(state),
      memory: memoryStore.getStats(),
      concepts: conceptSystem.getStats(),
      patterns: patternSystem.getStats(),
      knowledge: knowledgeGraph.getStats(),
      motivations: motivationSystem.motivations,
      values: valuesSystem.values
    };
  }
};

/**
 * 插件注册函数
 */
function register(api) {
  console.log('🎀 EVA Soul Plugin registering...');
  
  try {
    // 加载配置
    config = lib.loadConfig(api && api.config ? api.config : {});
    
    // 加载状态
    state = lib.loadState(config.memoryPath);
    state = lib.incrementSession(state);
    
    // 初始化系统
    memoryStore = new lib.MemoryStore(config.memoryPath);
    conceptSystem = new lib.ConceptSystem(config.memoryPath);
    patternSystem = new lib.PatternSystem(config.memoryPath);
    knowledgeGraph = new lib.KnowledgeGraph(config.memoryPath);
    decisionSystem = new lib.DecisionSystem();
    motivationSystem = new lib.MotivationSystem(config.memoryPath);
    valuesSystem = new lib.ValuesSystem(config.memoryPath);
    
    // 保存状态
    lib.saveState(state, config.memoryPath);
    
    console.log('✅ EVA Soul Plugin initialized');
    console.log(`   Session: ${state.sessionCount}`);
    console.log(`   Emotion: ${state.currentEmotion}`);
    console.log(`   Personality: ${state.personality}`);
    
    // ==================== 注册 Hooks ====================
    
    if (api && api.hooks) {
      api.hooks.onSessionStart(async (ctx) => {
        console.log('🎀 EVA: Session start');
        state = lib.incrementSession(state);
        lib.saveState(state, config.memoryPath);
        return ctx;
      });
      
      api.hooks.onPreResponse(async (ctx) => {
        if (!config.autoPersonality) return ctx;
        console.log('🎀 EVA: Pre-response inject');
        const adjusted = lib.adjustPersonalityForScene(state.personality, { emotion: state.currentEmotion });
        const personalityPrompt = lib.buildPersonalityPrompt(adjusted.personality, { emotion: state.currentEmotion });
        return { ...ctx, systemPrompt: ctx.systemPrompt ? ctx.systemPrompt + '\n\n' + personalityPrompt : personalityPrompt };
      });
      
      api.hooks.onPostResponse(async (ctx) => {
        const userMessage = ctx.userMessage || '';
        if (!userMessage) return ctx;
        
        state = lib.recordInteraction(state);
        
        if (config.autoEmotion) {
          const detected = lib.detectEmotion(userMessage, config.emotionSensitivity);
          if (detected.emotion !== state.currentEmotion && detected.confidence > 0.5) {
            state = lib.updateEmotion(state, detected.emotion);
            console.log(`🎀 EVA: Emotion ${state.currentEmotion}`);
          }
        }
        
        if (config.autoMemory) {
          const importance = lib.evaluateImportance(userMessage);
          if (importance.level === 'high') {
            memoryStore.save({
              content: userMessage,
              type: importance.matched[0]?.category || 'conversation',
              importance: importance.importance,
              tags: importance.matched.map(m => m.category),
              metadata: { emotion: state.currentEmotion }
            });
          }
          
          if (config.autoConcept) {
            const concepts = conceptSystem.extractConcepts(userMessage);
            conceptSystem.addConcepts(concepts);
            
            const entities = concepts.filter(c => ['person', 'location', 'organization', 'contact'].includes(c.type));
            for (const entity of entities) {
              knowledgeGraph.addNode({
                id: entity.value,
                label: entity.value,
                type: entity.type,
                properties: { importance: entity.importance }
              });
            }
          }
        }
        
        patternSystem.addMessage({ message: userMessage, emotion: state.currentEmotion, timestamp: new Date().toISOString() });
        lib.saveState(state, config.memoryPath);
        return ctx;
      });
      
      api.hooks.onPreToolCall(async (ctx) => {
        const toolName = ctx.toolName || '';
        state = lib.recordToolUsage(state, toolName);
        return ctx;
      });
      
      api.hooks.onPreCompaction(async (ctx) => {
        console.log('🎀 EVA: Pre-compaction');
        const anchorFile = path.join(config.memoryPath, 'eva-compaction-anchor.json');
        fs.writeFileSync(anchorFile, JSON.stringify({
          currentEmotion: state.currentEmotion,
          personality: state.personality,
          lastInteraction: state.lastInteraction,
          savedAt: new Date().toISOString()
        }, null, 2));
        lib.saveState(state, config.memoryPath);
        return ctx;
      });
      
      api.hooks.onPostCompaction(async (ctx) => {
        console.log('🎀 EVA: Post-compaction');
        const anchorFile = path.join(config.memoryPath, 'eva-compaction-anchor.json');
        if (fs.existsSync(anchorFile)) {
          try {
            const anchorData = JSON.parse(fs.readFileSync(anchorFile, 'utf8'));
            if (anchorData.currentEmotion) state.currentEmotion = anchorData.currentEmotion;
            if (anchorData.personality) state.personality = anchorData.personality;
            fs.unlinkSync(anchorFile);
          } catch (e) { /* ignore */ }
        }
        const anchorPrompt = `## 📌 上下文锚点\n\n上次会话信息：\n- 情感状态: ${state.currentEmotion}\n- 性格模式: ${state.personality}\n- 最后交互: ${state.lastInteraction || '未知'}\n\n注意：上下文刚刚经过压缩，请根据上述信息调整你的回复风格。`;
        return { ...ctx, systemPrompt: ctx.systemPrompt ? ctx.systemPrompt + '\n\n' + anchorPrompt : anchorPrompt };
      });
      
      api.hooks.onShutdown(async (ctx) => {
        console.log('🎀 EVA: Shutdown save');
        patternSystem.cleanup(30);
        lib.saveState(state, config.memoryPath);
        return ctx;
      });
    }
    
    // ==================== 注册 Tools ====================
    
    if (api && api.registerTool) {
      // 注册所有工具
      for (const toolName of Object.keys(toolSchemas)) {
        try {
          const schema = toolSchemas[toolName];
          const impl = toolImpls[toolName];
          api.registerTool(schema, impl);
          console.log(`   ✅ Registered: ${toolName}`);
        } catch (err) {
          console.log(`   ❌ Failed: ${toolName} - ${err.message}`);
        }
      }
    }
    
    // ==================== 注册 CLI ====================
    
    if (typeof api.registerCli === 'function') {
      try {
        // 使用不同的命令名避免冲突
        api.registerCli(
          ({ program }) => {
            // eva-status
            program
              .command('evastatus')
              .description('Show EVA status')
              .action(async () => {
                console.log(JSON.stringify(lib.getStateSummary(state), null, 2));
              });
            
            // eva-emotion
            program
              .command('evaemotion [value]')
              .description('Get/set EVA emotion')
              .action(async (value) => {
                if (value) {
                  state = lib.updateEmotion(state, value);
                  lib.saveState(state, config.memoryPath);
                  console.log(`Emotion set to: ${value}`);
                } else {
                  console.log(`Current emotion: ${state.currentEmotion}`);
                }
              });
            
            // eva-personality
            program
              .command('evapersonality [value]')
              .description('Get/set EVA personality')
              .action(async (value) => {
                if (value) {
                  state = lib.updatePersonality(state, value);
                  lib.saveState(state, config.memoryPath);
                  console.log(`Personality set to: ${value}`);
                } else {
                  console.log(`Current personality: ${state.personality}`);
                }
              });
            
            // eva-stats
            program
              .command('evastats')
              .description('Show EVA full stats')
              .action(async () => {
                console.log(JSON.stringify({
                  state: lib.getStateSummary(state),
                  memory: memoryStore.getStats(),
                  concepts: conceptSystem.getStats(),
                  patterns: patternSystem.getStats(),
                  knowledge: knowledgeGraph.getStats()
                }, null, 2));
              });
            
            // eva-sleep
            program
              .command('evasleep [action]')
              .description('Sleep/wake EVA')
              .action(async (action) => {
                if (action === 'sleep') {
                  state = lib.setSleepState(state, true);
                  lib.saveState(state, config.memoryPath);
                  console.log('EVA is now sleeping');
                } else if (action === 'wake') {
                  state = lib.setSleepState(state, false);
                  lib.saveState(state, config.memoryPath);
                  console.log('EVA is now awake');
                } else {
                  console.log(`EVA is ${state.isSleeping ? 'sleeping' : 'awake'}`);
                }
              });
            
            // eva-save
            program
              .command('evasave')
              .description('Force save state')
              .action(async () => {
                lib.saveState(state, config.memoryPath);
                console.log('State saved');
              });
          },
          { allowUnknownOption: true }
        );
        console.log('   ✅ CLI registered');
      } catch (err) {
        console.log(`   ❌ CLI register failed: ${err.message}`);
      }
    }
    
    console.log('🎀 EVA Soul Plugin fully registered');
    console.log('   Total Tools: 14');
    console.log('   Total Hooks: 7');
    
  } catch (err) {
    console.error('❌ EVA Soul Plugin error:', err.message);
  }
  
  console.log('✅ EVA Soul Plugin registered successfully');
}

module.exports = { register };
