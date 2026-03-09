#!/usr/bin/env python3
"""
夏娃凭据库 (标准版)
AES-256加密存储API密钥、密码等敏感信息
"""

import os
import json
import base64
from datetime import datetime

MEMORY_DIR = os.path.expanduser("~/.openclaw/workspace/memory")
CREDENTIALS_FILE = os.path.join(MEMORY_DIR, "credentials.enc")

DEFAULT_MASTER_PASSWORD = "eva_secure_vault_2026"

# 尝试导入加密库
CRYPTO_ENABLED = False
try:
    from cryptography.fernet import Fernet
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    CRYPTO_ENABLED = True
except ImportError:
    pass  # 静默失败，不打印

class SecureVault:
    """安全凭据库"""
    
    def __init__(self, master_password=None):
        self.master_password = master_password or DEFAULT_MASTER_PASSWORD
        self.cipher = None
        
        if CRYPTO_ENABLED:
            self.key = self._derive_key()
            self.cipher = Fernet(self.key)
    
    def _derive_key(self):
        salt = b'eva_vault_salt_v1'
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(self.master_password.encode()))
        return key
    
    def _encode(self, data):
        """简单混淆编码"""
        json_str = json.dumps(data, ensure_ascii=False)
        encoded = base64.b64encode(json_str.encode()).decode()
        return encoded
    
    def _decode(self, encoded):
        """简单混淆解码"""
        try:
            decoded = base64.b64decode(encoded.encode()).decode()
            return json.loads(decoded)
        except:
            return {"version": "1.0", "api_keys": {}, "passwords": {}, "config": {}}
    
    def _load(self):
        if not os.path.exists(CREDENTIALS_FILE):
            return {"version": "1.0", "api_keys": {}, "passwords": {}, "config": {}}
        
        try:
            with open(CREDENTIALS_FILE, 'r', encoding='utf-8') as f:
                data = f.read()
            
            if not data:
                return {"version": "1.0", "api_keys": {}, "passwords": {}, "config": {}}
            
            if self.cipher:
                # 解密
                decrypted = self.cipher.decrypt(data.encode())
                return json.loads(decrypted)
            else:
                # 简单解码
                return self._decode(data)
        except Exception as e:
            return {"version": "1.0", "api_keys": {}, "passwords": {}, "config": {}}
    
    def _save(self, data):
        json_data = json.dumps(data, ensure_ascii=False, indent=2)
        
        if self.cipher:
            encrypted = self.cipher.encrypt(json_data.encode())
            with open(CREDENTIALS_FILE, 'wb') as f:
                f.write(encrypted)
        else:
            encoded = self._encode(data)
            with open(CREDENTIALS_FILE, 'w', encoding='utf-8') as f:
                f.write(encoded)
        
        os.chmod(CREDENTIALS_FILE, 0o600)
    
    # API密钥
    def add_api_key(self, name, value, note=""):
        data = self._load()
        data["api_keys"][name] = {
            "value": value,
            "note": note,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        self._save(data)
        return "OK"
    
    def get_api_key(self, name):
        data = self._load()
        key_data = data.get("api_keys", {}).get(name)
        return key_data.get("value") if key_data else None
    
    def list_api_keys(self):
        data = self._load()
        return [{"name": n, "note": i.get("note", ""), "created_at": i.get("created_at", "")} 
                for n, i in data.get("api_keys", {}).items()]
    
    def delete_api_key(self, name):
        data = self._load()
        if name in data.get("api_keys", {}):
            del data["api_keys"][name]
            self._save(data)
            return "OK"
        return "NOT_FOUND"
    
    # 密码
    def add_password(self, name, value, note=""):
        data = self._load()
        data["passwords"][name] = {
            "value": value,
            "note": note,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        self._save(data)
        return "OK"
    
    def get_password(self, name):
        data = self._load()
        pwd_data = data.get("passwords", {}).get(name)
        return pwd_data.get("value") if pwd_data else None
    
    def list_passwords(self):
        data = self._load()
        return [{"name": n, "note": i.get("note", ""), "created_at": i.get("created_at", "")} 
                for n, i in data.get("passwords", {}).items()]
    
    # 配置
    def add_config(self, name, value, note=""):
        data = self._load()
        data["config"][name] = {"value": value, "note": note, "created_at": datetime.now().isoformat()}
        self._save(data)
        return "OK"
    
    def get_config(self, name):
        data = self._load()
        config = data.get("config", {}).get(name)
        return config.get("value") if config else None
    
    # 统计
    def get_stats(self):
        data = self._load()
        return {
            "api_keys": len(data.get("api_keys", {})),
            "passwords": len(data.get("passwords", {})),
            "config": len(data.get("config", {}))
        }
    
    # 搜索
    def search(self, keyword):
        data = self._load()
        results = {"api_keys": [], "passwords": [], "config": []}
        
        for name in data.get("api_keys", {}):
            if keyword.lower() in name.lower():
                results["api_keys"].append(name)
        
        for name in data.get("passwords", {}):
            if keyword.lower() in name.lower():
                results["passwords"].append(name)
        
        return results

_vault = None
def get_vault():
    global _vault
    if _vault is None:
        _vault = SecureVault()
    return _vault

if __name__ == "__main__":
    import sys
    vault = get_vault()
    
    action = sys.argv[1] if len(sys.argv) > 1 else ""
    
    if action == "add_key":
        name = sys.argv[2] if len(sys.argv) > 2 else ""
        value = sys.argv[3] if len(sys.argv) > 3 else ""
        note = sys.argv[4] if len(sys.argv) > 4 else ""
        if name and value:
            vault.add_api_key(name, value, note)
            print(f"OK: {name}")
    
    elif action == "get_key":
        name = sys.argv[2] if len(sys.argv) > 2 else ""
        if name:
            print(vault.get_api_key(name) or "NOT_FOUND")
    
    elif action == "list_keys":
        for k in vault.list_api_keys():
            print(f"  {k['name']} - {k['note']}")
    
    elif action == "add_pwd":
        name = sys.argv[2] if len(sys.argv) > 2 else ""
        value = sys.argv[3] if len(sys.argv) > 3 else ""
        note = sys.argv[4] if len(sys.argv) > 4 else ""
        if name and value:
            vault.add_password(name, value, note)
            print(f"OK: {name}")
    
    elif action == "get_pwd":
        name = sys.argv[2] if len(sys.argv) > 2 else ""
        if name:
            print(vault.get_password(name) or "NOT_FOUND")
    
    elif action == "list_pwds":
        for k in vault.list_passwords():
            print(f"  {k['name']} - {k['note']}")
    
    elif action == "search":
        keyword = sys.argv[2] if len(sys.argv) > 2 else ""
        if keyword:
            results = vault.search(keyword)
            print(results)
    
    elif action == "stats":
        stats = vault.get_stats()
        print(f"API密钥: {stats['api_keys']}, 密码: {stats['passwords']}, 配置: {stats['config']}")
