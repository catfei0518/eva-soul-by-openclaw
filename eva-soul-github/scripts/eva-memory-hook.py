#!/usr/bin/env python3
"""
夏娃的记忆集成模块
在每次对话时自动加载/保存共享记忆
"""

import os
import json
import sys

# 添加脚本目录到路径
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MEMORY_SCRIPT = os.path.join(SCRIPT_DIR, "memory-vector-share.py")

def load_shared_memories(session_key, query=None, limit=5):
    """加载与当前对话相关的共享记忆"""
    if not os.path.exists(MEMORY_SCRIPT):
        return []
    
    # 使用记忆脚本搜索
    if query:
        cmd = f"python3 {MEMORY_SCRIPT} search '{query}' {limit}"
    else:
        cmd = f"python3 {MEMORY_SCRIPT} list"
    
    try:
        result = os.popen(cmd).read()
        # 解析结果
        if "条相关记忆" in result or "条长期记忆" in result:
            memories = []
            lines = result.split('\n')
            for line in lines:
                if ']' in line and '[' in line:
                    # 提取内容
                    content = line.split(']')[1].strip()
                    if content and not content.startswith('重要性'):
                        memories.append(content)
            return memories
    except Exception as e:
        print(f"加载记忆失败: {e}")
    
    return []

def should_remember(message, response):
    """判断是否应该记住这段对话"""
    # 重要性判断规则
    important_keywords = [
        "记住", "要记住", "不要忘记", 
        "我喜欢", "我讨厌", "我是",
        "主人是", "主人喜欢", "主人讨厌",
        "以后", "将来", "永远",
        "重要", "关键", "特别"
    ]
    
    text = message + response
    for keyword in important_keywords:
        if keyword in text:
            return True
    
    # 如果有明确的要求记住
    if "记住" in message:
        return True
    
    return False

def extract_memory_content(message, response):
    """从对话中提取需要记忆的内容"""
    memories = []
    
    # 提取关于主人的事实
    lines = message.split('\n')
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # 包含重要信息且是陈述句
        if any(kw in line for kw in ["我是", "主人", "喜欢", "讨厌", "是"]):
            if len(line) > 3 and len(line) < 100:
                memories.append(line)
    
    return memories

def add_shared_memory(content, importance, session_key):
    """添加共享记忆"""
    if not os.path.exists(MEMORY_SCRIPT):
        return False
    
    # 转义单引号
    content = content.replace("'", "\\'")
    
    cmd = f"python3 {MEMORY_SCRIPT} add '{content}' {importance} '{session_key}'"
    
    try:
        result = os.popen(cmd).read()
        return "成功" in result
    except Exception as e:
        print(f"保存记忆失败: {e}")
        return False

def get_memory_context(session_key):
    """获取记忆上下文（用于system prompt）"""
    memories = load_shared_memories(session_key, limit=3)
    
    if not memories:
        return ""
    
    context = "\n\n【重要记忆】\n"
    for i, m in enumerate(memories, 1):
        context += f"{i}. {m}\n"
    context += "【以上记忆非常重要，请记住】\n"
    
    return context

# CLI接口
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("夏娃记忆模块")
        print("用法:")
        print("  python eva-memory-hook.py get_context <session_key>")
        print("  python eva-memory-hook.py add <内容> <重要性> <session_key>")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "get_context":
        session_key = sys.argv[2] if len(sys.argv) > 2 else "unknown"
        print(get_memory_context(session_key))
    
    elif command == "add":
        content = sys.argv[2]
        importance = int(sys.argv[3]) if len(sys.argv) > 3 else 5
        session_key = sys.argv[4] if len(sys.argv) > 4 else "unknown"
        if add_shared_memory(content, importance, session_key):
            print("✅ 记忆已保存")
        else:
            print("❌ 保存失败")
    
    else:
        print(f"未知命令: {command}")
