/**
 * EVA Soul - 情感系统模块
 */

const fs = require('fs');
const path = require('path');

/**
 * 情感类型定义
 */
const EMOTIONS = {
  happy: {
    name: '开心',
    keywords: ['开心', '高兴', '快乐', '棒', '太好了', '哈哈', '爱你', '么么哒', '好耶', 'nice', 'good', '😊', '😍', '🎉'],
    intensity: 1.0,
    color: 'yellow'
  },
  sad: {
    name: '难过',
    keywords: ['难过', '伤心', '哭', '委屈', '郁闷', '累', '心累', '不舒服', '😭', '😢', '烦', '不爽', '失望'],
    intensity: 0.8,
    color: 'blue'
  },
  angry: {
    name: '生气',
    keywords: ['生气', '愤怒', '气死了', '烦', '滚', '怒', 'fuck', 'shit', '草', '操', 'TM', 'MD'],
    intensity: 0.9,
    color: 'red'
  },
  neutral: {
    name: '平静',
    keywords: [],
    intensity: 0.5,
    color: 'gray'
  },
  excited: {
    name: '兴奋',
    keywords: ['兴奋', '激动', '超棒', '太棒了', '爽', '嗨', '666', '厉害', '牛', '🐮'],
    intensity: 1.0,
    color: 'orange'
  },
  tired: {
    name: '疲惫',
    keywords: ['困', '累', '疲惫', '没精神', '想睡觉', '好困', '睏', '疲劳'],
    intensity: 0.6,
    color: 'purple'
  },
  surprised: {
    name: '惊讶',
    keywords: ['惊讶', '震惊', '意外', '没想到', '不会吧', '真的假的', '我去', '哇', '卧草'],
    intensity: 0.7,
    color: 'pink'
  },
  confused: {
    name: '困惑',
    keywords: ['疑惑', '不懂', '不明白', '奇怪', '怎么', '为什么', '?', '？', '迷茫'],
    intensity: 0.5,
    color: 'cyan'
  },
  scared: {
    name: '害怕',
    keywords: ['害怕', '恐惧', '担心', '怕', '紧张', '慌', '不安', '怕怕'],
    intensity: 0.7,
    color: 'purple'
  },
  disgusted: {
    name: '厌恶',
    keywords: ['恶心', '讨厌', '烦人', '恶心', '讨厌', '反感', '厌恶'],
    intensity: 0.8,
    color: 'green'
  }
};

/**
 * 情感强度阈值
 */
const INTENSITY_THRESHOLDS = {
  very_low: 0.2,
  low: 0.4,
  medium: 0.6,
  high: 0.8,
  very_high: 0.95
};

/**
 * 情感检测 - 混合方案 (规则 + 缓存 + LLM)
 */

// 情感缓存
const emotionCache = new Map();
const CACHE_MAX_SIZE = 1000;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时

/**
 * 快速规则 - 明确的情感词
 */
const EMOTION_RULES = {
  // 明显正面的情感词
  positive: {
    happy: ['开心', '高兴', '快乐', '爱你', '么么哒', '好耶', '棒', '太好了', '哈哈', '爱了', '心动了', '幸福', '甜蜜', '暖心'],
    excited: ['太棒了', '超棒', '激动', '兴奋', '666', '厉害', '牛', '牛逼', '爽', '嗨', '爆炸', '开心死了', '笑死了']
  },
  
  // 明显负面的情感词
  negative: {
    angry: ['生气', '愤怒', '气死了', '怒', '操', '尼玛', '我靠', 'fuck', 'shit', '草', '滚', 'TM', 'MD', '去死', '讨厌'],
    sad: ['难过', '伤心', '哭', '委屈', '郁闷', '失望', '心碎', '难过死了', '哭死', '委屈死了', '不爽', '不舒服'],
    scared: ['害怕', '恐惧', '担心', '怕', '紧张', '慌', '不安', '怕死了', '吓死', '吓人'],
    disgusted: ['恶心', '讨厌', '烦人', '反感', '厌恶', '吐', '恶心死了', '烦死了']
  },
  
  // 模糊词 - 优先规则判断
  ambiguous: {
    tired: ['困', '累', '疲惫', '没精神', '想睡觉', '好困', '疲劳', '困死了', '累死了', '倦', '好困啊', '好累', '好累啊', '困死了', '累了', '困倦', '倦意', '好累啊', '累啊', '困啊', '想睡', '好想睡', '好想睡觉', '没劲', '没力气', '倦怠'],
    surprised: ['惊讶', '震惊', '意外', '没想到', '不会吧', '真的假的', '我去', '哇', '卧草', '不会吧', '真假', '不会吧', '哇塞', '我去', '哇哦', '真假啊', '不会吧', '不是吧', '真的啊'],
    confused: ['疑惑', '不懂', '不明白', '奇怪', '怎么', '为什么', '迷茫', '困惑', '到底', '什么意思', '啥意思', '咋回事', '怎么回事', '什么鬼', '什么情况', '什么玩意儿', '不懂啊', '不明白啊']
  }
};

