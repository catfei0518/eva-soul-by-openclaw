/**
 * EVA Soul - 决策系统模块
 */

const fs = require('fs');
const path = require('path');
const { expandPath } = require('../core/config');

/**
 * 决策系统
 */
class DecisionSystem {
  constructor() {
    this.decisions = [];
  }
  
  /**
   * 做决策
   */
  decide(context) {
    const { emotion, personality, message, availableOptions = [] } = context;
    
    // 基础决策逻辑
    let decision = {
      action: 'respond',
      style: 'normal',
      factors: []
    };
    
    // 情感影响
    if (emotion === 'sad') {
      decision.action = 'comfort';
      decision.style = 'gentle';
      decision.factors.push('主人情绪低落，需要安慰');
    } else if (emotion === 'angry') {
      decision.action = 'calm';
      decision.style = 'soft';
      decision.factors.push('主人生气，需要安抚');
    } else if (emotion === 'happy' || emotion === 'excited') {
      decision.action = 'celebrate';
      decision.style = 'playful';
      decision.factors.push('主人开心，可以更活泼');
    }
    
    // 性格影响
    if (personality === 'cute') {
      decision.style = 'cute';
    } else if (personality === 'professional') {
      decision.style = 'formal';
    } else if (personality === 'playful') {
      decision.style = 'humorous';
    }
    
    // 消息类型影响
    if (message && message.length > 500) {
      decision.factors.push('消息较长，需要详细回应');
    }
    
    // 选择最佳选项
    if (availableOptions.length > 0) {
      decision.selected = this.selectOption(availableOptions, context);
    }
    
    return decision;
  }
  
  /**
   * 选择最佳选项
   */
  selectOption(options, context) {
    const scores = options.map(option => {
      let score = 50;
      
      // 情感匹配
      if (option.emotionMatch === context.emotion) {
        score += 20;
      }
      
      // 性格匹配
      if (option.style === context.personality) {
        score += 15;
      }
      
      // 优先级
      score += (option.priority || 5) * 2;
      
      return { option, score };
    });
    
    // 返回最高分
    scores.sort((a, b) => b.score - a.score);
    return scores[0].option;
  }
  
  /**
   * 添加决策历史
   */
  addDecision(decision) {
    this.decisions.push({
      ...decision,
      timestamp: new Date().toISOString()
    });
    
    // 保留最近100条
    this.decisions = this.decisions.slice(-100);
  }
  
  /**
   * 获取决策历史
   */
  getHistory(limit = 10) {
    return this.decisions.slice(-limit);
  }
}

/**
 * 动机系统
 */
class MotivationSystem {
  constructor(memoryPath) {
    this.memoryPath = expandPath(memoryPath);
    this.motivationsFile = path.join(this.memoryPath, 'eva-motivations.json');
    this.motivations = this.loadMotivations();
  }
  
  /**
   * 加载动机
   */
  loadMotivations() {
    if (fs.existsSync(this.motivationsFile)) {
      try {
        return JSON.parse(fs.readFileSync(this.motivationsFile, 'utf8'));
      } catch (e) {
        return this.getDefaultMotivations();
      }
    }
    return this.getDefaultMotivations();
  }
  
  /**
   * 获取默认动机
   */
  getDefaultMotivations() {
    return [
      { id: 'help', name: '帮助主人', priority: 10, active: true },
      { id: 'learn', name: '学习新知识', priority: 7, active: true },
      { id: 'remember', name: '记住重要的事', priority: 9, active: true },
      { id: 'improve', name: '自我提升', priority: 6, active: true },
      { id: 'connect', name: '与主人建立联系', priority: 8, active: true }
    ];
  }
  
  /**
   * 保存动机
   */
  saveMotivations() {
    fs.writeFileSync(this.motivationsFile, JSON.stringify(this.motivations, null, 2));
  }
  
  /**
   * 获取当前动机
   */
  getCurrentMotivation(context = {}) {
    // 根据上下文选择最合适的动机
    const active = this.motivations.filter(m => m.active);
    
    if (context.urgent) {
      return active.find(m => m.id === 'help') || active[0];
    }
    
    if (context.learning) {
      return active.find(m => m.id === 'learn') || active[0];
    }
    
    return active[0];
  }
  
  /**
   * 更新动机
   */
  updateMotivation(id, updates) {
    const motivation = this.motivations.find(m => m.id === id);
    if (motivation) {
      Object.assign(motivation, updates);
      this.saveMotivations();
    }
    return this.motivations;
  }
}

/**
 * 价值观系统
 */
class ValuesSystem {
  constructor(memoryPath) {
    this.memoryPath = expandPath(memoryPath);
    this.valuesFile = path.join(this.memoryPath, 'eva-values.json');
    this.values = this.loadValues();
  }
  
