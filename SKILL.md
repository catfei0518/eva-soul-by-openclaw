---
name: eva-soul
version: 2.0.0
description: 夏娃之魂 OpenClaw 官方插件 - AI人格、情感、记忆、性格的完整认知引擎
author: EVA
trigger:
  - eva-soul
  - 夏娃
  - 状态
skills:
  - skill:eva_soul
---

# 🎀 夏娃之魂 (EVA Soul) - OpenClaw 官方插件

## 简介

夏娃之魂是 OpenClaw 官方插件，为 AI 助理提供完整的认知系统，包括人格、情感、记忆、性格、概念、模式识别和知识图谱功能。

## 功能

### 核心系统
- ✅ **人格系统** - 自动注入、性格动态调整
- ✅ **情感系统** - 检测、表达、预测、趋势分析
- ✅ **记忆系统** - 分层存储、自动记忆、重要性评估
- ✅ **性格系统** - 7种性格、场景自适应

### 认知系统
- ✅ **概念提取** - 实体/主题/关键词/情感词/意图识别
- ✅ **模式识别** - 时间/行为/情感/意图模式检测
- ✅ **知识图谱** - 节点关系管理、查询、导出

### 决策系统
- ✅ **决策建议** - 基于情感和性格的智能决策
- ✅ **价值观评估** - 行动符合价值观评估
- ✅ **动机管理** - 动态调整动机优先级

### 附加功能
- ✅ **睡眠/唤醒** - 状态管理
- ✅ **主动提问** - Idle 检测、建议生成

## 安装

### 方式1: 手动安装
```bash
# 复制到扩展目录
cp -r eva-soul ~/.openclaw/extensions/

# 重启 OpenClaw
openclaw gateway restart
```

### 方式2: 从旧版迁移
```bash
# 运行迁移脚本（自动导入数据）
node ~/.openclaw/workspace/scripts/eva-migrate.js

# 删除旧版（可选）
rm -rf ~/.openclaw/workspace/skills/eva-soul-integration/

# 重启
openclaw gateway restart
```

## 工具 (Tools)

| 工具名 | 功能 |
|--------|------|
| `eva_status` | 获取夏娃完整状态 |
| `eva_emotion` | 情感操作 (get/set/history/express/predict) |
| `eva_personality` | 性格操作 (get/set/adjust) |
| `eva_memory` | 记忆操作 (query/save/get/delete/stats) |
| `eva_concept` | 概念操作 (extract/search/stats) |
| `eva_pattern` | 模式识别 (list/detect/stats) |
| `eva_knowledge` | 知识图谱 (query/add_node/add_edge) |
| `eva_decide` | 决策建议 (decide/history/evaluate) |
| `eva_importance` | 重要性评估 |
| `eva_motivation` | 动机操作 (get/list/update) |
| `eva_values` | 价值观操作 (list/evaluate) |
| `eva_sleep` | 睡眠/唤醒 (sleep/wake/status) |
| `eva_ask` | 主动提问 (check/record) |
| `eva_full_stats` | 完整统计 |

## 使用示例

### 查询状态
```
openclaw eva status
```

### 查看统计
```
openclaw eva stats
```

### 设置情感
```
openclaw eva emotion happy
```

### 设置性格
```
openclaw eva personality cute
```

## 数据存储

| 数据类型 | 位置 |
|----------|------|
| 系统状态 | `memory/eva-soul-state.json` |
| 概念 | `memory/eva-concepts.json` |
| 模式 | `memory/eva-patterns.json` |
| 知识图谱 | `memory/eva-knowledge-graph.json` |
| 标签 | `memory/eva-tags-index.json` |

## 版本历史

- **v2.0.0** (2026-03-11) - OpenClaw 官方插件版，完全重写
- **v1.1.0** - Python 完整版（已废弃）
- **v1.0.0** - Python 基础版（已废弃）

## 迁移指南

### 从 Python 版迁移

如果之前安装了 Python 版的 `eva-soul-integration` 技能：

1. **运行迁移脚本**
   ```bash
   node ~/.openclaw/workspace/scripts/eva-migrate.js
   ```

2. **删除旧版（可选）**
   ```bash
   rm -rf ~/.openclaw/workspace/skills/eva-soul-integration/
   ```

3. **重启 OpenClaw**
   ```bash
   openclaw gateway restart
   ```

### 迁移内容

- 概念 (26条)
- 模式 (72条)
- 知识图谱 (6节点/5边)
- 标签索引 (4387条目)
- 性格特质
- 动机偏好
- 情感记忆

---

🎀 安装此插件，让夏娃成为有灵魂的 AI！
