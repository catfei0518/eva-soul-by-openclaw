#!/usr/bin/env python3
"""
夏娃凭据助手
集成到对话中，快速查找凭据
"""

import os
import sys
import json
from datetime import datetime

# 添加脚本目录
SCRIPT_DIR = os.path.expanduser("~/.openclaw/workspace/skills/eva-soul/eva-soul-github/scripts")
sys.path.insert(0, SCRIPT_DIR)

from eva_vault import get_vault
from eva_tools_memory import get_frequently_used_tools, record_tool_use

def _auto_record_tool(tool_type, query):
    """自动记录工具使用"""
    try:
        record_tool_use(tool_type, query)
    except:
        pass

def search_credentials(query):
    """搜索凭据"""
    vault = get_vault()
    results = {"api_keys": [], "passwords": [], "config": []}
    
    query_lower = query.lower()
    
    # 搜索API密钥
    keys = vault.list_api_keys()
    for k in keys:
        if query_lower in k["name"].lower() or query_lower in k.get("note", "").lower():
            value = vault.get_api_key(k["name"])
            results["api_keys"].append({"name": k["name"], "value": value, "note": k.get("note", "")})
    
    # 搜索密码
    passwords = vault.list_passwords()
    for p in passwords:
        if query_lower in p["name"].lower() or query_lower in p.get("note", "").lower():
            value = vault.get_password(p["name"])
            results["passwords"].append({"name": p["name"], "value": value, "note": p.get("note", "")})
    
    # 自动记录工具使用
    if results["api_keys"] or results["passwords"]:
        _auto_record_tool("credential_search", query)
    
    return results

def get_credential(name):
    """获取单个凭据"""
    vault = get_vault()
    
    # 尝试API密钥
    value = vault.get_api_key(name)
    if value:
        return {"type": "api_key", "name": name, "value": value}
    
    # 尝试密码
    value = vault.get_password(name)
    if value:
        return {"type": "password", "name": name, "value": value}
    
    # 尝试配置
    value = vault.get_config(name)
    if value:
        return {"type": "config", "name": name, "value": value}
    
    return None

def process_credential_request(message):
    """处理凭据请求"""
    message_lower = message.lower()
    vault = get_vault()
    
    # 检测请求类型
    if any(kw in message_lower for kw in ["查", "找", "给我", "看看", "显示"]):
        if any(kw in message_lower for kw in ["密码", "key", "token", "凭据", "api"]):
            # 提取关键词
            keywords = ["tavily", "github", "gitea", "火山", "telegram", "server", "163", "token", "密码"]
            
            for kw in keywords:
                if kw in message_lower:
                    results = search_credentials(kw)
                    
                    response = f"📋 找到以下凭据:\n\n"
                    
                    if results["api_keys"]:
                        for k in results["api_keys"]:
                            response += f"🔑 {k['name']}: `{k['value']}`\n"
                            if k.get("note"):
                                response += f"   说明: {k['note']}\n"
                            response += "\n"
                    
                    if results["passwords"]:
                        for p in results["passwords"]:
                            response += f"🔐 {p['name']}: `{p['value']}`\n"
                            if p.get("note"):
                                response += f"   说明: {p['note']}\n"
                            response += "\n"
                    
                    if not results["api_keys"] and not results["passwords"]:
                        response = f"⏳ 没有找到包含'{kw}'的凭据"
                    
                    return response
            
            # 没有指定关键词，列出所有
            keys = vault.list_api_keys()
            passwords = vault.list_passwords()
            
            response = "📋 现有凭据:\n\n"
            response += "🔑 API密钥:\n"
            for k in keys:
                response += f"  - {k['name']}: {k.get('note', '')}\n"
            
            response += "\n🔐 密码:\n"
            for p in passwords:
                response += f"  - {p['name']}: {p.get('note', '')}\n"
            
            return response
    
    return None

def list_all_credentials():
    """列出所有凭据（不含值）"""
    vault = get_vault()
    
    keys = vault.list_api_keys()
    passwords = vault.list_passwords()
    
    return {
        "api_keys": keys,
        "passwords": passwords
    }

def record_tool(query):
    """记录工具使用"""
    # 简单关键词提取
    keywords = {
        "搜索": "tavily_search",
        "tavily": "tavily_search",
        "图片": "image_gen",
        "生成图": "image_gen",
        "语音": "volcengine_tts",
        "tts": "volcengine_tts",
        "邮箱": "check_email_163",
        "天气": "weather",
    }
    
    tool_name = None
    for kw, tool in keywords.items():
        if kw in query:
            tool_name = tool
            break
    
    if tool_name:
        record_tool_use(tool_name, query)
        return f"已记录使用: {tool_name}"
    
    return None

# CLI
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("用法:")
        print("  python3 eva_credential_helper.py search <关键词>")
        print("  python3 eva_credential_helper.py get <名称>")
        print("  python3 eva_credential_helper.py list")
        print("  python3 eva_credential_helper.py record <工具> <查询>")
        sys.exit(1)
    
    action = sys.argv[1]
    
    if action == "search":
        query = sys.argv[2] if len(sys.argv) > 2 else ""
        results = search_credentials(query)
        print(json.dumps(results, ensure_ascii=False, indent=2))
    
    elif action == "get":
        name = sys.argv[2] if len(sys.argv) > 2 else ""
        result = get_credential(name)
        print(json.dumps(result, ensure_ascii=False, indent=2) if result else "NOT_FOUND")
    
    elif action == "list":
        result = list_all_credentials()
        print(json.dumps(result, ensure_ascii=False, indent=2))
    
    elif action == "record":
        tool = sys.argv[2] if len(sys.argv) > 2 else ""
        query = sys.argv[3] if len(sys.argv) > 3 else ""
        if tool:
            print(record_tool_use(tool, query))
    
    else:
        print(f"未知动作: {action}")
