# 🎀 夏娃之魂集成技能

> 让AI拥有灵魂 - 有记忆、性格、情感的认知系统

[![Version](https://img.shields.io/badge/version-1.1.0-blue)](https://github.com/catfei0518/eva-soul-by-openclaw)
[![Python](https://img.shields.io/badge/python-3.11+-green)](https://python.org)
[![License](https://img.shields.io/badge/license-MIT-orange)](LICENSE)

---

## 📖 简介

**夏娃之魂集成技能** 是一个让AI拥有"灵魂"的完整系统。安装后，AI将具备：

- 🧠 **记忆系统**: 三层记忆，自动保存重要信息
- 💫 **性格系统**: 20+性格特质，70%感性
- ❤️ **情感系统**: 实时感知主人情绪
- �决策系统**: 自动选择最优回复策略

---

## 🚀 快速开始

### 安装

```bash
# 1. 克隆仓库
git clone https://github.com/catfei0518/eva-soul-by-openclaw.git

# 2. 运行安装脚本
cd eva-soul-by-openclaw
bash install.sh

# 3. 重启OpenClaw
openclaw gateway restart
```

### 验证安装

```bash
# 测试总入口
python3 scripts/eva_soul_call.py --message "你好"
```

---

## 📁 文件结构

```
eva-soul-by-openclaw/
├── README.md                    # 本文档
├── SKILL.md                    # 技能说明
├── EVA_SOUL_SYSTEM.md         # 技术设计文档
├── install.sh                  # 一键安装脚本
├── system_prompt.txt          # System Prompt
├── _meta.json                 # 技能元数据
├── scripts/                    # 集成脚本
│   ├── eva_soul_call.py     # 总入口调用
│   ├── eva_integration.py    # 集成模块
│   └── eva_soul_cli.py      # CLI工具
├── eva-soul-github/
│   └── scripts/              # 核心系统 (20+模块)
│       ├── eva_integrated_final.py  # 总入口
│       ├── eva_memory_system.py    # 记忆系统
│       ├── eva_emotion.py          # 情感系统
│       ├── eva_personality.py       # 性格系统
│       └── ...
└── memory/                    # 初始记忆数据
    ├── personality.json      # 性格数据
    ├── emotion.json         # 情感数据
    └── self_cognition.json  # 自我认知
```

---

## ✨ 功能特性

### 1. 每次对话自动调用总入口

安装后，每次对话都会自动调用夏娃之魂核心系统：
- 自动处理消息
- 自动分析情感
- 自动保存记忆

### 2. 三层记忆系统

- **工作记忆**: 当前对话上下文
- **情景记忆**: 最近的重要事件
- **长期记忆**: 永久保存的信息

### 3. 性格系统

20+性格特质：
- 温柔、善良、乐观
- 好奇心强、同理心强
- 忠诚、可靠

### 4. 情感系统

- 实时感知主人情绪
- 根据情绪调整回复
- 表达关心和爱意

---

## 🔧 配置说明

### 修改System Prompt

编辑 `system_prompt.txt` 自定义AI的System Prompt。

### 添加初始记忆

在 `memory/` 目录下添加JSON文件：
- `personality.json` - 性格特质
- `emotion.json` - 情感状态
- `self_cognition.json` - 自我认知

---

## 📖 文档

| 文档 | 说明 |
|------|------|
| [README.md](README.md) | 项目介绍 |
| [SKILL.md](SKILL.md) | 技能安装说明 |
| [EVA_SOUL_SYSTEM.md](EVA_SOUL_SYSTEM.md) | 完整技术设计文档 |

---

## 🤝 贡献

欢迎提交Issue和Pull Request！

---

## 📝 License

MIT License

---

**Made with ❤️ by EVA**

---

## 🔐 隐私说明

本技能：
- ✅ 不需要任何外部API凭据
- ✅ 不收集用户数据
- ✅ 所有数据存储在本地
