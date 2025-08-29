#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试白名单API的返回数据
"""

import requests
import json

# 配置
BASE_URL = "http://localhost:5001"
TOKEN = "your_token_here"  # 请替换为实际的token

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

def test_get_overdue_users(assignment_id):
    """测试获取白名单用户"""
    url = f"{BASE_URL}/assignments/{assignment_id}/overdue-users"
    print(f"GET {url}")
    
    try:
        response = requests.get(url, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        return response.json()
    except Exception as e:
        print(f"Error: {e}")
        return None

def test_add_overdue_user(assignment_id, user_id):
    """测试添加用户到白名单"""
    url = f"{BASE_URL}/assignments/{assignment_id}/overdue-users"
    data = {"user_id": user_id}
    print(f"POST {url}")
    print(f"Data: {data}")
    
    try:
        response = requests.post(url, headers=headers, json=data)
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        return response.json()
    except Exception as e:
        print(f"Error: {e}")
        return None

def test_remove_overdue_user(assignment_id, user_id):
    """测试从白名单移除用户"""
    url = f"{BASE_URL}/assignments/{assignment_id}/overdue-users/{user_id}"
    print(f"DELETE {url}")
    
    try:
        response = requests.delete(url, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        return response.json()
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    print("=== 白名单API测试 ===\n")
    
    # 请替换为实际的作业ID和用户ID
    assignment_id = 1
    user_id = 1
    
    print("1. 获取当前白名单:")
    current_users = test_get_overdue_users(assignment_id)
    
    print("\n2. 添加用户到白名单:")
    add_result = test_add_overdue_user(assignment_id, user_id)
    
    print("\n3. 再次获取白名单:")
    updated_users = test_get_overdue_users(assignment_id)
    
    print("\n4. 从白名单移除用户:")
    remove_result = test_remove_overdue_user(assignment_id, user_id)
    
    print("\n5. 最终白名单:")
    final_users = test_get_overdue_users(assignment_id)