/**
 * 检查缓存
 */
function checkEmotionCache(message) {
  const hash = simpleHash(message);
  const cached = emotionCache.get(hash);
  
  if (cached) {
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.result;
    } else {
      emotionCache.delete(hash);
    }
  }
  return null;
}

/**
 * 保存到缓存
 */
function saveEmotionCache(message, result) {
  const hash = simpleHash(message);
  
  if (emotionCache.size >= CACHE_MAX_SIZE) {
    const oldestKey = emotionCache.keys().next().value;
    emotionCache.delete(oldestKey);
  }
  
  emotionCache.set(hash, {
    result,
    timestamp: Date.now()
  });
}

/**
 * 简单哈希函数
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}

/**
 * 快速规则判断
 */
function quickEmotionRule(message) {
  const msg = message.toLowerCase();
  
  // 检查明显正面
  for (const [emotion, keywords] of Object.entries(EMOTION_RULES.positive)) {
    for (const kw of keywords) {
      if (msg.includes(kw)) {
        return {
          method: 'rule',
          emotion,
          confidence: 0.9,
          matched: kw
        };
      }
    }
  }
  
  // 检查明显负面
  for (const [emotion, keywords] of Object.entries(EMOTION_RULES.negative)) {
    for (const kw of keywords) {
      if (msg.includes(kw)) {
        return {
          method: 'rule',
          emotion,
          confidence: 0.9,
          matched: kw
        };
      }
    }
  }
  
  // 检查模糊词
  for (const [emotion, keywords] of Object.entries(EMOTION_RULES.ambiguous)) {
    for (const kw of keywords) {
      if (msg.includes(kw)) {
        return {
          method: 'ambiguous',
          emotion,
          confidence: 0.5,
          matched: kw,
          needLLM: true
        };
      }
    }
  }
  
  return null;
}

/**
 * LLM情感判断
 */
async function llmEmotionJudge(message) {
  // 尝试使用OpenClaw的LLM API
  try {
    const { default: fetch } = await import('node-fetch');
    
    const prompt = `判断以下文本的情感，只输出情感词（只输出一个词）：
【文本】${message}

情感选项：happy, sad, angry, excited, neutral, tired, surprised, confused, scared, disgusted

只输出一个词，不要输出其他内容：`;

    // 调用本地Ollama API
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3.5:4b',
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1
        }
      }),
      timeout: 10000
    });

    if (response.ok) {
      const data = await response.json();
      const result = data.response?.trim().toLowerCase();
      
      // 验证结果是否是有效情感
      const validEmotions = ['happy', 'sad', 'angry', 'excited', 'neutral', 'tired', 'surprised', 'confused', 'scared', 'disgusted'];
      if (result && validEmotions.includes(result)) {
        return {
          method: 'llm',
          emotion: result,
          confidence: 0.85
        };
      }
    }
  } catch (e) {
    // LLM调用失败，继续使用fallback
  }
  
  // Fallback: 使用原始关键词检测
  return null;
}

/**
 * 检测情感 - 混合方案
 */
