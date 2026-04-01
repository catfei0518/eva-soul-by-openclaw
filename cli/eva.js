#!/usr/bin/env node
/**
 * EVA Soul CLI - 夏娃之魂命令行工具
 */

const fs = require('fs');
const path = require('path');

// 使用结构化日志
const logger = require('../hooks/logger');

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
      logger.section('🎀 EVA 状态');
      logger.item(`情感: ${state.currentEmotion}`);
      logger.item(`性格: ${state.personality}`);
      logger.item(`等级: ${state.level} (经验: ${state.experience}/${state.expNeeded})`);
      logger.item(`会话: ${state.sessionCount}`);
      logger.item(`概念: ${state.concepts?.length || 0}`);
      logger.item(`记忆: ${state.conceptStats?.total || 0}`);
      logger.item(`模式: ${state.patternStats?.total || 0}`);
      logger.item(`动机: ${state.motivations?.length || 0}`);
      logger.item(`梦想: ${state.dreams?.length || 0}`);
      logger.item(`价值观: ${state.values?.length || 0}`);
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
        logger.success(`情感设置为: ${emotionArg}`, 'cli');
      }
    } else {
      logger.info(`当前情感: ${loadState()?.currentEmotion || 'unknown'}`, 'cli');
      logger.info('用法: eva emotion [happy|sad|neutral|...]', 'cli');
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
        logger.success(`添加概念: ${conceptArg}`, 'cli');
      }
    } else {
      const s = loadState();
      logger.info('概念列表:', 'cli');
      (s?.concepts || []).forEach((c, i) => {
        logger.item(`${i+1}. ${c.value} (${c.type})`, 'cli');
      });
    }
    break;

  case 'kg':
    const kg = loadKG();
    if (kg) {
      logger.section('知识图谱');
      logger.item(`节点: ${kg.nodes?.length || 0}`);
      logger.item(`边: ${kg.edges?.length || 0}`);
      logger.info('节点列表:', 'cli');
      (kg.nodes || []).forEach(n => {
        logger.item(`${n.label} (${n.type})`, 'cli');
      });
    }
    break;

  default:
    logger.section('🎀 EVA CLI - 夏娃之魂命令行工具');
    logger.info('用法:', 'cli');
    logger.info('  eva status        # 查看状态', 'cli');
    logger.info('  eva emotion [值]  # 查看/设置情感', 'cli');
    logger.info('  eva concept [值]  # 查看/添加概念', 'cli');
    logger.info('  eva kg            # 查看知识图谱', 'cli');
}
