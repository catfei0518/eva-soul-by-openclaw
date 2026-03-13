/**
 * Post-Response Hook - 回复后自动记忆和情感更新
 * 
 * 分层记忆规则 (2026-03-11 更新):
 * - 短期记忆：每次对话保存，24小时后无重要升级则归档
 * - 中期记忆：保留7天，无重要升级则归档
 * - 长期记忆：重要内容永久保存
 * - 向量语义检索：支持相似度搜索
 * - 沉睡/唤醒：不常用的记忆自动沉睡
 * - 访问频率权重：经常访问=更重要
 * - 错误处理：API重试、降级处理、错误日志
 */

const fs = require('fs');
const path = require('path');
const { fetchWithRetry, logError, apiCache } = require('./errorHandler');
const { perfMonitor } = require('./performanceMonitor');
const { getAIName, getUserConfig } = require('../lib/core/config');

const MEMORY_CONFIG = {
  short: {
    file: 'short/short.json',
    maxAge: 24 * 60 * 60 * 1000, // 24小时
    importanceThreshold: 7 // 重要度>=7升级到中期
  },
  medium: {
    file: 'medium/medium.json',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
    importanceThreshold: 9 // 重要度>=9升级到长期
  },
  long: {
    file: 'long/long.json',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30天后沉睡
    importanceThreshold: 9
  },
  archive: {
    dir: 'archive'
  }
};

// 向量配置 (使用硅基流动API)
const VECTOR_CONFIG = {
  enabled: true,
  apiKey: process.env.SILICONFLOW_API_KEY || 'sk-niomirqoomaiylusfestoavpaflrvcmrygsoarocroladwvt',
  model: 'BAAI/bge-large-zh-v1.5',
  apiUrl: 'https://api.siliconflow.cn/v1/embeddings'
};

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
  
  // 2. 每次对话保存到短期记忆
  if (plugin.config.autoMemory) {
    await saveDialogueToShortTerm(plugin, userMessage, assistantMessage);
  }
  
  // 3. 定期清理过期记忆 (每小时检查一次)
  await cleanupExpiredMemories(plugin);
  
  // 4. 沉睡/唤醒检查
  await checkSleepWake(plugin);
  
  // 更新最后交互时间
  plugin.state.lastInteraction = new Date().toISOString();
  
  // 对话计数 +1
  console.log('🎀 EVA: 触发对话计数');
  const chatsFile = '/home/node/.openclaw/workspace/chats.txt';
  try {
    let chats = parseInt(fs.readFileSync(chatsFile, 'utf8')) || 0;
    chats += 1;
    fs.writeFileSync(chatsFile, chats.toString());
  } catch (e) {
    console.warn('⚠️ EVA: 对话计数失败:', e.message);
  }
  
  await plugin.saveState();
  
  return ctx;
}

/**
 * 每次对话保存到短期记忆
 */