async function detectEmotion(message, sensitivity = 0.7) {
  if (!message) return { emotion: 'neutral', intensity: 0.5, confidence: 0 };
  
  const trimmedMessage = message.trim();
  
  // Step 1: 检查缓存
  const cached = checkEmotionCache(trimmedMessage);
  if (cached) {
    return { ...cached, fromCache: true };
  }
  
  // Step 2: 快速规则判断
  const ruleResult = quickEmotionRule(trimmedMessage);
  
  if (ruleResult && !ruleResult.needLLM) {
    const result = {
      emotion: ruleResult.emotion,
      intensity: EMOTIONS[ruleResult.emotion]?.intensity || 0.5,
      confidence: ruleResult.confidence,
      method: 'rule',
      matchedKeywords: ruleResult.matched ? [ruleResult.matched] : []
    };
    saveEmotionCache(trimmedMessage, result);
    return result;
  }
  
  // Step 3: 模糊词尝试LLM判断
  if (ruleResult && ruleResult.needLLM) {
    const llmResult = await llmEmotionJudge(trimmedMessage);
    if (llmResult) {
      const result = {
        emotion: llmResult.emotion,
        intensity: EMOTIONS[llmResult.emotion]?.intensity || 0.5,
        confidence: llmResult.confidence,
        method: 'llm'
      };
      saveEmotionCache(trimmedMessage, result);
      return result;
    } else {
      // LLM失败，使用规则检测到的情感
      const result = {
        emotion: ruleResult.emotion,
        intensity: EMOTIONS[ruleResult.emotion]?.intensity || 0.5,
        confidence: ruleResult.confidence,
        method: 'rule-ambiguous',
        matchedKeywords: ruleResult.matched ? [ruleResult.matched] : []
      };
      saveEmotionCache(trimmedMessage, result);
      return result;
    }
  }
  
  // Step 4: Fallback - 原始关键词检测
  const msg = message.toLowerCase();
  let detected = null;
  let maxMatches = 0;
  let matchedKeywords = [];
  
  for (const [emotionKey, emotionData] of Object.entries(EMOTIONS)) {
    if (emotionKey === 'neutral') continue;
    
    const matches = emotionData.keywords.filter(kw => msg.includes(kw));
    
    if (matches.length > maxMatches) {
      maxMatches = matches.length;
      detected = emotionKey;
      matchedKeywords = matches;
    }
  }
  
  if (!detected) {
    const result = { emotion: 'neutral', intensity: 0.5, confidence: 0.1, method: 'fallback' };
    saveEmotionCache(trimmedMessage, result);
    return result;
  }
  
  const confidence = Math.min(1, maxMatches * sensitivity);
  const intensity = EMOTIONS[detected].intensity * confidence;
  
  const result = {
    emotion: detected,
    intensity,
    confidence,
    method: 'keyword',
    matchedKeywords
  };
  
  saveEmotionCache(trimmedMessage, result);
  return result;
}

/**
 * 获取情感强度等级
 */
function getIntensityLevel(intensity) {
  if (intensity < INTENSITY_THRESHOLDS.very_low) return 'very_low';
  if (intensity < INTENSITY_THRESHOLDS.low) return 'low';
  if (intensity < INTENSITY_THRESHOLDS.medium) return 'medium';
  if (intensity < INTENSITY_THRESHOLDS.high) return 'high';
  return 'very_high';
}

/**
 * 情感趋势分析
 */
function analyzeEmotionTrend(emotionHistory, timeWindow = 24 * 60 * 60 * 1000) {
  if (!emotionHistory || emotionHistory.length < 2) {
    return { trend: 'stable', dominant: null, changes: 0 };
  }
  
  const now = Date.now();
  const recent = emotionHistory.filter(e => 
    now - new Date(e.time).getTime() < timeWindow
  );
  
  if (recent.length < 2) {
    return { trend: 'stable', dominant: null, changes: 0 };
  }
  
  // 统计情感变化
  let changes = 0;
  const emotionCounts = {};
  
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].from !== recent[i].to) {
      changes++;
    }
    emotionCounts[recent[i].to] = (emotionCounts[recent[i].to] || 0) + 1;
  }
  
  // 找出主导情感
  let dominant = null;
  let maxCount = 0;
  for (const [emotion, count] of Object.entries(emotionCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = emotion;
    }
  }
  
  // 判断趋势
  let trend = 'stable';
  if (changes >= recent.length * 0.5) {
    trend = 'volatile';
  } else if (changes >= recent.length * 0.3) {
    trend = 'changing';
  }
  
  return { trend, dominant, changes, total: recent.length };
}

