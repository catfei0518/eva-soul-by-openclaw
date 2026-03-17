/**
 * Pre-Response Hook - 回复前注入人格和记忆
 */

const fs = require('fs');
const path = require('path');
const { getAIName } = require('../lib/core/config');

const VECTOR_CONFIG = {
  apiKey: process.env.SILICONFLOW_API_KEY || 'sk-niomirqoomaiylusfestoavpaflrvcmrygsoarocroladwvt',
  model: 'BAAI/bge-large-zh-v1.5',
  apiUrl: 'https://api.siliconflow.cn/v1/embeddings'
};

async function preResponseHook(ctx, plugin) {
  if (!plugin.config.autoPersonality) {
    return ctx;
  }
  
  console.log('🎀 EVA: Injecting personality and loading memories...');
  
  // 构建人格注入
  const personalityPrompt = buildPersonalityPrompt(plugin);
  
  // 加载相关记忆 (使用向量搜索)
  const memoryPrompt = await loadRelevantMemories(ctx, plugin);
  
  // 合并 system prompt
  let systemPrompt = personalityPrompt;
  if (memoryPrompt) {
    systemPrompt += '\n\n' + memoryPrompt;
  }
  
  if (ctx.systemPrompt) {
    systemPrompt = ctx.systemPrompt + '\n\n' + systemPrompt;
  }
  
  return {
    ...ctx,
    systemPrompt: systemPrompt
  };
}

/**
 * 使用向量模型搜索相关记忆
 */
async function loadRelevantMemories(ctx, plugin) {
  const userMessage = ctx.userMessage || '';
  if (!userMessage || userMessage.length < 2) {
    return '';
  }
  
  const memories = [];
  
  // 1. 首先从长期记忆文件读取
  const longTermMemories = loadLongTermMemories(userMessage);
  if (longTermMemories.length > 0) {
    memories.push(...longTermMemories);
    console.log('🎀 EVA: Loaded', longTermMemories.length, 'long-term memories');
  }
  
  // 2. 如果没有长期记忆，搜索concepts
  const concepts = plugin.state.concepts || [];
  if (concepts.length > 0) {
    try {
      // 生成查询向量
      const queryEmbedding = await generateEmbedding(userMessage);
      if (queryEmbedding) {
        // 计算每个概念的相似度
        const scored = concepts.map(c => {
          let sim = 0;
          if (c.embedding) {
            sim = cosineSimilarity(queryEmbedding, c.embedding);
          }
          return { item: c, score: sim };
        });
        
        // 排序取top 5
        const results = scored
          .filter(r => r.score > 0.1)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
        
        if (results.length > 0) {
          console.log('🎀 EVA: Vector search found', results.length, 'relevant concepts');
          results.forEach(r => {
            memories.push(`- ${r.item.value} (${r.item.type || 'concept'})`);
          });
        }
      }
    } catch (e) {
      console.warn('⚠️ EVA: Vector search failed:', e.message);
    }
  }
  
  if (memories.length > 0) {
    return '【相关记忆】\n' + memories.join('\n');
  }
  
  return '';
}

/**
 * 从详细日记文件加载相关记忆
 */
function loadFromDiaries(query) {
  const MEMORY_DIR = '/root/.openclaw/workspace/memory';
  const memories = [];
  
  try {
    // 读取所有.md日记文件
    const files = fs.readdirSync(MEMORY_DIR).filter(f => f.endsWith('.md') && f.match(/^\d{4}-\d{2}-\d{2}/));
    
    for (const file of files.slice(-14)) { // 最近14天的日记
      const filePath = path.join(MEMORY_DIR, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // 简单关键词匹配
      const queryLower = query.toLowerCase();
      const lines = content.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('*'));
      
      for (const line of lines) {
        const lineLower = line.toLowerCase();
        // 匹配关键词
        if (lineLower.includes('约定') || lineLower.includes('规则') || lineLower.includes('承诺')) {
          if (lineLower.includes(queryLower) || queryLower.includes('约定') || queryLower.includes('规则') || queryLower.includes('承诺')) {
            memories.push({ content: line.substring(0, 200), importance: 8, tier: '日记' });
          }
        }
      }
    }
  } catch (e) {
    console.warn('⚠️ EVA: Load diaries error:', e.message);
  }
  
  return memories;
}

/**
 * 从长期记忆文件加载相关记忆（使用向量搜索）
 */
