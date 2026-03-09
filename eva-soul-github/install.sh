#!/bin/bash
# 夏娃之魂集成技能 - 自动安装脚本
# 本技能通过skill hook机制集成，不需要修改全局文件

set -e

echo "🌟 夏娃之魂技能安装..."

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE="$HOME/.openclaw/workspace"
SKILL_DIR="$SCRIPT_DIR"
EVA_SOUL_DIR="$SKILL_DIR/eva-soul-github/scripts"

# 1. 检查核心文件
echo "【1/4】检查核心文件..."

if [ ! -f "$EVA_SOUL_DIR/eva_integrated_final.py" ]; then
    echo "❌ 错误: 未找到夏娃之魂核心系统"
    exit 1
fi

echo "✅ 核心系统存在"

# 2. 复制技能到workspace
echo ""
echo "【2/4】复制技能到workspace..."
mkdir -p "$WORKSPACE/skills"
rm -rf "$WORKSPACE/skills/eva-soul-integration"
cp -r "$SKILL_DIR" "$WORKSPACE/skills/"
echo "✅ 技能复制完成"

# 3. 创建记忆目录
echo ""
echo "【3/4】创建数据目录..."
mkdir -p "$WORKSPACE/memory-linked"
echo "✅ 数据目录创建完成"

# 4. 验证安装
echo ""
echo "【4/4】验证安装..."

if [ -f "$SKILL_DIR/eva-soul-github/scripts/eva_integrated_final.py" ]; then
    echo "✅ 安装验证通过"
else
    echo "❌ 安装验证失败"
    exit 1
fi

echo ""
echo "======================================"
echo "🎀 夏娃之魂技能安装完成！"
echo "======================================"
echo ""
echo "使用方式："
echo "  在对话中提及关键词触发：夏娃、灵魂、记忆、性格、情感"
echo ""
echo "重启OpenClaw让配置生效："
echo "  openclaw gateway restart"
