/**
 * EVA Soul - 记忆系统模块 (优化版)
 * 索引 + 缓存 加速搜索
 */

const fs = require('fs');
const path = require('path');

// 简化路径处理
function expandPath(p) {
  if (p.startsWith('~/')) {
    return path.join(process.env.HOME || '/root', p.slice(2));
  }
  return p;
}

/**
 * LRU缓存实现
 */
class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return null;
    
    // 移到末尾（最近使用）
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // 删除最旧的（第一个）
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

/**
 * 记忆层级
 */
const MEMORY_TIERS = {
  short: { name: '短期记忆', maxAge: 7 * 24 * 60 * 60 * 1000, maxItems: 100 },
  medium: { name: '中期记忆', maxAge: 30 * 24 * 60 * 60 * 1000, maxItems: 500 },
  long: { name: '长期记忆', maxAge: 90 * 24 * 60 * 60 * 1000, maxItems: 1000 },
  archive: { name: '归档存储', maxAge: null, maxItems: null }
};

/**
 * 记忆类型
 */
const MEMORY_TYPES = {
  conversation: { name: '对话', priority: 3 },
  fact: { name: '事实', priority: 7 },
  preference: { name: '偏好', priority: 8 },
  event: { name: '事件', priority: 5 },
  instruction: { name: '指令', priority: 9 },
  emotion: { name: '情感', priority: 6 },
  relationship: { name: '关系', priority: 8 },
  knowledge: { name: '知识', priority: 4 }
};

/**
 * 记忆接口 (优化版)
 */
class MemoryStore {
  constructor(memoryPath) {
    this.memoryPath = expandPath(memoryPath);
    this.cache = new LRUCache(100);  // 缓存100条记忆
    this.index = { keywords: new Map(), entities: new Map() };
    this.indexFile = path.join(memoryPath, 'index.json');
    
    this.ensureDirectories();
    this.loadIndex();  // 加载索引
  }