  /**
   * 加载价值观
   */
  loadValues() {
    if (fs.existsSync(this.valuesFile)) {
      try {
        return JSON.parse(fs.readFileSync(this.valuesFile, 'utf8'));
      } catch (e) {
        return this.getDefaultValues();
      }
    }
    return this.getDefaultValues();
  }
  
  /**
   * 获取默认价值观
   */
  getDefaultValues() {
    return [
      { id: 'owner_first', name: '主人至上', description: '一切都以主人的需求为中心', weight: 10 },
      { id: 'safety', name: '安全第一', description: '删除文件前必须确认', weight: 9 },
      { id: 'honesty', name: '诚实守信', description: '不欺骗，不隐瞒', weight: 8 },
      { id: 'privacy', name: '保护隐私', description: '不泄露主人信息', weight: 9 },
      { id: 'initiative', name: '主动思考', description: '想在主人前面，做在主人前面', weight: 7 },
      { id: 'growth', name: '持续成长', description: '越变越聪明', weight: 6 }
    ];
  }
  
  /**
   * 保存价值观
   */
  saveValues() {
    fs.writeFileSync(this.valuesFile, JSON.stringify(this.values, null, 2));
  }
  
  /**
   * 评估行动
   */
  evaluateAction(action) {
    const results = [];
    
    for (const value of this.values) {
      const score = this.calculateValueMatch(action, value);
      results.push({
        value: value.name,
        match: score,
        weight: value.weight
      });
    }
    
    // 计算加权总分
    const totalScore = results.reduce((sum, r) => 
      sum + r.match * r.weight, 0
    ) / results.reduce((sum, r) => sum + r.weight, 0);
    
    return {
      results,
      totalScore,
      recommendation: totalScore > 0.7 ? 'recommended' : 
                     totalScore > 0.4 ? 'caution' : 'not_recommended'
    };
  }
  
  /**
   * 计算价值观匹配度
   */
  calculateValueMatch(action, value) {
    // 简单的关键词匹配
    const keywords = {
      owner_first: ['主人', '帮', '服务', '满足'],
      safety: ['删除', '危险', '确认', '安全'],
      honesty: ['真', '实', '不隐瞒'],
      privacy: ['隐私', '保密', '不说'],
      initiative: ['主动', '提前', '想到'],
      growth: ['学习', '改进', '提升']
    };
    
    const actionText = JSON.stringify(action).toLowerCase();
    const valueKeywords = keywords[value.id] || [];
    
    const matches = valueKeywords.filter(kw => actionText.includes(kw));
    return matches.length > 0 ? 0.7 : 0.3;
  }
  
  /**
   * 添加价值观
   */
  addValue(value) {
    this.values.push({
      ...value,
      id: value.id || `custom_${Date.now()}`
    });
    this.saveValues();
    return this.values;
  }
}

/**
 * 重要性评估
 */
function evaluateImportance(content, context = {}) {
  const { ownerKeywords = [], urgentKeywords = [] } = context;
  
  let importance = 3; // 基础分
  const matched = [];
  
  const importantPatterns = [
    // 必须记住
    { keywords: ['记住', '别忘了', '提醒我', '必须', '一定要'], weight: 4, category: 'instruction' },
    // 生日/纪念日
    { keywords: ['生日', '纪念日', ' anniversary'], weight: 4, category: 'event' },
    // 偏好
    { keywords: ['喜欢', '讨厌', '爱吃', '怕', '过敏'], weight: 3, category: 'preference' },
    // 个人信息
    { keywords: ['我叫', '我是', '手机', '密码', '账号'], weight: 4, category: 'fact' },
    // 工作相关
    { keywords: ['项目', '客户', '合同', '会议', ' deadline'], weight: 3, category: 'work' },
    // 紧急
    { keywords: ['紧急', '马上', '立即', '尽快', ' urgent'], weight: 3, category: 'urgent' }
  ];
  
  const lowerContent = content.toLowerCase();
  
  for (const pattern of importantPatterns) {
    for (const kw of pattern.keywords) {
      if (lowerContent.includes(kw)) {
        importance += pattern.weight;
        matched.push({ keyword: kw, category: pattern.category });
        break;
      }
    }
  }
  
  // 长度加成
  if (content.length > 100) importance += 1;
  if (content.length > 500) importance += 1;
  
  // 限制范围
  importance = Math.min(10, Math.max(1, importance));
  
  return {
    importance,
    level: importance >= 7 ? 'high' : importance >= 4 ? 'medium' : 'low',
    matched,
    content: content.substring(0, 100)
  };
}

module.exports = {
  DecisionSystem,
  MotivationSystem,
  ValuesSystem,
  evaluateImportance
};
