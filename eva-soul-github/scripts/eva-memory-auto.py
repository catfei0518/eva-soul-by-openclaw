#!/usr/bin/env python3
"""
夏娃记忆自动保存模块
监控对话日志，自动保存重要内容
"""

import os
import json
import sys
from datetime import datetime
import glob

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MEMORY_SCRIPT = os.path.join(SCRIPT_DIR, "memory-vector-share.py")
HOOK_SCRIPT = os.path.join(SCRIPT_DIR, "eva-memory-hook.py")

def get_recent_messages(limit=50):
    """获取最近的对话记录"""
    sessions_dir = os.path.expanduser("~/.openclaw/agents/main/sessions")
    
    if not os.path.exists(sessions_dir):
        return []
    
    # 获取最新的session文件
    session_files = sorted(glob.glob(f"{sessions_dir}/*.jsonl"), 
                          key=os.path.getmtime, reverse=True)
    
    if not session_files:
        return []
    
    messages = []
    for session_file in session_files[:2]:  # 只看最近2个session
        try:
            with open(session_file, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            
            for line in lines[-limit:]:
                try:
                    record = json.loads(line.strip())
                    if record.get('type') == 'message':
                        msg = record.get('message', {})
                        role = msg.get('role', '')
                        content_list = msg.get('content', [])
                        
                        # 提取文本内容
                        text = ''
                        for item in content_list:
                            if item.get('type') == 'text':
                                text = item.get('text', '')
                                break
                        
                        if text and role in ['user', 'assistant']:
                            messages.append({
                                'role': role,
                                'content': text,
                                'session': os.path.basename(session_file)
                            })
                except:
                    pass
        except:
            pass
    
    return messages

def analyze_and_save_memories(messages):
    """分析对话并自动保存重要内容"""
    saved = []
    
    important_patterns = [
        ("主人是(.+)", 8),
        ("主人喜欢(.+)", 7),
        ("主人讨厌(.+)", 7),
        ("主人工作在(.+)", 8),
        ("主人住在(.+)", 7),
        ("我喜欢(.+)", 6),
        ("我是(.+)", 7),
        ("记住(.+)", 9),
    ]
    
    import re
    
    for msg in messages:
        content = msg.get('content', '')
        
        for pattern, importance in important_patterns:
            match = re.search(pattern, content)
            if match:
                fact = match.group(1).strip()
                if len(fact) > 2 and len(fact) < 100:
                    # 检查是否已存在
                    cmd = f"python3 {HOOK_SCRIPT} get_context auto"
                    existing = os.popen(cmd).read()
                    
                    if fact not in existing:
                        cmd = f'python3 {HOOK_SCRIPT} add "{fact}" {importance} "auto"'
                        result = os.popen(cmd).read()
                        if "成功" in result:
                            saved.append(fact)
    
    return saved

# CLI
if __name__ == "__main__":
    print(f"🔍 分析最近对话...")
    messages = get_recent_messages()
    
    print(f"📝 找到 {len(messages)} 条消息")
    
    if messages:
        saved = analyze_and_save_memories(messages)
        
        if saved:
            print(f"✅ 自动保存了 {len(saved)} 条新记忆:")
            for s in saved:
                print(f"   - {s}")
        else:
            print("没有发现新的重要信息")
    else:
        print("没有找到对话记录")
    
    # ===== 归档检查 =====
    print("\n🔄 检查记忆层级...")
    try:
        import sys
        sys.path.insert(0, SCRIPT_DIR)
        from eva_tier_archive import check_and_upgrade_with_adjustment, get_tier_stats
        
        stats = check_and_upgrade_with_adjustment()
        tier_stats = get_tier_stats()
        
        print(f"   升级统计: short→medium:{stats.get('short_to_medium', 0)}, " +
              f"medium→long:{stats.get('medium_to_long', 0)}, " +
              f"long→archive:{stats.get('long_to_archive', 0)}")
        print(f"   重要性调整: {stats.get('importance_adjusted', 0)}条")
        print(f"   当前分布: short:{tier_stats['short']['count']}, " +
              f"medium:{tier_stats['medium']['count']}, " +
              f"long:{tier_stats['long']['count']}, " +
              f"archive:{tier_stats['archive']['count']}")
    except Exception as e:
        print(f"   归档检查跳过: {e}")