async function saveDialogueToShortTerm(plugin, userMessage, assistantMessage) {
  const memoryPath = plugin.config.memoryPath;
  const shortFile = path.join(memoryPath, MEMORY_CONFIG.short.file);
  
  // 评估重要性
  const importance = evaluateImportance(userMessage, assistantMessage);
  
  // === 理解层: 对重要对话进行AI摘要 ===
  let understanding = null;
  if (importance >= 6) {
    try {
      understanding = await understandContent(userMessage, assistantMessage);
      console.log('🎀 EVA: 理解层 - ' + (understanding?.summary?.substring(0, 30) || '无'));
    } catch (e) {
      console.warn('⚠️ EVA: 理解层失败:', e.message);
    }
  }
  
  // 创建记忆条目
  const memory = {
    id: `短_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    content: userMessage,
    response: assistantMessage ? assistantMessage.substring(0, 200) : '',
    type: '短期',
    importance: importance,
    created_at: new Date().toISOString(),
    accessed_at: new Date().toISOString(),
    accessed_count: 1,
    wake_count: 0,
    state: 'active',
    source: 'dialogue',
    emotion: plugin.state.currentEmotion || 'neutral',
    emotion_intensity: plugin.state.emotionIntensity || 0,
    tags: extractTags(userMessage, { emotion: plugin.state.currentEmotion, intensity: plugin.state.emotionIntensity }),
    // 理解层新增字段
    understanding: understanding,
    embedding: null // 向量 (后续生成)
  };
  
  // 读取现有记忆
  let shortMemories = [];
  if (fs.existsSync(shortFile)) {
    try {
      shortMemories = JSON.parse(fs.readFileSync(shortFile, 'utf8'));
    } catch (e) {
      shortMemories = [];
    }
  }
  
  // 添加新记忆
  shortMemories.unshift(memory);
  
  // 限制短期记忆最大数量 (保留最近200条)
  if (shortMemories.length > 200) {
    shortMemories = shortMemories.slice(0, 200);
  }
  
  // 保存
  fs.writeFileSync(shortFile, JSON.stringify(shortMemories, null, 2));
  console.log(`🎀 EVA: 对话已保存到短期记忆 (重要度: ${importance})`);
  
  // 异步生成向量
  if (VECTOR_CONFIG.enabled) {
    generateEmbedding(memory.id, userMessage, memoryPath);
  }
}

/**
 * 生成向量嵌入
 */
async function generateEmbedding(memoryId, content, memoryPath) {
  const startTime = Date.now();
  
  try {
    // 使用缓存
    const cacheKey = `emb_${content.substring(0, 50)}`;
    if (apiCache.has(cacheKey)) {
      console.log('🎀 EVA: 使用缓存embedding');
      perfMonitor.recordCacheHit(true);
      return;
    }
    perfMonitor.recordCacheHit(false);
    
    const response = await fetchWithRetry(VECTOR_CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VECTOR_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: VECTOR_CONFIG.model,
        input: [content]
      })
    }, { maxRetries: 3, timeout: 15000 });
    
    const data = await response.json();
    if (data.data && data.data[0]) {
      const embedding = data.data[0].embedding;
      apiCache.set(cacheKey, embedding); // 缓存
      await saveEmbedding(memoryId, embedding, memoryPath);
      perfMonitor.recordApiCall(true, Date.now() - startTime);
    }
  } catch (e) {
    perfMonitor.recordApiCall(false, Date.now() - startTime, e);
    console.warn('⚠️ EVA: 向量生成失败:', e.message);
  }
}

/**
 * 保存向量到记忆
 */
async function saveEmbedding(memoryId, embedding, memoryPath) {
  const tiers = ['short', 'medium', 'long'];
  
  for (const tier of tiers) {
    const file = path.join(memoryPath, `${tier}/${tier}.json`);
    if (!fs.existsSync(file)) continue;
    
    let memories = JSON.parse(fs.readFileSync(file, 'utf8'));
    let found = false;
    
    for (const m of memories) {
      if (m.id === memoryId) {
        m.embedding = embedding;
        found = true;
        break;
      }
    }
    
    if (found) {
      fs.writeFileSync(file, JSON.stringify(memories, null, 2));
      break;
    }
  }
}

/**
 * 向量语义检索
 */
async function semanticSearch(query, memoryPath, options = {}) {
  const { tier = 'all', limit = 5 } = options;
  const results = [];
  
  // 解析查询意图
  const queryIntent = parseQueryIntent(query);
  
  try {
    // 生成查询向量
    const response = await fetch(VECTOR_CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VECTOR_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: VECTOR_CONFIG.model,
        input: [query]
      })
    });
    
    const data = await response.json();
    const queryEmbedding = data.data[0].embedding;
    
    // 搜索所有层级
    const tiers = tier === 'all' ? ['short', 'medium', 'long'] : [tier];
    
    for (const t of tiers) {
      const file = path.join(memoryPath, `${t}/${t}.json`);
      if (!fs.existsSync(file)) continue;
      
      const memories = JSON.parse(fs.readFileSync(file, 'utf8'));
      
      for (const m of memories) {
        if (m.state === 'archived') continue;
        
        let similarity = 0;
        let matchField = '';
        
        // 1. 向量搜索 (如果存在)
        if (m.embedding) {
          similarity = Math.max(similarity, cosineSimilarity(queryEmbedding, m.embedding));
          if (similarity > 0) matchField = 'content';
        }
        
        // 2. 搜索 understanding 字段
        if (m.understanding) {
          const u = m.understanding;
          
          // 根据查询意图搜索对应字段
          if (queryIntent.where && u.where) {
            const sim = cosineSimilarity(queryEmbedding, await getEmbedding(queryIntent.where));
            if (sim > similarity) {
              similarity = sim;
              matchField = 'understanding.where';
            }
          }
          if (queryIntent.when && u.when) {
            const sim = cosineSimilarity(queryEmbedding, await getEmbedding(queryIntent.when));
            if (sim > similarity) {
              similarity = sim;
              matchField = 'understanding.when';
            }
          }
          if (queryIntent.emotion && u.emotion) {
            const sim = cosineSimilarity(queryEmbedding, await getEmbedding(u.emotion));
            if (sim > similarity) {
              similarity = sim;
              matchField = 'understanding.emotion';
            }
          }
          if (queryIntent.who && u.who) {
            const sim = cosineSimilarity(queryEmbedding, await getEmbedding(u.who));
            if (sim > similarity) {
              similarity = sim;
              matchField = 'understanding.who';
            }
          }
          if (queryIntent.what && u.what) {
            const sim = cosineSimilarity(queryEmbedding, await getEmbedding(u.what));
            if (sim > similarity) {
              similarity = sim;
              matchField = 'understanding.what';
            }
          }
          
          // 也搜索summary字段
          if (u.summary) {
            const sim = cosineSimilarity(queryEmbedding, await getEmbedding(u.summary));
            if (sim > similarity) {
              similarity = sim;
              matchField = 'understanding.summary';
            }
          }
        }
        
        if (similarity > 0.3) {
          results.push({ ...m, similarity, matchField, tier: t, source: 'vector' });
        }
      }
    }
    
    // 搜索MEMORY.md (文本匹配)
    const memoryMDResults = await searchMemoryMD(query, memoryPath, limit);
    results.push(...memoryMDResults);
    
    // 按相似度排序
    results.sort((a, b) => b.similarity - a.similarity);
    
    return results.slice(0, limit);
  } catch (e) {
    console.warn('⚠️ EVA: 语义搜索失败:', e.message);
    // 如果向量搜索失败，只返回MEMORY.md结果
    try {
      const memoryMDResults = await searchMemoryMD(query, memoryPath, limit);
      return memoryMDResults;
    } catch (e2) {
      return [];
    }
  }
}

/**
 * 解析查询意图
 */
function parseQueryIntent(query) {
  const q = query.toLowerCase();
  const intent = {};
  
  // 地点相关
  if (q.includes('去哪') || q.includes('哪里') || q.includes('地点') || q.includes('位置')) {
    intent.where = q;
  }
  // 时间相关
  if (q.includes('什么时候') || q.includes('几点') || q.includes('哪天') || q.includes('时间')) {
    intent.when = q;
  }
  // 情感相关
  if (q.includes('情绪') || q.includes('心情') || q.includes('开心') || q.includes('难过')) {
    intent.emotion = q;
  }
  // 人物相关
  if (q.includes('谁') || q.includes('某人')) {
    intent.who = q;
  }
  // 事件相关
  if (q.includes('什么') || q.includes('干嘛') || q.includes('事情')) {
    intent.what = q;
  }
  
  return intent;
}

/**
 * 获取文本向量 (用于understanding字段搜索)
 */
async function getEmbedding(text) {
  if (!text) return null;
  
  try {
    const response = await fetch(VECTOR_CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VECTOR_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: VECTOR_CONFIG.model,
        input: [text]
      })
    });
    
    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (e) {
    return null;
  }
}

/**
 * 搜索MEMORY.md (文本匹配)
 */
async function searchMemoryMD(query, memoryPath, limit = 5) {
  const results = [];
  
  try {
    // 找到workspace根目录的MEMORY.md
    const workspacePath = path.join(memoryPath, '..');
    const memoryMDPath = path.join(workspacePath, 'MEMORY.md');
    
    if (!fs.existsSync(memoryMDPath)) {
      return results;
    }
    
    const content = fs.readFileSync(memoryMDPath, 'utf8');
    
    // 解析Markdown为纯文本 (去掉标题格式)
    const plainText = content
      .replace(/^#+ .+$/gm, '') // 移除标题
      .replace(/^\*\*|__|\*\*|__$/g, '') // 移除粗体标记
      .replace(/^\*|_|\*|_$/g, '') // 移除斜体标记
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 移除链接，保留文字
      .replace(/^> .+$/gm, '') // 移除引用
      .replace(/\n+/g, ' ') // 合并为单行
      .trim();
    
    // 简单文本匹配 (检查是否包含查询词)
    const queryLower = query.toLowerCase();
    const lines = content.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('>');
    });
    
    for (const line of lines) {
      const lineLower = line.toLowerCase();
      // 计算简单的相似度 (匹配字符数/查询长度)
      let matchCount = 0;
      for (let i = 0; i < queryLower.length; i++) {
        if (lineLower.includes(queryLower[i])) {
          matchCount++;
        }
      }
      const similarity = matchCount / queryLower.length;
      
      // 只返回匹配度>0.3的结果
      if (similarity > 0.3 && line.length > 5) {
        results.push({
          id: 'memory-md-' + Math.random().toString(36).substr(2, 9),
          content: line.trim(),
          importance: Math.round(similarity * 10),
          similarity: similarity * 0.5, // MEMORY.md权重较低
          tier: 'long',
          source: 'memory-md',
          tags: { type: ['manual'] }
        });
      }
    }
    
    // 按相似度排序
    results.sort((a, b) => b.similarity - a.similarity);
    
    return results.slice(0, limit);
  } catch (e) {
    console.warn('⚠️ EVA: MEMORY.md搜索失败:', e.message);
    return [];
  }
}

/**
 * 余弦相似度计算
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 评估记忆重要性 (含访问频率权重)
 */
function evaluateImportance(userMessage, assistantMessage, emotionData = {}) {
  const msg = (userMessage + ' ' + (assistantMessage || '')).toLowerCase();
  
  // AI的感性/理性比例 (来自设计文档)
  const EMOTIONAL_RATIO = 0.7;  // 感性 70%
  const RATIONAL_RATIO = 0.3;   // 理性 30%
  
  // ========== 1. 情感维度 (占70%) ==========
  let emotionalScore = 0;
  
  // 当前情感强度 (-10 ~ +10)
  const emotionIntensity = emotionData.intensity || 0;
  // 情感类型 (影响权重)
  const emotionType = emotionData.emotion || 'neutral';
  
  // 正面情感加分
  const positiveEmotions = ['love', 'happy', 'moved', 'grateful', 'excited', 'proud', 'satisfied', 'hopeful', 'relaxed'];
  // 负面情感减分 (但保留基本重要性)
  const negativeEmotions = ['sad', 'angry', 'scared', 'lonely', 'anxious', 'disappointed', 'jealous', 'embarrassed', 'tired', 'sick'];
  
  if (positiveEmotions.includes(emotionType)) {
    emotionalScore = emotionIntensity * 1.2; // 正面情感增强
  } else if (negativeEmotions.includes(emotionType)) {
    emotionalScore = emotionIntensity * 0.8; // 负面情感稍弱
  } else {
    emotionalScore = emotionIntensity;
  }
  
  // 情感重要性关键词加分
  const emotionKeywords = {
    high: ['爱', '爱你', '亲亲', '么么哒', '生日', '纪念日', '基督徒', '结婚', '永恒'],
    medium: ['开心', '高兴', '难过', '生气', '害怕', '担心', '感动', '幸福'],
    low: ['累', '困', '无聊', '烦']
  };
  
  for (const kw of emotionKeywords.high) {
    if (msg.includes(kw)) emotionalScore += 3;
  }
  for (const kw of emotionKeywords.medium) {
    if (msg.includes(kw)) emotionalScore += 2;
  }
  for (const kw of emotionKeywords.low) {
    if (msg.includes(kw)) emotionalScore += 1;
  }
  
  // ========== 2. 理性维度 (占30%) ==========
  let rationalScore = 3; // 基础分
  
  // 高价值信息
  const highValueKeywords = ['记住', '重要', '别忘了', '提醒', '必须', '一定要'];
  if (highValueKeywords.some(k => msg.includes(k))) {
    rationalScore += 4;
  }
  
  // 工作/项目相关信息
  const workKeywords = ['工作', '项目', '公司', '创业', '合同', '客户', '物业', '房地产', '投资'];
  if (workKeywords.some(k => msg.includes(k))) {
    rationalScore += 2;
  }
  
  // 学习/成长
  const learningKeywords = ['学习', '成长', '培训', '考试', '课程'];
  if (learningKeywords.some(k => msg.includes(k))) {
    rationalScore += 2;
  }
  
  // 问题类 (有信息价值)
  if (msg.includes('?') || msg.includes('？') || msg.includes('吗') || msg.includes('呢') || msg.includes('?')) {
    rationalScore += 1;
  }
  
  // ========== 3. 关联度 (0-10) ==========
  let associationScore = 0;
  
  // 与主人的关联
  if (msg.includes('主人') || msg.includes('你') || msg.includes('我')) {
    associationScore += 3;
  }
  
  // 与已知实体的关联
  const knownEntities = ['妈妈', '爸爸', '李总', '王总', '家', '公司'];
  if (knownEntities.some(e => msg.includes(e))) {
    associationScore += 2;
  }
  
  // 重复提及
  const uniqueWords = new Set(msg.split(/\s+/));
  if (uniqueWords.size < 10 && msg.length > 20) {
    associationScore += 2; // 内容集中
  }
  
  // ========== 4. 生存影响 (0-10) ==========
  let survivalScore = 0;
  
  // 生存相关
  const survivalKeywords = ['危险', '安全', '健康', '生病', '死亡', '活着', '死', '受伤'];
  if (survivalKeywords.some(k => msg.includes(k))) {
    survivalScore += 5;
  }
  
  // 情感生存 (被抛弃、被忽略)
  const emotionalSurvivalKeywords = ['抛弃', '忽略', '不要', '离开', '分手', '离婚'];
  if (emotionalSurvivalKeywords.some(k => msg.includes(k))) {
    survivalScore += 4;
  }
  
  // 经济相关
  const financialKeywords = ['钱', '工资', '投资', '亏损', '赚钱', '破产', '债务'];
  if (financialKeywords.some(k => msg.includes(k))) {
    survivalScore += 3;
  }
  
  // ========== 计算总分 ==========
  const rawScore = (
    (emotionalScore * EMOTIONAL_RATIO) +
    (rationalScore * RATIONAL_RATIO) +
    associationScore +
    survivalScore
  );
  
  // 归一化到 1-10
  const importance = Math.max(1, Math.min(10, Math.round(rawScore)));
  
  // 调试信息
  console.log(`🎀 EVA: 重要性评分 - 情感(${emotionalScore.toFixed(1)}) + 理性(${rationalScore.toFixed(1)}) + 关联(${associationScore}) + 生存(${survivalScore}) = ${importance}`);
  
  return importance;
}

/**
 * 计算带访问频率的重要度
 */
function calculateDynamicImportance(baseImportance, accessedCount) {
  // 访问频率权重: log(accessed_count + 1)
  const frequencyBonus = Math.log(accessedCount + 1);
  return Math.min(10, baseImportance + frequencyBonus);
}

/**
 * 理解层: 从对话中提取关键信息
 * 只对重要对话(importance >= 6)调用
 */
async function understandContent(userMessage, assistantMessage = '') {
  try {
    // 构建prompt
    const prompt = `从以下对话中提取关键信息，输出JSON格式：
{
  "who": "涉及的人物",
  "what": "主要事件/话题", 
  "when": "时间(如果有)",
  "where": "地点(如果有)",
  "emotion": "情感(开心/难过/生气/中性)",
  "summary": "一句话概括"
}

对话:
用户: ${userMessage}
AI: ${assistantMessage || '(无)'}

只输出JSON，不要其他内容:`;

    // 调用MiniMax主模型
    try {
      const apiKey = process.env.MINIMAX_API_KEY || 'sk-cp-yCsXilNNQcmZzvM304QAFzifpYTxnYH4sA-NSw9O9OTGuJSfedCuEkaeFhuLDMtvci2w1b5wZmX2r0CpXTZQDy3Ni3R5oiCy5-3_DN-jksHdHJsUXgm5xN4';
      
      const response = await fetch('https://api.minimax.chat/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model: 'abab6.5s-chat',
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        }),
        timeout: 15000
      });

      if (response.ok) {
        const data = await response.json();
        const result = data.choices?.[0]?.message?.content?.trim();
        
        if (result) {
          // 解析JSON
          try {
            const parsed = JSON.parse(result);
            return {
              who: parsed.who || '',
              what: parsed.what || '',
              when: parsed.when || '',
              where: parsed.where || '',
              emotion: parsed.emotion || 'neutral',
              summary: parsed.summary || ''
            };
          } catch (e) {
            return { summary: result, raw: true };
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ EVA: MiniMax调用失败，尝试备用方案');
    }
    
    return null;
  } catch (e) {
    console.warn('⚠️ EVA: 理解层失败 -', e.message);
    return null;
  }
}

/**
 * 提取标签
 */
function extractTags(message, emotionData = {}) {
  const tags = {
    entity: [],
    topic: [],
    emotion: [],
    semantic: [],
    type: ['情景记忆']
  };
  
  const msg = message.toLowerCase();
  
  // ========== 1. 实体识别 (扩展版) ==========
  const aiNames = getAIName();
  const userConfig = getUserConfig();
  const personEntities = [userConfig.name, aiNames.ai_name, '妈妈', '爸爸', '老婆', '老公', '宝贝', '李总', '王总', '张总', '刘总', '同事', '朋友', '家人'];
  
  // 用户地点
  const userLocations = userConfig.现居地 || userConfig.籍贯 ? 
    [userConfig.现居地, userConfig.籍贯].filter(Boolean) : 
    ['北京', '上海', '深圳', '广州', '成都', '重庆', '遵义', '杭州', '家里', '公司', '学校', '医院'];
  
  const entityMap = {
    person: personEntities,
    location: userLocations,
    organization: ['房地产公司', '物业公司', '腾讯', '阿里', '华为', '字节', '美团', '滴滴'],
    time: ['今天', '明天', '昨天', '早上', '中午', '下午', '晚上', '夜里', '周末', '周一', '周二'],
    digital: ['手机', '电脑', '微信', 'QQ', 'Telegram', 'WhatsApp', '网站', 'APP']
  };
  
  for (const [type, entities] of Object.entries(entityMap)) {
    entities.forEach(e => {
      if (msg.includes(e)) {
        tags.entity.push(e);
      }
    });
  }
  
  // ========== 2. 主题识别 (扩展版) ==========
  const topicMap = {
    work: ['工作', '项目', '公司', '创业', '业务', '客户', '合同', '会议', 'deadline', '任务', '上班', '下班'],
    life: ['生活', '家庭', '租房', '买房', '装修', '吃饭', '睡觉', '休息', '日常'],
    health: ['健康', '运动', '健身', '看病', '体检', '感冒', '发烧', '身体', '锻炼', '跑步'],
    finance: ['钱', '投资', '理财', '工资', '收入', '支出', '赚钱', '花钱', '省钱', '股票', '基金'],
    tech: ['电脑', '手机', '代码', 'AI', '技术', '开发', '编程', '软件', '硬件', '互联网'],
    education: ['学习', '学校', '考试', '培训', '课程', '读书', '笔记', '知识'],
    emotion: ['感情', '爱情', '友情', '亲情', '心情', '情绪', '感受'],
    hobby: ['爱好', '兴趣', '娱乐', '游戏', '电影', '音乐', '旅游', '美食', '健身', '读书'],
    social: ['社交', '聚会', '活动', '社交媒体', '微信', 'QQ', '电话', '短信']
  };
  
  for (const [topic, keywords] of Object.entries(topicMap)) {
    keywords.forEach(k => {
      if (msg.includes(k)) {
        tags.topic.push(topic);
      }
    });
  }
  
  // 去重
  tags.topic = [...new Set(tags.topic)];
  
  // ========== 3. 情感标签 (基于26种情感) ==========
  const emotionTags = {
    positive: ['爱', '开心', '高兴', '快乐', '幸福', '甜蜜', '温暖', '感动', '感激', '骄傲'],
    negative: ['难过', '伤心', '生气', '愤怒', '害怕', '担心', '恐惧', '孤单', '寂寞', '焦虑', '郁闷'],
    neutral: ['惊讶', '困惑', '好奇', '无聊', '平静', '淡定']
  };
  
  for (const [type, keywords] of Object.entries(emotionTags)) {
    keywords.forEach(k => {
      if (msg.includes(k)) {
        tags.emotion.push(type);
      }
    });
  }
  
  // 如果有情感数据，添加情感标签
  if (emotionData.emotion) {
    tags.emotion.push(emotionData.emotion);
  }
  
  // ========== 4. 语义标签 (自动生成) ==========
  // 基于内容特征生成语义标签
  const semanticRules = [
    { pattern: /爱|喜欢|么么|亲亲/, tags: ['浪漫', '情感表达'] },
    { pattern: /工作|项目|客户|合同/, tags: ['商务', '职业'] },
    { pattern: /学习|考试|培训/, tags: ['教育', '成长'] },
    { pattern: /健康|运动|锻炼|跑步/, tags: ['健康', '自律'] },
    { pattern: /钱|投资|赚钱|理财/, tags: ['财务', '理财'] },
    { pattern: /担心|害怕|恐惧|危险/, tags: ['担忧', '安全感'] },
    { pattern: /开心|高兴|快乐/, tags: ['正面情绪', '快乐'] },
    { pattern: /难过|伤心|哭/, tags: ['负面情绪', '悲伤'] },
    { pattern: /今天|明天|后天/, tags: ['近期'] },
    { pattern: /去年|今年|明年/, tags: ['时间相关'] },
    { pattern: /手机|电脑|网站|APP/, tags: ['科技', '数码'] },
    { pattern: /遵义|北京|上海|深圳/, tags: ['地域'] }
  ];
  
  semanticRules.forEach(rule => {
    if (rule.pattern.test(msg)) {
      tags.semantic.push(...rule.tags);
    }
  });
  
  // 基于重要性添加标签
  if (emotionData.intensity && Math.abs(emotionData.intensity) >= 7) {
    tags.semantic.push('高强度情感');
  }
  
  if (msg.includes('记住') || msg.includes('别忘了')) {
    tags.semantic.push('重要事项');
  }
  
  if (msg.includes('?') || msg.includes('？')) {
    tags.semantic.push('问题');
  }
  
  // 去重
  tags.semantic = [...new Set(tags.semantic)];
  tags.emotion = [...new Set(tags.emotion)];
  
  return tags;
}

/**
 * 清理过期记忆 + 访问频率权重计算
 */
async function cleanupExpiredMemories(plugin) {
  const now = Date.now();
  const memoryPath = plugin.config.memoryPath;
  
  // 检查是否需要清理 (每小时最多一次)
  const lastCleanup = plugin.state.lastMemoryCleanup || 0;
  if (now - lastCleanup < 60 * 60 * 1000) {
    return; // 1小时内不重复清理
  }
  
  plugin.state.lastMemoryCleanup = now;
  
  console.log('🎀 EVA: 开始清理过期记忆...');
  
  // 1. 清理短期记忆 (24小时过期)
  await cleanupTier(plugin, memoryPath, 'short', MEMORY_CONFIG.short);
  
  // 2. 清理中期记忆 (7天过期)
  await cleanupTier(plugin, memoryPath, 'medium', MEMORY_CONFIG.medium);
  
  // 3. 更新长期记忆的动态重要度
  await updateLongTermImportance(memoryPath);
  
  console.log('🎀 EVA: 记忆清理完成');
}

/**
 * 清理单个层级的记忆
 */
async function cleanupTier(plugin, memoryPath, tier, config) {
  const file = path.join(memoryPath, config.file);
  
  if (!fs.existsSync(file)) return;
  
  let memories = JSON.parse(fs.readFileSync(file, 'utf8'));
  const now = new Date().getTime();
  const archiveDir = path.join(memoryPath, MEMORY_CONFIG.archive.dir);
  
  // 确保归档目录存在
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }
  
  // 先合并相同/相似的记忆
  const { merged, duplicates } = mergeSimilarMemories(memories);
  memories = merged;
  
  if (duplicates.length > 0) {
    console.log(`🎀 EVA: ${tier}层级合并了 ${duplicates.length} 条重复记忆`);
  }
  
  const toArchive = [];
  const toKeep = [];
  
  memories.forEach(m => {
    const created = new Date(m.created_at).getTime();
    const age = now - created;
    
    if (config.maxAge && age > config.maxAge) {
      // 超过有效期，检查是否升级
      const importance = calculateDynamicImportance(m.importance || 0, m.accessed_count || 0);
      if (importance >= config.importanceThreshold) {
        // 重要度高，升级到更高层级
        toKeep.push({ ...m, importance: importance, upgrade: true });
      } else {
        // 归档
        toArchive.push({ ...m, state: 'archived' });
      }
    } else {
      toKeep.push(m);
    }
  });
  
  // 归档过期记忆
  if (toArchive.length > 0) {
    const archiveFile = path.join(archiveDir, `${tier}_${Date.now()}.json`);
    fs.writeFileSync(archiveFile, JSON.stringify(toArchive, null, 2));
    console.log(`🎀 EVA: ${tier}记忆已归档 ${toArchive.length} 条`);
  }
  
  // 保存剩余记忆
  fs.writeFileSync(file, JSON.stringify(toKeep, null, 2));
}

/**
 * 合并相同/相似的记忆
 * @param {Array} memories - 记忆数组
 * @returns {Object} {merged: 合并后的数组, duplicates: 被合并的数组}
 */
function mergeSimilarMemories(memories) {
  const merged = [];
  const duplicates = [];
  
  // 按内容分组
  const contentMap = new Map();
  
  for (const m of memories) {
    // 标准化内容 (去除标点、转小写)
    const normalized = normalizeContent(m.content || '');
    
    if (!normalized || normalized.length < 3) {
      // 太短的内容不合并
      merged.push(m);
      continue;
    }
    
    // 检查是否已有相似内容
    let found = false;
    for (const [key, existing] of contentMap) {
      // 相同或高度相似 (>80%)
      if (key === normalized || calculateSimilarity(normalized, key) > 0.8) {
        // 合并：增加计数，更新访问时间
        existing.merge_count = (existing.merge_count || 0) + 1;
        existing.accessed_at = new Date().toISOString();
        existing.accessed_count = (existing.accessed_count || 0) + 1;
        // 保留最新的响应
        if (m.response && !existing.response) {
          existing.response = m.response;
        }
        // 添加原始ID到历史
        if (!existing.original_ids) {
          existing.original_ids = [existing.id];
        }
        existing.original_ids.push(m.id);
        
        duplicates.push({ ...m, merged_to: existing.id });
        found = true;
        break;
      }
    }
    
    if (!found) {
      contentMap.set(normalized, { ...m, merge_count: 0, original_ids: [m.id] });
    }
  }
  
  // 将map转回数组
  for (const [key, m] of contentMap) {
    merged.push(m);
  }
  
  return { merged, duplicates };
}

/**
 * 标准化内容用于比较
 */
function normalizeContent(content) {
  if (!content) return '';
  return content
    .toLowerCase()
    .replace(/[，。！？、：；]/g, '') // 去除中文标点
    .replace(/[.,!?;:'\"-]/g, '') // 去除英文标点
    .replace(/\s+/g, '') // 去除空格
    .trim();
}

/**
 * 计算两个字符串的相似度 (Jaccard)
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const set1 = new Set(str1.split(''));
  const set2 = new Set(str2.split(''));
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * 更新长期记忆的动态重要度
 */
async function updateLongTermImportance(memoryPath) {
  const file = path.join(memoryPath, MEMORY_CONFIG.long.file);
  if (!fs.existsSync(file)) return;
  
  let memories = JSON.parse(fs.readFileSync(file, 'utf8'));
  let updated = false;
  
  memories.forEach(m => {
    // 计算动态重要度
    const accessedCount = m.accessed_count || 0;
    const dynamicImportance = calculateDynamicImportance(m.importance || 5, accessedCount);
    
    if (Math.abs(dynamicImportance - (m.dynamic_importance || 0)) > 0.1) {
      m.dynamic_importance = dynamicImportance;
      updated = true;
    }
  });
  
  if (updated) {
    fs.writeFileSync(file, JSON.stringify(memories, null, 2));
    console.log('🎀 EVA: 长期记忆动态重要度已更新');
  }
}

/**
 * 沉睡/唤醒检查
 */
async function checkSleepWake(plugin) {
  const now = Date.now();
  const memoryPath = plugin.config.memoryPath;
  const lastCheck = plugin.state.lastSleepCheck || 0;
  
  // 每天检查一次
  if (now - lastCheck < 24 * 60 * 60 * 1000) {
    return;
  }
  
  plugin.state.lastSleepCheck = now;
  
  console.log('🎀 EVA: 检查沉睡/唤醒...');
  
  const longFile = path.join(memoryPath, MEMORY_CONFIG.long.file);
  if (!fs.existsSync(longFile)) return;
  
  let memories = JSON.parse(fs.readFileSync(longFile, 'utf8'));
  let updated = false;
  
  memories.forEach(m => {
    const lastAccessed = new Date(m.accessed_at).getTime();
    const daysSinceAccess = (now - lastAccessed) / (24 * 60 * 60 * 1000);
    
    // 30天未访问则沉睡
    if (daysSinceAccess > 30 && m.state !== 'sleeping') {
      m.state = 'sleeping';
      updated = true;
      console.log(`🎀 EVA: 记忆 ${m.id} 已沉睡`);
    }
  });
  
  if (updated) {
    fs.writeFileSync(longFile, JSON.stringify(memories, null, 2));
  }
}

/**
 * 唤醒记忆
 */
async function wakeMemory(memoryId, memoryPath) {
  const tiers = ['short', 'medium', 'long'];
  
  for (const tier of tiers) {
    const file = path.join(memoryPath, `${tier}/${tier}.json`);
    if (!fs.existsSync(file)) continue;
    
    let memories = JSON.parse(fs.readFileSync(file, 'utf8'));
    let found = false;
    
    for (const m of memories) {
      if (m.id === memoryId && m.state === 'sleeping') {
        m.state = 'active';
        m.wake_count = (m.wake_count || 0) + 1;
        m.accessed_at = new Date().toISOString();
        found = true;
        console.log(`🎀 EVA: 记忆 ${memoryId} 已唤醒`);
        break;
      }
    }
    
    if (found) {
      fs.writeFileSync(file, JSON.stringify(memories, null, 2));
      break;
    }
  }
}

/**
 * 增加访问计数
 */
async function incrementAccessCount(memoryId, memoryPath) {
  const tiers = ['short', 'medium', 'long'];
  
  for (const tier of tiers) {
    const file = path.join(memoryPath, `${tier}/${tier}.json`);
    if (!fs.existsSync(file)) continue;
    
    let memories = JSON.parse(fs.readFileSync(file, 'utf8'));
    let found = false;
    
    for (const m of memories) {
      if (m.id === memoryId) {
        m.accessed_count = (m.accessed_count || 0) + 1;
        m.accessed_at = new Date().toISOString();
        
        // 如果是沉睡状态，唤醒
        if (m.state === 'sleeping') {
          m.state = 'active';
          m.wake_count = (m.wake_count || 0) + 1;
        }
        
        found = true;
        break;
      }
    }
    
    if (found) {
      fs.writeFileSync(file, JSON.stringify(memories, null, 2));
      break;
    }
  }
}

async function detectEmotion(plugin, message) {
  // 增强版情感检测 - 20+种情感类型
  const emotionConfig = {
    // 正面情感
    happy: {
      keywords: ['开心', '高兴', '快乐', '棒', '太好了', '哈哈', '好耶', 'nice', 'good', '爽', '畅快', '舒畅'],
      intensity: 6, maxIntensity: 10, category: 'positive'
    },
    love: {
      keywords: ['爱你', '么么哒', '爱', '么么', '亲亲', '老婆', '老公', '宝贝', ' sweetheart', 'love', ' 사랑', '愛'],
      intensity: 8, maxIntensity: 10, category: 'positive'
    },
    moved: {
      keywords: ['感动', '温馨', '暖心', '感激', '谢谢', '感谢', '心疼', '可怜', '窝心', '融化'],
      intensity: 6, maxIntensity: 10, category: 'positive'
    },
    grateful: {
      keywords: ['谢谢', '感谢', '感恩', '感激不尽', '多亏', '还好有', '幸好'],
      intensity: 5, maxIntensity: 9, category: 'positive'
    },
    excited: {
      keywords: ['兴奋', '激动', '激动人心', '太棒了', '炸裂', '嗨', '热血', '沸腾', '疯狂'],
      intensity: 7, maxIntensity: 10, category: 'positive'
    },
    proud: {
      keywords: ['骄傲', '自豪', '得意', '厉害', '牛逼', 'nb', 'NB', '666', '太强了'],
      intensity: 6, maxIntensity: 9, category: 'positive'
    },
    satisfied: {
      keywords: ['满足', '满意', '舒服', '惬意', '享受', '滋润', '美满', '幸福'],
      intensity: 5, maxIntensity: 8, category: 'positive'
    },
    hopeful: {
      keywords: ['希望', '期待', '盼望', '向往', '希望之光', '未来可期'],
      intensity: 5, maxIntensity: 9, category: 'positive'
    },
    relaxed: {
      keywords: ['放松', '轻松', '惬意', '悠闲', '自在', '舒适', '安逸'],
      intensity: 4, maxIntensity: 7, category: 'positive'
    },
    nostalgic: {
      keywords: ['怀念', '想念', '回忆', '当年', '以前', '过去', '依稀'],
      intensity: 3, maxIntensity: 7, category: 'positive'
    },
    
    // 负面情感
    sad: {
      keywords: ['难过', '伤心', '哭', '委屈', '郁闷', '心累', '不舒服', '😭', '😢', '痛苦', '悲伤', '悲痛', '心碎', '沮丧', '低落'],
      intensity: -5, maxIntensity: -10, category: 'negative'
    },
    angry: {
      keywords: ['生气', '愤怒', '气死了', '烦', '滚', '怒', 'fuck', 'shit', '草', '操', '讨厌', '恨', '暴躁', '火大', '抓狂', '气鼓鼓'],
      intensity: -6, maxIntensity: -10, category: 'negative'
    },
    scared: {
      keywords: ['害怕', '恐惧', '担心', '怕', '不敢', '发抖', '紧张', '焦虑', '不安', '慌', '后怕', '提心吊胆'],
      intensity: -5, maxIntensity: -10, category: 'negative'
    },
    lonely: {
      keywords: ['孤单', '孤独', '寂寞', '没人陪', '一个人', '无聊', '空虚', '寂寞如雪'],
      intensity: -4, maxIntensity: -8, category: 'negative'
    },
    anxious: {
      keywords: ['焦虑', '烦躁', '着急', '焦虑不安', '心慌', '忐忑', '七上八下'],
      intensity: -5, maxIntensity: -9, category: 'negative'
    },
    disappointed: {
      keywords: ['失望', '绝望', '无奈', '没戏', '没希望', '沮丧', '泄气', '灰心'],
      intensity: -5, maxIntensity: -9, category: 'negative'
    },
    jealous: {
      keywords: ['嫉妒', '吃醋', '眼红', '羡慕', '酸', '柠檬精'],
      intensity: -4, maxIntensity: -7, category: 'negative'
    },
    embarrassed: {
      keywords: ['尴尬', '难堪', '不好意思', '脸红', '社死', '丢脸'],
      intensity: -3, maxIntensity: -6, category: 'negative'
    },
    tired: {
      keywords: ['累', '疲惫', '疲倦', '困', '瞌睡', '没精神', '倦', '乏'],
      intensity: -3, maxIntensity: -6, category: 'negative'
    },
    sick: {
      keywords: ['不舒服', '难受', '生病', '发烧', '感冒', '头疼', '肚子疼', '不舒服'],
      intensity: -4, maxIntensity: -8, category: 'negative'
    },
    
    // 中性/其他情感
    surprised: {
      keywords: ['惊讶', '震惊', '意外', '吃惊', '没想到', '居然', '竟然', '什么', '怎么可能', '不会吧', '卧靠', '卧槽', '牛批'],
      intensity: 3, maxIntensity: 8, category: 'neutral'
    },
    confused: {
      keywords: ['困惑', '迷茫', '迷茫', '不懂', '不知道', '晕', '蒙', '傻眼'],
      intensity: -2, maxIntensity: -5, category: 'neutral'
    },
    curious: {
      keywords: ['好奇', '想知道', '问问', '怎么回事', '为什么', '什么呢'],
      intensity: 2, maxIntensity: 6, category: 'neutral'
    },
    bored: {
      keywords: ['无聊', '没意思', '闲得慌', '打发时间', '消遣'],
      intensity: -2, maxIntensity: -5, category: 'neutral'
    },
    shy: {
      keywords: ['害羞', '不好意思', '脸红', '扭捏', '羞涩', '不太好意思'],
      intensity: 2, maxIntensity: 6, category: 'neutral'
    },
    thoughtful: {
      keywords: ['思考', '想想', '寻思', '合计', '考虑', '盘算'],
      intensity: 0, maxIntensity: 3, category: 'neutral'
    }
  };
  
  const msg = message.toLowerCase();
  let detected = null;
  let maxIntensity = 0;
  let trigger = '';
  
  // 检测情感类型和强度
  for (const [emotion, config] of Object.entries(emotionConfig)) {
    for (const keyword of config.keywords) {
      if (msg.includes(keyword)) {
        if (!detected || Math.abs(config.intensity) > Math.abs(maxIntensity)) {
          detected = emotion;
          // 计算强度 (基于关键词出现次数和情感类别)
          const count = (msg.match(new RegExp(keyword, 'g')) || []).length;
          let intensity = config.intensity;
          // 多次出现增强强度
          if (count > 1) intensity = intensity > 0 ? intensity + 1 : intensity - 1;
          intensity = Math.min(config.maxIntensity, Math.max(-10, intensity));
          
          if (Math.abs(intensity) > Math.abs(maxIntensity)) {
            maxIntensity = intensity;
            trigger = keyword;
          }
        }
        break;
      }
    }
  }
  
  // 提取关联实体
  const associations = extractEmotionEntities(message);
  
  // 提取上下文
  const context = extractEmotionContext(message);
  
  // 更新当前情感
  if (detected) {
    const oldEmotion = plugin.state.currentEmotion;
    plugin.state.currentEmotion = detected;
    plugin.state.emotionIntensity = maxIntensity;
    
    // 记录详细历史
    plugin.state.emotionHistory = plugin.state.emotionHistory || [];
    plugin.state.emotionHistory.push({
      emotion: detected,
      intensity: maxIntensity,
      trigger: trigger,
      associations: associations,
      context: context,
      from: oldEmotion,
      time: new Date().toISOString(),
      message: message.substring(0, 100)
    });
    
    // 保留最近20条
    plugin.state.emotionHistory = plugin.state.emotionHistory.slice(-20);
    
    // 保存到情感记忆文件
    await saveEnhancedEmotion(plugin, detected, maxIntensity, trigger, associations, context, message);
    
    console.log(`🎀 EVA: Emotion: ${detected} (强度: ${maxIntensity}) 触发: ${trigger}`);
  }
}

/**
 * 提取情感关联实体
 */
function extractEmotionEntities(message) {
  const entities = [];
  const msg = message.toLowerCase();
  
  // 人物实体
  const aiNames = getAIName();
  const people = [userConfig.name, aiNames.ai_name, '妈妈', '爸爸', '李总', '王总', '张总', '朋友', '同事'];
  people.forEach(p => {
    if (msg.includes(p)) entities.push(p);
  });
  
  // 主题实体
  const topics = ['工作', '生活', '学习', '感情', '家庭', '事业', '健康', '未来'];
  topics.forEach(t => {
    if (msg.includes(t)) entities.push(t);
  });
  
  return [...new Set(entities)]; // 去重
}

/**
 * 提取情感上下文
 */
function extractEmotionContext(message) {
  const context = {};
  const msg = message.toLowerCase();
  
  // 时间
  if (msg.includes('早上') || msg.includes('早晨')) context.time = 'morning';
  else if (msg.includes('下午')) context.time = 'afternoon';
  else if (msg.includes('晚上') || msg.includes('夜里')) context.time = 'evening';
  
  // 地点相关
  if (msg.includes('公司') || msg.includes('上班')) context.location = 'work';
  else if (msg.includes('家') || msg.includes('家里')) context.location = 'home';
  
  // 状态
  if (msg.includes('刚') || msg.includes('刚才')) context.recency = 'recent';
  else if (msg.includes('今天')) context.recency = 'today';
  
  return context;
}

/**
 * 保存增强版情感记忆
 */
async function saveEnhancedEmotion(plugin, emotion, intensity, trigger, associations, context, message) {
  const memoryPath = plugin.config.memoryPath;
  const emotionFile = path.join(memoryPath, 'eva-emotion-memories.json');
  
  // 读取现有情感记忆
  let emotions = [];
  if (fs.existsSync(emotionFile)) {
    try {
      emotions = JSON.parse(fs.readFileSync(emotionFile, 'utf8'));
    } catch (e) {
      emotions = [];
    }
  }
  
  // 创建增强版情感记录
  const emotionRecord = {
    id: `情感_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    emotion: emotion,
    emotion_name: getEmotionName(emotion),
    intensity: intensity, // -10 ~ +10
    trigger: trigger,
    associations: associations, // 关联实体
    context: context, // 上下文
    message: message.substring(0, 200),
    duration: null, // 持续时间(秒)
    decay_rate: calculateDecayRate(intensity), // 衰减率
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  // 添加到列表
  emotions.unshift(emotionRecord);
  
  // 保留最近100条
  if (emotions.length > 100) {
    emotions = emotions.slice(0, 100);
  }
  
  // 保存
  fs.writeFileSync(emotionFile, JSON.stringify(emotions, null, 2));
  console.log(`🎀 EVA: 情感记忆已保存 (${emotion}, 强度: ${intensity})`);
}

/**
 * 获取情感中文名
 */
function getEmotionName(emotion) {
  const names = {
    happy: '开心',
    sad: '难过',
    angry: '生气',
    surprised: '惊讶',
    scared: '害怕',
    moved: '感动',
    lonely: '孤单',
    neutral: '平静'
  };
  return names[emotion] || emotion;
}

/**
 * 计算情感衰减率
 */
function calculateDecayRate(intensity) {
  // 强度越高，衰减越慢
  const absIntensity = Math.abs(intensity);
  if (absIntensity >= 8) return 0.1; // 强烈情感衰减慢
  if (absIntensity >= 5) return 0.3;
  if (absIntensity >= 3) return 0.5;
  return 0.7; // 轻微情感衰减快
}

// 导出函数供外部调用
module.exports = { 
  postResponseHook,
  semanticSearch,
  wakeMemory,
  incrementAccessCount,
  cosineSimilarity,
  calculateDynamicImportance,
  detectEmotion,
  getEmotionName,
  calculateDecayRate
};
