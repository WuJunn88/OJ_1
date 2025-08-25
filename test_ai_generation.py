#!/usr/bin/env python3
"""
测试AI智能生题功能的脚本
"""
import requests
import json
import sys

BASE_URL = "http://localhost:5000"

def register_teacher():
    """注册教师账户"""
    data = {
        "username": "ai_test_teacher",
        "password": "test123",
        "name": "AI测试教师",
        "role": "teacher"
    }
    response = requests.post(f"{BASE_URL}/auth/register", json=data)
    print(f"注册结果: {response.status_code}")
    return response.status_code == 201

def login_teacher():
    """教师登录获取token"""
    data = {
        "username": "ai_test_teacher",
        "password": "test123"
    }
    response = requests.post(f"{BASE_URL}/auth/login", json=data)
    if response.status_code == 200:
        token = response.json().get('token')
        print(f"✅ 登录成功，获取到token")
        return token
    else:
        print(f"❌ 登录失败: {response.status_code}")
        print(response.text)
        return None

def test_ai_generation(token):
    """测试AI生题功能"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # 测试AI生成题目
    print("\n🤖 测试AI生成题目...")
    data = {
        "requirements": "生成一个关于数组排序的简单题目，适合初学者"
    }
    
    response = requests.post(f"{BASE_URL}/problems/ai-generate", json=data, headers=headers)
    print(f"AI生成状态码: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print("✅ AI生成成功!")
        print(f"题目标题: {result['problem']['title']}")
        print(f"题目描述: {result['problem']['description'][:100]}...")
        return result['problem']
    else:
        print(f"❌ AI生成失败: {response.text}")
        return None

def test_ai_validation(token, problem_data):
    """测试AI验证功能"""
    if not problem_data:
        return
        
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print("\n🔍 测试AI验证和创建题目...")
    response = requests.post(f"{BASE_URL}/problems/ai-validate", json=problem_data, headers=headers)
    print(f"AI验证状态码: {response.status_code}")
    
    if response.status_code == 201:
        result = response.json()
        print("✅ 题目创建成功!")
        print(f"题目ID: {result['problem']['id']}")
        print(f"验证结果: {result['validation_result'][:100]}...")
    else:
        print(f"❌ 验证失败: {response.text}")

def main():
    print("🚀 开始测试AI智能生题功能...\n")
    
    # 1. 注册教师
    print("👤 注册教师账户...")
    register_teacher()  # 可能已存在，忽略错误
    
    # 2. 登录获取token
    print("🔑 教师登录...")
    token = login_teacher()
    if not token:
        print("❌ 无法获取token，测试终止")
        sys.exit(1)
    
    # 3. 测试AI生成
    problem_data = test_ai_generation(token)
    
    # 4. 测试AI验证和创建
    test_ai_validation(token, problem_data)
    
    print("\n🎉 测试完成!")

if __name__ == "__main__":
    main()
