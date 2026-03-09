#!/usr/bin/env python3
"""
夏娃向量搜索系统
纯Python实现，支持SiliconFlow API
"""

import os
import json
import subprocess
import math

MEMORY_DIR = os.path.expanduser("~/.openclaw/workspace/memory")
VECTOR_FILE = os.path.join(MEMORY_DIR, "vectors.json")
MODEL = "BAAI/bge-large-zh-v1.5"

def get_api_key():
    config_file = os.path.expanduser("~/.openclaw/workspace/.credentials/siliconflow.txt")
    if os.path.exists(config_file):
        with open(config_file) as f:
            return f.read().strip()
    return os.environ.get("SILICONFLOW_API_KEY", "")

def get_embedding(text):
    api_key = get_api_key()
    if not api_key:
        return None
    
    # 转义特殊字符
    text_escaped = text.replace('"', '\\"').replace('\n', ' ')
    
    cmd = f'curl -s -X POST "https://api.siliconflow.cn/v1/embeddings" -H "Authorization: Bearer {api_key}" -H "Content-Type: application/json" -d \'{{"model": "{MODEL}", "input": "{text_escaped}"}}\''
    
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        data = json.loads(result.stdout)
        if "data" in data and len(data["data"]) > 0:
            return data["data"][0]["embedding"]
    except:
        pass
    return None

def dot_product(a, b):
    return sum(x * y for x, y in zip(a, b))

def magnitude(v):
    return math.sqrt(sum(x * x for x in v))

def cosine_similarity(a, b):
    if not a or not b:
        return 0
    return dot_product(a, b) / (magnitude(a) * magnitude(b) + 1e-8)

def load_vectors():
    if os.path.exists(VECTOR_FILE):
        with open(VECTOR_FILE) as f:
            return json.load(f)
    return {"items": [], "last_update": None}

def save_vectors(data):
    from datetime import datetime
    data["last_update"] = datetime.now().isoformat()
    with open(VECTOR_FILE, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def add_memory(text, metadata=None):
    embedding = get_embedding(text)
    if embedding is None:
        return False, "API不可用，使用关键词模式"
    
    data = load_vectors()
    data["items"].append({
        "text": text,
        "embedding": embedding,
        "metadata": metadata or {}
    })
    save_vectors(data)
    return True, f"已添加向量 (维度: {len(embedding)})"

def search(query, top_k=3, threshold=0.5):
    query_embedding = get_embedding(query)
    if query_embedding is None:
        return keyword_search(query, top_k)
    
    data = load_vectors()
    results = []
    
    for item in data.get("items", []):
        similarity = cosine_similarity(query_embedding, item["embedding"])
        
        if similarity >= threshold:
            results.append({
                "text": item["text"],
                "score": similarity,
                "metadata": item.get("metadata", {})
            })
    
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:top_k]

def keyword_search(query, top_k=3):
    data = load_vectors()
    query_lower = query.lower()
    results = []
    
    for item in data.get("items", []):
        text_lower = item["text"].lower()
        matches = sum(1 for word in query_lower.split() if word in text_lower)
        if matches > 0:
            results.append({
                "text": item["text"],
                "score": matches / max(1, len(query_lower.split())),
                "metadata": item.get("metadata", {})
            })
    
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:top_k]

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        data = load_vectors()
        print(f"向量库条目数: {len(data.get('items', []))}")
        print(f"最后更新: {data.get('last_update', '从未')}")
        print("\n用法:")
        print("  add <文本>     - 添加记忆")
        print("  search <查询>  - 语义搜索")
        print("  status         - 查看状态")
        sys.exit(0)
    
    cmd = sys.argv[1]
    
    if cmd == "add" and len(sys.argv) > 2:
        text = " ".join(sys.argv[2:])
        success, msg = add_memory(text)
        print(msg)
    
    elif cmd == "search" and len(sys.argv) > 2:
        query = " ".join(sys.argv[2:])
        results = search(query)
        print(f"搜索: {query}")
        if results:
            for i, r in enumerate(results, 1):
                print(f"  {i}. {r['text'][:60]}...")
                print(f"     相似度: {r['score']:.3f}")
        else:
            print("  无结果")
    
    elif cmd == "status":
        data = load_vectors()
        print(f"向量库条目数: {len(data.get('items', []))}")
        print(f"最后更新: {data.get('last_update', '从未')}")