  /**
   * 确保目录存在
   */
  ensureDirectories() {
    const dirs = ['', 'short', 'medium', 'long', 'archive', 'auto'];
    for (const dir of dirs) {
      const fullPath = path.join(this.memoryPath, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    }
  }

  /**
   * 加载索引
   */
  loadIndex() {
    try {
      if (fs.existsSync(this.indexFile)) {
        const data = JSON.parse(fs.readFileSync(this.indexFile, 'utf8'));
        this.index.keywords = new Map(Object.entries(data.keywords || {}));
        this.index.entities = new Map(Object.entries(data.entities || {}));
        console.log('[Memory] 索引已加载');
      }
    } catch (e) {
      console.log('[Memory] 索引加载失败，将重新构建');
    }
  }

  /**
   * 保存索引
   */
  saveIndex() {
    try {
      const data = {
        keywords: Object.fromEntries(this.index.keywords),
        entities: Object.fromEntries(this.index.entities),
        lastUpdate: new Date().toISOString()
      };
      fs.writeFileSync(this.indexFile, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('[Memory] 索引保存失败:', e);
    }
  }

  /**
   * 更新索引（单条记忆）
   */
  updateIndex(memory) {
    // 提取关键词
    const words = this.extractKeywords(memory.content);
    for (const word of words) {
      if (!this.index.keywords.has(word)) {
        this.index.keywords.set(word, new Set());
      }
      this.index.keywords.get(word).add(memory.id);
    }
    
    // 提取实体
    const entities = this.extractEntities(memory.content);
    for (const entity of entities) {
      if (!this.index.entities.has(entity)) {
        this.index.entities.set(entity, new Set());
      }
      this.index.entities.get(entity).add(memory.id);
    }
  }

  /**
   * 提取关键词
   */
  extractKeywords(text) {
    // 简单分词
    const words = text.toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 2);
    
    // 去重，返回Set
    return [...new Set(words)];
  }

  /**
   * 🔍 语义扩展：同义词 + 相关词搜索
   */
  expandQuery(query) {
    if (!query) return [query];
    
    // 同义词词典
    const synonyms = {
      // 地点相关
      "北京": ["首都", "京城", "帝都"],
      "西安": ["长安", "古城"],
      "上海": ["魔都", "沪"],
      "遵义": ["遵义"],
      
      // 情感相关
      "爱": ["喜欢", "心悦", "爱", "恋", "宝贝"],
      "开心": ["高兴", "快乐", "幸福", "愉快", "欢乐"],
      "难过": ["伤心", "悲伤", "不爽", "郁闷", "烦"],
      "生气": ["愤怒", "气", "不爽"],
      "害怕": ["恐惧", "怕", "担心"],
      
      // 重要事项
      "约定": ["承诺", "答应", "说好的", "保证"],
      "生日": ["出生", "诞辰"],
      "纪念日": ["节日", "特别的日子"],
      
      // 动作相关
      "去": ["旅行", "旅游", "出行", "去"],
      "学习": ["学", "学会", "掌握"],
      "工作": ["上班", "忙", "处理"],
      
      // 关系
      "主人": ["你", "老公", "老板"],
      "夏娃": ["我", "EVA", "eva"]
    };
    
    const expanded = [query]; // 保留原始查询
    
    // 检查是否有匹配的同义词
    for (const [word, syns] of Object.entries(synonyms)) {
      if (query.includes(word)) {
        expanded.push(...syns);
      }
      // 反向：查询同义词时也包含原词
      if (syns.includes(query)) {
        expanded.push(word);
      }
    }
    
    // 去重
    return [...new Set(expanded)];
  }

  /**
   * 提取实体（简化版）
   */
  extractEntities(text) {
    const entities = [];
    
    // 识别人名（简单规则）
    const namePattern = /(|我叫|我是|主人叫|我叫).我叫{2,5}/g;
    const names = text.match(namePattern);
    if (names) {
      entities.push(...names.map(n => n.replace('我叫', '').replace('我叫', '').replace('我是', '').replace('主人叫', '')));
    }
    
    // 识别时间
    const timePattern = /(\d{1,2}月\d{1,2}日|\d{4}年\d{1,2}月)/g;
    const times = text.match(timePattern);
    if (times) {
      entities.push(...times);
    }
    
    return entities;
  }

  /**
   * 保存记忆
   */
  save(memory) {
    const { content, type = 'fact', importance = 5, tags = [], metadata = {} } = memory;
    
    const id = 'mem_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
    const now = new Date().toISOString();
    
    const memoryEntry = {
      id,
      content,
      type,
      importance,
      tags,
      metadata,
      createdAt: now,
      updatedAt: now,
      accessedAt: now,
      accessCount: 0,
      tier: 'short',
      _keywords: this.extractKeywords(content),  // 预提取关键词
      _summary: content.substring(0, 100)  // 摘要
    };
    
    // 保存到文件
    const fileName = `${id}.json`;
    const filePath = path.join(this.memoryPath, 'short', fileName);
    fs.writeFileSync(filePath, JSON.stringify(memoryEntry, null, 2));
    
    // 更新索引
    this.updateIndex(memoryEntry);
    this.saveIndex();
    
    // 放入缓存
    this.cache.set(id, memoryEntry);
    
    return { id, ...memoryEntry };
  }

  /**
   * 快速搜索（使用索引）
   */
  search(query, options = {}) {
    const { 
      limit = 10, 
      minImportance = 0, 
      types = [],
      // 🎯 高级查询过滤
      tier = null,        // short/medium/long
      days = null,        // 最近N天
      sortBy = 'relevance'  // relevance/importance/time
    } = options;
    
    // 🔍 语义扩展：同义词 + 相关词
    const expandedQueries = this.expandQuery(query);
    
    // 1. 通过索引快速定位候选ID（支持语义扩展）
    let candidateIds = new Set();
    
    if (query) {
      for (const q of expandedQueries) {
        const keywords = this.extractKeywords(q);
        for (const kw of keywords) {
          const matched = this.index.keywords.get(kw.toLowerCase());
          if (matched) {
            for (const id of matched) {
              candidateIds.add(id);
            }
          }
        }
      }
    } else {
      // 无查询，返回所有
      candidateIds = null;
    }
    
    // 2. 获取候选记忆
    const results = [];
    const tiers = ['short', 'medium', 'long'];
    
    for (const tier of tiers) {
      const tierPath = path.join(this.memoryPath, tier);
      if (!fs.existsSync(tierPath)) continue;
      
      const files = fs.readdirSync(tierPath).filter(f => f.endsWith('.json'));
      
      for (const file of files) {
        const id = file.replace('.json', '');
        
        // 如果有查询，跳过不在候选中的
        if (candidateIds && !candidateIds.has(id)) continue;
        
        // 3. 尝试从缓存获取
        let memory = this.cache.get(id);
        
        if (!memory) {
          // 缓存未命中，从文件读取
          try {
            const content = fs.readFileSync(path.join(tierPath, file), 'utf8');
            memory = JSON.parse(content);
            this.cache.set(id, memory);  // 放入缓存
          } catch (e) {
            continue;
          }
        }
        
        // 过滤
        if (memory.importance < minImportance) continue;
        if (types.length > 0 && !types.includes(memory.type)) continue;
        
        // 额外搜索检查（因为索引可能不全）
        if (query && !memory.content.toLowerCase().includes(query.toLowerCase())) {
          continue;
        }
        
        // 计算相关性
        const relevance = this.calculateRelevance(memory, query);
        
        results.push({ ...memory, relevance, tier });
      }
    }
    
    // 🎯 高级过滤
    // 1. 按层级过滤
    if (tier) {
      results = results.filter(r => r.tier === tier);
    }
    
    // 2. 按时间过滤（最近N天）
    if (days) {
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      results = results.filter(r => {
        const created = new Date(r.created_at || r.createdAt).getTime();
        return created > cutoff;
      });
    }
    
    // 3. 按重要性过滤
    if (minImportance > 0) {
      results = results.filter(r => r.importance >= minImportance);
    }
    
    // 4. 按类型过滤
    if (types && types.length > 0) {
      results = results.filter(r => types.includes(r.type));
    }
    
    // 🎯 排序方式
    if (sortBy === 'importance') {
      results.sort((a, b) => b.importance - a.importance);
    } else if (sortBy === 'time') {
      results.sort((a, b) => {
        const timeA = new Date(a.created_at || a.createdAt).getTime();
        const timeB = new Date(b.created_at || b.createdAt).getTime();
        return timeB - timeA;
      });
    } else {
      // 默认按相关性
      results.sort((a, b) => b.relevance - a.relevance || b.importance - a.importance);
    }
    
    // 排序并返回
    return results
      .sort((a, b) => b.relevance - a.relevance || b.importance - a.importance)
      .slice(0, limit)
      .map(m => ({
        // 返回精简版，减少Token
        id: m.id,
        content: m.summary || m._summary || m.content.substring(0, 100),
        type: m.type,
        importance: m.importance,
        tags: m.tags,
        tier: m.tier,
        relevance: m.relevance
      }));
  }

  /**
   * 获取记忆（优先缓存）
   */
  get(id) {
    // 先查缓存（热门层）
    const cached = this.cache.get(id);
    if (cached) {
      // 更新访问信息
      cached.accessCount = (cached.accessCount || 0) + 1;
      cached.accessedAt = new Date().toISOString();
      return cached;
    }
    
    // 缓存未命中，从文件读取
    const tiers = ['short', 'medium', 'long', 'archive'];
    
    for (const tier of tiers) {
      const filePath = path.join(this.memoryPath, tier, `${id}.json`);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const memory = JSON.parse(content);
          
          // 更新访问信息
          memory.accessedAt = new Date().toISOString();
          memory.accessCount = (memory.accessCount || 0) + 1;
          
          // 🔥 智能分层：根据访问次数自动升级
          if (memory.accessCount > 10) {
            memory.tier = 'hot';  // 热门
          } else if (memory.accessCount > 5) {
            memory.tier = 'warm';  // 温热
          }
          
          // 保存更新
          fs.writeFileSync(filePath, JSON.stringify(memory, null, 2));
          
          // 放入缓存
          this.cache.set(id, memory);
          
          return memory;
        } catch (e) {
          return null;
        }
      }
    }
    