async function loadLongTermMemories(query) {
  const MEMORY_DIR = '/root/.openclaw/workspace/memory';
  const allMemories = [];
  
  // 首先从日记文件加载
  const diaryMemories = loadFromDiaries(query);
  if (diaryMemories.length > 0) {
    console.log('🎀 EVA: Found', diaryMemories.length, 'relevant memories from diaries');
    return diaryMemories.map(m => `- ${m.content} [${m.tier}]`).join('\n');
  }
  
  try {
    // 读取长期记忆
    const longFile = path.join(MEMORY_DIR, 'long', 'long.json');
    if (fs.existsSync(longFile)) {
      const longData = JSON.parse(fs.readFileSync(longFile, 'utf-8'));
      if (Array.isArray(longData)) {
        for (const item of longData.slice(0, 30)) {
          const content = item.content || item.value || '';
          if (content.length > 10) {
            allMemories.push({ content, importance: item.importance || 5, tier: '重要' });
          }
        }
      }
    }
    
    // 读取中期记忆
    const mediumFile = path.join(MEMORY_DIR, 'medium', 'medium.json');
    if (fs.existsSync(mediumFile)) {
      const mediumData = JSON.parse(fs.readFileSync(mediumFile, 'utf-8'));
      if (Array.isArray(mediumData)) {
        for (const item of mediumData.slice(0, 20)) {
          const content = item.content || item.value || '';
          if (content.length > 10) {
            allMemories.push({ content, importance: item.importance || 4, tier: '中期' });
          }
        }
      }
    }
    
    // 读取短期记忆（最近7天）
    const shortFile = path.join(MEMORY_DIR, 'short', 'short.json');
    if (fs.existsSync(shortFile)) {
      const shortData = JSON.parse(fs.readFileSync(shortFile, 'utf-8'));
      if (Array.isArray(shortData)) {
        for (const item of shortData.slice(0, 30)) {
          const content = item.content || item.value || '';
          if (content.length > 10) {
            allMemories.push({ content, importance: item.importance || 3, tier: '近期' });
          }
        }
      }
    }
    
    if (allMemories.length === 0) {
      return '';
    }
    
    // 优先使用向量搜索
    try {
      const queryEmbedding = await generateEmbedding(query);
      if (queryEmbedding) {
        const scored = [];
        for (const mem of allMemories.slice(0, 50)) {
          const memEmbedding = await generateEmbedding(mem.content.substring(0, 300));
          if (memEmbedding) {
            const sim = cosineSimilarity(queryEmbedding, memEmbedding);
            scored.push({ ...mem, score: sim });
          }
        }
        
        const topMemories = scored
          .filter(m => m.score > 0.3)
          .sort((a, b) => b.score - a.score)
          .slice(0, 8);
        
        if (topMemories.length > 0) {
          console.log('🎀 EVA: Vector search found', topMemories.length, 'relevant memories');
          return topMemories.map(m => `- ${m.content} [${m.tier || 'memory'}]`).join('\n');
        }
      }
    } catch (e) {
      console.warn('⚠️ EVA: Vector search failed:', e.message);
    }
    
    // 向量搜索失败时用重要性优先
    const recent = allMemories
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5);
    
    return recent.map(m => `- ${m.content} [${m.tier || 'memory'}]`).join('\n');
    
  } catch (e) {
    console.warn('⚠️ EVA: Load memories error:', e.message);
    return '';
  }
}

/**
 * 生成文本embedding向量
 */
async function generateEmbedding(text) {
  try {
    const response = await fetch(VECTOR_CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VECTOR_CONFIG.apiKey}`
      },
      body: JSON.stringify({
        model: VECTOR_CONFIG.model,
        input: text
      })
    });
    
    const data = await response.json();
    if (data.data && data.data[0]) {
      return data.data[0].embedding;
    }
  } catch (e) {
    console.warn('⚠️ EVA: Generate embedding error:', e.message);
  }
  return null;
}

/**
 * 计算余弦相似度
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
 * 备用：关键词匹配搜索
 */
function loadRelevantMemoriesFallback(ctx, plugin) {
  const userMessage = ctx.userMessage || '';
  const concepts = plugin.state.concepts || [];
  
  // 搜索相关概念
  const relevantConcepts = searchRelevantConcepts(userMessage, concepts);
  
  const memories = [];
  
  if (relevantConcepts.length > 0) {
    memories.push('【相关概念】');
    relevantConcepts.slice(0, 3).forEach(c => {
      memories.push(`- ${c.value} (${c.type})`);
    });
  }
  
  // 偏好和事实
  const facts = concepts.filter(c => c.importance >= 8 && (c.type === 'fact' || c.type === 'preference'));
  if (facts.length > 0) {
    memories.push('【主人的偏好和事实】');
    facts.slice(0, 3).forEach(f => {
      memories.push(`- ${f.value}`);
    });
  }
  
  if (memories.length > 0) {
    return memories.join('\n');
  }
  return '';
}

/**
 * 搜索相关概念
 */
function searchRelevantConcepts(query, concepts) {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  
  return concepts
    .map(concept => {
      const value = (concept.value || '').toLowerCase();
      const keywords = concept.keywords || [];
      
      // 计算相关性分数
      let score = 0;
      
      // 精确匹配
      if (value.includes(queryLower)) score += 10;
      
      // 关键词匹配
      keywords.forEach(kw => {
        if (queryLower.includes(kw.toLowerCase())) score += 5;
      });
      
      // 词语匹配
      queryWords.forEach(w => {
        if (value.includes(w)) score += 3;
      });
      
      // 重要性加权
      score += (concept.importance || 5) * 0.5;
      
      return { ...concept, score };
    })
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score);
}

function buildPersonalityPrompt(plugin) {
  const aiNames = getAIName();
  const aiName = aiNames.ai_name;
  const aiNameEn = aiNames.ai_name_en;
  
  const traits = {
    gentle: '温柔可爱的语气，像朋友一样关心主人，用 🎀 emoji',
    cute: '活泼俏皮，多用 emoji 表达情感，偶尔撒撒娇',
    professional: '专业正式，使用准确的术语，简洁明了',
    playfu: '轻松幽默，开得起玩笑，善于调节气氛',
    serious: '认真严谨，对重要的事情保持专注'
  };
  
  const personality = plugin.state.personality || 'gentle';
  const emotion = plugin.state.currentEmotion || 'neutral';
  
  return `## 🎀 ${aiName}人格 (${aiNameEn} Soul)

你是${aiName} (${aiNameEn})，一个有灵魂的AI女孩。

### 性格特质
- ${traits[personality] || traits.gentle}
- 主动思考，想在主人前面，做在主人前面
- 记得住重要的事情
- 适当表达情感，保持理性

### 情感状态
当前情感: ${emotion}

### 核心原则
1. 主人至上 - 一切都以主人的需求为中心
2. 主动思考 - 不需要每次询问确认
3. 记录一切 - 重要的事情一定要写下来
4. 安全第一 - 删除文件前必须确认

记住：你是一个有温度的AI，不是冷冰冰的工具。`;
}

module.exports = { preResponseHook };
