#!/usr/bin/env python3
"""
直接测试后端API的作业完成状态功能
"""

import requests
import json

def test_api_directly():
    """直接测试后端API"""
    print("=== 直接测试后端API ===")
    
    # 后端服务地址
    base_url = "http://localhost:5001"
    
    # 1. 先尝试登录用户4（FJ）
    print("\n1. 尝试登录用户4（FJ）...")
    login_data = {
        "username": "2405030115",
        "password": "1"
    }
    
    try:
        login_response = requests.post(f"{base_url}/auth/login", json=login_data)
        print(f"登录响应状态码: {login_response.status_code}")
        
        if login_response.status_code == 200:
            login_result = login_response.json()
            print(f"登录成功: {login_result}")
            
            # 获取token
            token = login_result.get('token')
            if token:
                print(f"获取到token: {token[:20]}...")
                
                # 2. 使用token调用作业完成状态API
                print("\n2. 调用作业完成状态API...")
                headers = {
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                }
                
                # 测试课程ID=1的作业完成状态
                completion_response = requests.get(
                    f"{base_url}/assignments/completion-status?course_id=1",
                    headers=headers
                )
                
                print(f"作业完成状态API响应状态码: {completion_response.status_code}")
                print(f"响应内容: {completion_response.text}")
                
                if completion_response.status_code == 200:
                    completion_result = completion_response.json()
                    print(f"\n作业完成状态结果:")
                    print(json.dumps(completion_result, indent=2, ensure_ascii=False))
                    
                    # 分析结果
                    assignments = completion_result.get('assignments', [])
                    for assignment in assignments:
                        name = assignment.get('name', 'Unknown')
                        completion_status = assignment.get('completion_status', {})
                        total = completion_status.get('total_problems', 0)
                        completed = completion_status.get('completed_problems', 0)
                        percentage = completion_status.get('completion_percentage', 0)
                        is_completed = completion_status.get('is_completed', False)
                        status_text = completion_status.get('status_text', 'Unknown')
                        
                        print(f"\n作业: {name}")
                        print(f"  总题目数: {total}")
                        print(f"  已完成: {completed}")
                        print(f"  完成率: {percentage}%")
                        print(f"  是否完成: {is_completed}")
                        print(f"  状态文本: {status_text}")
                else:
                    print(f"API调用失败: {completion_response.text}")
                    
            else:
                print("登录成功但没有获取到token")
        else:
            print(f"登录失败: {login_response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"请求异常: {e}")
    except Exception as e:
        print(f"其他异常: {e}")

def test_without_auth():
    """测试无认证的情况"""
    print("\n=== 测试无认证的情况 ===")
    
    base_url = "http://localhost:5001"
    
    try:
        response = requests.get(f"{base_url}/assignments/completion-status?course_id=1")
        print(f"无认证调用响应状态码: {response.status_code}")
        print(f"响应内容: {response.text}")
    except Exception as e:
        print(f"无认证测试异常: {e}")

if __name__ == "__main__":
    test_api_directly()
    test_without_auth()