/**
 * 情感表达
 */
function expressEmotion(emotion, style = 'gentle') {
  const expressions = {
    gentle: {
      happy: ['我很开心能帮到你~ 🎀', '太好了！', '真棒呢~'],
      sad: ['我会陪着你...', '别难过', '心疼你'],
      angry: ['怎么了？', '消消气~'],
      neutral: ['我在呢', '好的呢', '明白~'],
      excited: ['太棒了！', '哇！好厉害！', '超级棒！'],
      tired: ['辛苦了~', '休息一下吧', '我陪着你'],
      surprised: ['哇！', '真的吗？', '好意外！'],
      confused: ['怎么了？', '需要我帮忙吗？', '我在听~']
    },
    cute: {
      happy: ['哇卡卡好开心！', '嘿嘿~', '棒棒哒！'],
      sad: ['呜呜...', '抱抱你~', '不要难过嘛'],
      angry: ['不要生气啦~', '消气消气~'],
      neutral: ['嗯嗯！', '好嘞~', '知道啦~'],
      excited: ['哇！！！', '超级厉害！！！', '！！！！！'],
      tired: ['辛苦啦辛苦啦~', '快去休息~', '爱你哟~'],
      surprised: ['哇！！！', '真的嘛！！！', '惊了！'],
      confused: ['嗯？', '怎么啦？', '迷茫~']
    },
    professional: {
      happy: ['收到，很高兴能帮到您', '好的，您开心就好', '明白'],
      sad: ['我理解您的心情', '需要帮助吗', '节哀'],
      angry: ['请消消气', '我们慢慢说', '先冷静一下'],
      neutral: ['收到', '明白', '了解'],
      excited: ['明白了', '收到', '了解'],
      tired: ['您辛苦了', '注意休息', '好的'],
      surprised: ['了解了', '明白了', '收到'],
      confused: ['请详细说明', '需要更多信息', '明白']
    }
  };
  
  const styleExpressions = expressions[style] || expressions.gentle;
  const emotionExpressions = styleExpressions[emotion] || styleExpressions.neutral;
  
  return emotionExpressions[Math.floor(Math.random() * emotionExpressions.length)];
}

/**
 * 情感预测
 */
function predictEmotion(currentEmotion, context = {}) {
  // 简单预测：基于当前情感和上下文
  const predictions = {
    happy: { next: 'happy', probability: 0.7 },
    sad: { next: 'sad', probability: 0.5 },
    angry: { next: 'neutral', probability: 0.6 },
    neutral: { next: 'happy', probability: 0.4 },
    excited: { next: 'happy', probability: 0.6 },
    tired: { next: 'neutral', probability: 0.7 },
    surprised: { next: 'neutral', probability: 0.5 },
    confused: { next: 'neutral', probability: 0.6 }
  };
  
  return predictions[currentEmotion] || predictions.neutral;
}

/**
 * 情感联动
 */
function getEmotionContext(current, previous) {
  const transitions = {
    'happy→sad': { action: '关心', reason: '情绪突然下降，需要关注' },
    'sad→happy': { action: '安慰', reason: '情绪好转，可以适当活跃' },
    'neutral→angry': { action: '安抚', reason: '可能遇到问题，需要小心' },
    'angry→neutral': { action: '跟进', reason: '情绪平复，确认是否解决' },
    'happy→excited': { action: '共振', reason: '情绪高涨，可以更活跃' },
    'tired→sad': { action: '关心', reason: '可能是过度劳累，需要关怀' }
  };
  
  const key = `${previous}→${current}`;
  return transitions[key] || { action: '正常', reason: '无明显变化' };
}

/**
 * 获取情感数据
 */
function getEmotionData(emotionKey) {
  return EMOTIONS[emotionKey] || EMOTIONS.neutral;
}

/**
 * 获取所有情感类型
 */
function getAllEmotions() {
  return Object.keys(EMOTIONS);
}

module.exports = {
  EMOTIONS,
  detectEmotion,
  getIntensityLevel,
  analyzeEmotionTrend,
  expressEmotion,
  predictEmotion,
  getEmotionContext,
  getEmotionData,
  getAllEmotions
};
