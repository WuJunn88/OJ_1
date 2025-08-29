#!/usr/bin/env python3
"""
测试判题服务的Java功能
"""

import requests
import json
import time

def test_java_submission():
    """测试Java代码提交"""
    print("🧪 测试判题服务的Java功能...")
    print("=" * 50)
    
    # 首先需要登录获取token
    print("🔐 登录获取token...")
    login_data = {
        "username": "teacher1",  # 替换为实际的用户名
        "password": "password123"  # 替换为实际的密码
    }
    
    try:
        login_response = requests.post(
            "http://localhost:5001/auth/login",
            json=login_data,
            timeout=10
        )
        
        if login_response.status_code != 200:
            print(f"❌ 登录失败: {login_response.status_code}")
            return False
        
        token = login_response.json().get('token')
        if not token:
            print("❌ 登录成功但未获取到token")
            return False
        
        print("✅ 登录成功，获取到token")
        
    except Exception as e:
        print(f"❌ 登录异常: {e}")
        return False
    
    # 测试数据 - 使用一个简单的Java题目ID
    test_data = {
        "problem_id": 1,  # 替换为实际的Java题目ID
        "code": """
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Java!");
    }
}
""",
        "language": "java"
    }
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        # 发送代码提交请求
        print("📤 提交Java代码...")
        response = requests.post(
            "http://localhost:5001/submit",
            json=test_data,
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 202:
            result = response.json()
            submission_id = result.get('submission_id')
            print(f"✅ 代码提交成功，提交ID: {submission_id}")
            print(f"   状态: {result.get('status')}")
            print(f"   消息: {result.get('message')}")
            
            # 等待判题结果
            print("\n⏳ 等待判题结果...")
            for i in range(10):  # 最多等待10次
                time.sleep(2)
                
                result_response = requests.get(
                    f"http://localhost:5001/result/{submission_id}",
                    headers=headers,
                    timeout=10
                )
                
                if result_response.status_code == 200:
                    submission_result = result_response.json()
                    status = submission_result.get('status')
                    
                    if status != 'pending':
                        print(f"✅ 判题完成，状态: {status}")
                        print(f"   结果: {submission_result.get('result', 'N/A')}")
                        print(f"   执行时间: {submission_result.get('execution_time', 'N/A')}ms")
                        
                        if status == 'accepted':
                            print("🎉 Java代码执行成功！")
                            return True
                        else:
                            print(f"❌ 代码执行失败: {status}")
                            return False
                    else:
                        print(f"   ⏳ 仍在判题中... ({i+1}/10)")
                else:
                    print(f"   ❌ 获取结果失败: {result_response.status_code}")
            
            print("❌ 判题超时")
            return False
            
        else:
            print(f"❌ 代码提交失败: {response.status_code}")
            print(f"   错误信息: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到主服务，请确保服务正在运行")
        return False
    except requests.exceptions.Timeout:
        print("❌ 请求超时")
        return False
    except Exception as e:
        print(f"❌ 测试异常: {e}")
        return False

def main():
    """主测试函数"""
    print("🚀 开始测试判题服务的Java功能")
    print("请确保主服务正在运行在端口5001")
    print("请确保判题工作进程正在运行")
    print()
    
    # 等待一下让服务完全启动
    time.sleep(2)
    
    # 测试Java代码提交
    success = test_java_submission()
    
    print("\n" + "=" * 50)
    if success:
        print("🎉 Java测试通过了！判题服务现在可以正常处理Java代码")
    else:
        print("❌ 测试失败，请检查服务配置")
    
    print("\n💡 如果测试失败，请检查：")
    print("   1. 主服务是否正在运行在端口5001")
    print("   2. 判题工作进程是否正在运行")
    print("   3. RabbitMQ是否正在运行")
    print("   4. Java环境是否正确配置")
    print("   5. 是否有可用的Java题目")

if __name__ == "__main__":
    main()
