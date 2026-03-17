#!/usr/bin/env python3
"""Test Supabase configuration and connectivity"""
import os
import sys
import requests
from pathlib import Path

# Load .env
env_file = Path(__file__).parent.parent / "fastapi_app" / ".env"
if env_file.exists():
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ[key] = value

url = os.getenv("SUPABASE_URL")
anon_key = os.getenv("SUPABASE_ANON_KEY")

print(f"SUPABASE_URL: {url}")
print(f"SUPABASE_ANON_KEY: {anon_key[:20]}..." if anon_key else "None")
print()

if not url or not anon_key:
    print("❌ Supabase 配置缺失")
    sys.exit(1)

# Test health endpoint
print("测试 /health 端点...")
try:
    r = requests.get(f"{url}/health", timeout=5)
    print(f"✓ /health 返回: {r.status_code}")
    if r.status_code == 200:
        print(f"  响应: {r.text[:100]}")
except Exception as e:
    print(f"✗ /health 失败: {e}")

# Test auth endpoint
print("\n测试 auth 端点...")
try:
    r = requests.get(
        f"{url}/auth/v1/health",
        headers={"apikey": anon_key},
        timeout=5
    )
    print(f"✓ /auth/v1/health 返回: {r.status_code}")
    if r.status_code == 200:
        print(f"  响应: {r.text[:100]}")
except Exception as e:
    print(f"✗ /auth/v1/health 失败: {e}")

# Test Python client
print("\n测试 Python 客户端...")
try:
    from supabase import create_client
    client = create_client(url, anon_key)
    print(f"✓ 客户端创建成功: {type(client)}")
    print(f"  Auth 客户端: {type(client.auth)}")
except Exception as e:
    print(f"✗ 客户端创建失败: {e}")

# Test actual login
print("\n测试实际登录调用...")
test_email = input("输入测试邮箱 (或按回车跳过): ").strip()
if test_email:
    test_password = input("输入测试密码: ").strip()
    try:
        from supabase import create_client
        client = create_client(url, anon_key)
        print(f"\n调用 sign_in_with_password...")
        result = client.auth.sign_in_with_password({
            "email": test_email,
            "password": test_password
        })
        print(f"✓ 登录成功!")
        print(f"  Session: {result.session is not None}")
        print(f"  User: {result.user.email if result.user else None}")
    except Exception as e:
        print(f"✗ 登录失败: {type(e).__name__}")
        print(f"  错误信息: {e}")
        import traceback
        print("\n完整错误堆栈:")
        traceback.print_exc()
