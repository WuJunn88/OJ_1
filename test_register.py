#!/usr/bin/env python3
"""
测试用户注册功能
"""
import requests
import json

def test_register():
    url = "http://localhost:5000/auth/register"
    data = {
        "username": "test_user_" + str(int(__import__('time').time())),
        "password": "123456",
        "name": "测试用户",
        "role": "student"
    }
    
    print(f"测试注册API: {url}")
    print(f"请求数据: {json.dumps(data, ensure_ascii=False, indent=2)}")
    
    try:
        response = requests.post(url, json=data, timeout=10)
        print(f"响应状态码: {response.status_code}")
        print(f"响应头: {dict(response.headers)}")
        
        if response.text:
            print(f"响应内容: {response.text}")
            try:
                json_response = response.json()
                print(f"JSON响应: {json.dumps(json_response, ensure_ascii=False, indent=2)}")
            except:
                print("响应不是有效的JSON格式")
        else:
            print("响应内容为空")
            
    except requests.exceptions.ConnectionError:
        print("❌ 连接失败：后端服务器可能没有运行")
    except requests.exceptions.Timeout:
        print("❌ 请求超时")
    except Exception as e:
        print(f"❌ 请求异常: {e}")

def test_basic_api():
    """测试基本API连接"""
    url = "http://localhost:5000/problems"
    print(f"\n测试基本API: {url}")
    
    try:
        response = requests.get(url, timeout=5)
        print(f"基本API响应状态码: {response.status_code}")
        if response.text:
            print(f"基本API响应长度: {len(response.text)} 字符")
        else:
            print("基本API响应为空")
    except Exception as e:
        print(f"基本API测试失败: {e}")

if __name__ == "__main__":
    print("🧪 开始测试用户注册功能...\n")
    test_basic_api()
    print("\n" + "="*50)
    test_register()
