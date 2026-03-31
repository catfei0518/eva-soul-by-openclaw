#!/usr/bin/env node
/**
 * EVA Soul CLI - 夏娃之魂命令行工具
 */

const fs = require('fs');
const path = require('path');

const stateFile = path.join(process.env.HOME || '', '.openclaw/workspace/memory/eva-soul-state.json');
const kgFile = path.join(process.env.HOME || '', '.openclaw/workspace/memory/eva-knowledge-graph.json');

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch (e) {
    return null;
  }
}

function loadKG() {
  try {
    return JSON.parse(fs.readFileSync(kgFile, 'utf8'));
  } catch (e) {
    return null;
  }
}

const cmd = process.argv[2];

switch (cmd) {
  case 'status':
    const state = loadState();
    if (state) {
      console.log('=== 🎀 EVA 状态 ===');
      console.log('情感:', state.currentEmotion);
      console.log('性格:', state.personality);
      console.log('等级:', state.level, `(经验: ${state.experience}/${state.expNeeded})`);
      console.log('会话:', state.sessionCount);
      console.log('概念:', state.concepts?.length || 0);
      console.log('记忆:', state.conceptStats?.total || 0);
      console.log('模式:', state.patternStats?.total || 0);
      console.log('动机:', state.motivations?.length || 0);
      console.log('梦想:', state.dreams?.length || 0);
      console.log('价值观:', state.values?.length || 0);
    }
    break;
    
  case 'emotion':
    const emotionArg = process.argv[3];
    if (emotionArg) {
      const s = loadState();
      if (s) {
        s.currentEmotion = emotionArg;
        s.lastUpdate = new Date().toISOString();
        fs.writeFileSync(stateFile, JSON.stringify(s, null, 2));
        console.log(`✅ 情感设置为: ${emotionArg}`);
      }
    } else {
      console.log('当前情感:', loadState()?.currentEmotion || 'unknown');
      console.log('用法: eva emotion [happy|sad|neutral|...]');
    }
    break;
    
  case 'concept':
    const conceptArg = process.argv[3];
    if (conceptArg) {
      const s = loadState();
      if (s) {
        s.concepts = s.concepts || [];
        s.concepts.push({
          type: 'fact',
          value: conceptArg,
          importance: 8,
          createdAt: new Date().toISOString()
        });
        s.lastUpdate = new Date().toISOString();
        fs.writeFileSync(stateFile, JSON.stringify(s, null, 2));
        console.log(`✅ 添加概念: ${conceptArg}`);
      }
    } else {
      const s = loadState();
      console.log('概念列表:');
      (s?.concepts || []).forEach((c, i) => {
        console.log(`  ${i+1}. ${c.value} (${c.type})`);
      });
    }
    break;
    
  case 'kg':
    const kg = loadKG();
    if (kg) {
      console.log('=== 知识图谱 ===');
      console.log('节点:', kg.nodes?.length || 0);
      console.log('边:', kg.edges?.length || 0);
      console.log('\n节点列表:');
      (kg.nodes || []).forEach(n => {
        console.log(`  - ${n.label} (${n.type})`);
      });
    }
    break;
    
  default:
    console.log('🎀 EVA CLI - 夏娃之魂命令行工具');
    console.log('');
    console.log('用法:');
    console.log('  eva status        # 查看状态');
    console.log('  eva emotion [值]  # 查看/设置情感');
    console.log('  eva concept [值]  # 查看/添加概念');
    console.log('  eva kg            # 查看知识图谱');
}