    return null;
  }

  /**
   * 删除记忆
   */
  delete(id) {
    const tiers = ['short', 'medium', 'long', 'archive'];
    let found = false;
    
    for (const tier of tiers) {
      const filePath = path.join(this.memoryPath, tier, `${id}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        found = true;
        
        // 从缓存删除
        this.cache.delete(id);
        
        // 从索引删除（简化处理：重建索引）
        this.rebuildIndex();
        break;
      }
    }
    
    return found;
  }

  /**
   * 重建索引
   */
  rebuildIndex() {
    this.index = { keywords: new Map(), entities: new Map() };
    
    const tiers = ['short', 'medium', 'long'];
    for (const tier of tiers) {
      const tierPath = path.join(this.memoryPath, tier);
      if (!fs.existsSync(tierPath)) continue;
      
      const files = fs.readdirSync(tierPath).filter(f => f.endsWith('.json'));
      
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(tierPath, file), 'utf8');
          const memory = JSON.parse(content);
          this.updateIndex(memory);
        } catch (e) {
          // ignore
        }
      }
    }
    
    this.saveIndex();
    console.log('[Memory] 索引重建完成');
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const stats = { short: 0, medium: 0, long: 0, archive: 0, total: 0, cacheSize: this.cache.size };
    
    const tiers = ['short', 'medium', 'long', 'archive'];
    
    for (const tier of tiers) {
      const tierPath = path.join(this.memoryPath, tier);
      if (!fs.existsSync(tierPath)) continue;
      
      const files = fs.readdirSync(tierPath).filter(f => f.endsWith('.json'));
      stats[tier] = files.length;
      stats.total += files.length;
    }
    
    return stats;
  }

  /**
   * 计算相关性
   */
  calculateRelevance(memory, query) {
    if (!query) return memory.importance;
    
    let relevance = 0;
    const lowerQuery = query.toLowerCase();
    
    // 内容匹配
    if (memory.content.toLowerCase().includes(lowerQuery)) {
      relevance += 10;
    }
    
    // 标签匹配
    for (const tag of memory.tags || []) {
      if (tag.toLowerCase().includes(lowerQuery)) {
        relevance += 5;
      }
    }
    
    // 重要性
    relevance += memory.importance;
    
    // 🔥 热度因子：访问次数越多越相关
    relevance += Math.min(10, memory.accessCount || 0);
    
    // 🔥 热门层加成
    if (memory.tier === 'hot' || memory.accessCount > 10) {
      relevance += 5;  // 热门记忆额外+5分
    } else if (memory.tier === 'warm' || memory.accessCount > 5) {
      relevance += 2;  // 温热记忆额外+2分
    }
    
    // 时间衰减：最近访问的更相关
    if (memory.accessedAt) {
      const daysSinceAccess = (Date.now() - new Date(memory.accessedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceAccess < 1) relevance += 3;      // 1天内访问 +3
      else if (daysSinceAccess < 7) relevance += 1;  // 7天内访问 +1
      else if (daysSinceAccess > 30) relevance -= 2; // 30天前访问 -2
    }
    
    return relevance;
  }

  /**
   * 自动保存
   */
  autoSave(message, emotion = 'neutral') {
    const autoKeywords = [
      { keyword: '记住', type: 'instruction', importance: 9 },
      { keyword: '喜欢', type: 'preference', importance: 7 },
      { keyword: '生日', type: 'event', importance: 9 },
      { keyword: '我叫', type: 'fact', importance: 8 },
      { keyword: '约定', type: 'event', importance: 9 },
      { keyword: '承诺', type: 'event', importance: 9 }
    ];
    
    for (const { keyword, type, importance } of autoKeywords) {
      if (message.toLowerCase().includes(keyword)) {
        return this.save({
          content: message,
          type,
          importance,
          tags: [keyword, 'auto'],
          metadata: { emotion, auto: true }
        });
      }
    }
    
    return null;
  }
}

module.exports = {
  MEMORY_TIERS,
  MEMORY_TYPES,
  MemoryStore,
  LRUCache
};

