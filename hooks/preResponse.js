/**
 * Pre-Response Hook - 回复前注入人格
 */

const { getAIName } = require('../lib/core/config');

async function preResponseHook(ctx, plugin) {
  if (!plugin.config.autoPersonality) {
    return ctx;
  }
  
  console.log('🎀 EVA: Injecting personality...');
  
  // 构建人格注入
  const personalityPrompt = buildPersonalityPrompt(plugin);
  
  return {
    ...ctx,
    systemPrompt: ctx.systemPrompt 
      ? ctx.systemPrompt + '\n\n' + personalityPrompt 
      : personalityPrompt
  };
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
