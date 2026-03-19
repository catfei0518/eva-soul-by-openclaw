/**
 * Post-Response Hook - 回复后自动记忆和情感更新
 */

const fs = require('fs');
const path = require('path');

const SILICONFLOW_KEY = 'sk-niomirqoomaiylusfestoavpaflrvcmrygsoarocroladwvt';

const MEMORY_CONFIG = {
  short: { file: 'short/short.json', days: 7 },
  medium: { file: 'medium/medium.json', days: 30 },
  long: { file: 'long/long.json', days: 90 }
};

// 向量生成
async function generateEmbedding(text) {
  try {
    const response = await fetch('https://api.siliconflow.cn/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SILICONFLOW_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model: 'BAAI/bge-m3', input: text })
    });
    const data = await response.json();
    return data.data?.[0]?.embedding || null;
  } catch (e) { return null; }
}

// 保存对话到记忆
async function saveDialogueToShortTerm(memoryPath, userMsg, assistantMsg) {
  const file = path.join(memoryPath, 'short', 'short.json');
  let memories = [];
  if (fs.existsSync(file)) {
    try { memories = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
  }
  memories.push({
    id: `mem_${Date.now()}`,
    content: `user: ${userMsg}\nassistant: ${assistantMsg}`,
    timestamp: new Date().toISOString(),
    type: 'dialogue'
  });
  fs.writeFileSync(file, JSON.stringify(memories, null, 2));
}

// 保存完整对话到向量库
async function saveConversationToStore(memoryPath, userMsg, assistantMsg) {
  try {
    const storePath = path.join(memoryPath, 'conversations');
    const rawDir = path.join(storePath, 'raw');
    const vecDir = path.join(storePath, 'vectors');
    [storePath, rawDir, vecDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });
    
    const id = `conv_${Date.now()}`;
    const messages = [
      { role: 'user', content: userMsg },
      { role: 'assistant', content: assistantMsg }
    ];
    
    // 保存原始
    fs.writeFileSync(path.join(rawDir, `${id}.json`), JSON.stringify({ id, messages }, null, 2));
    
    // 生成向量
    const text = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    const embedding = await generateEmbedding(text);
    if (embedding) {
      fs.writeFileSync(path.join(vecDir, `${id}.json`), JSON.stringify({ id, embedding, text: text.substring(0, 500) }, null, 2));
    }
  } catch (e) { console.error('对话存储失败:', e.message); }
}

async function postResponseHook(ctx, plugin) {
  const userMessage = ctx.userMessage || '';
  const assistantMessage = ctx.assistantMessage || '';
  if (!userMessage) return ctx;
  
  const memoryPath = plugin.config?.memoryPath || path.join(process.env.HOME || '/root', '.openclaw/workspace/memory');
  
  // 保存短期记忆
  await saveDialogueToShortTerm(memoryPath, userMessage, assistantMessage);
  
  // 保存完整对话到向量库
  await saveConversationToStore(memoryPath, userMessage, assistantMessage);
  
  return ctx;
}

module.exports = { postResponseHook };
