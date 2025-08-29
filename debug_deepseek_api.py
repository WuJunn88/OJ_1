#!/usr/bin/env python3
"""
测试DeepSeek API连接和环境变量设置
"""

import os
import requests
import json

def test_deepseek_api():
    """测试DeepSeek API连接"""
    print("🔍 测试DeepSeek API连接...")
    
    # 1. 检查环境变量
    print("\n1️⃣ 检查环境变量...")
    api_key = os.getenv('DEEPSEEK_API_KEY')
    api_base = os.getenv('DEEPSEEK_API_BASE', 'https://api.deepseek.com/v1')
    
    print(f"   DEEPSEEK_API_KEY: {'已设置' if api_key else '未设置'}")
    if api_key:
        print(f"   API密钥前10位: {api_key[:10]}...")
        print(f"   API密钥长度: {len(api_key)}")
    print(f"   DEEPSEEK_API_BASE: {api_base}")
    
    if not api_key:
        print("❌ DEEPSEEK_API_KEY环境变量未设置")
        print("   请检查~/.zshrc文件并重新加载: source ~/.zshrc")
        return False
    
    # 2. 测试API连接
    print("\n2️⃣ 测试DeepSeek API连接...")
    
    # 简单的测试请求
    test_prompt = "你好，请简单回复'测试成功'"
    
    try:
        url = f"{api_base}/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        
        data = {
            "model": "deepseek-chat",
            "messages": [
                {"role": "user", "content": test_prompt}
            ],
            "max_tokens": 100,
            "temperature": 0.7
        }
        
        print(f"📡 发送请求到: {url}")
        print(f"🔑 使用API密钥: {api_key[:10]}...")
        
        response = requests.post(url, headers=headers, json=data, timeout=30)
        
        print(f"📊 响应状态码: {response.status_code}")
        print(f"📄 响应头: {dict(response.headers)}")
        
        if response.status_code == 200:
            result = response.json()
            ai_response = result['choices'][0]['message']['content']
            print("✅ DeepSeek API连接成功!")
            print(f"🤖 AI回复: {ai_response}")
            return True
        else:
            print(f"❌ API请求失败: {response.status_code}")
            print(f"错误信息: {response.text}")
            
            # 分析常见错误
            if "401" in str(response.status_code):
                print("🔑 认证失败 - 请检查API密钥是否正确")
            elif "403" in str(response.status_code):
                print("🚫 权限不足 - 请检查API密钥权限")
            elif "429" in str(response.status_code):
                print("⏰ 请求频率限制 - 请稍后重试")
            elif "500" in str(response.status_code):
                print("🔧 服务器内部错误 - 请稍后重试")
            
            return False
            
    except requests.exceptions.ConnectionError as e:
        print(f"❌ 连接错误: {e}")
        print("   请检查网络连接和API端点URL")
        return False
    except requests.exceptions.Timeout as e:
        print(f"❌ 请求超时: {e}")
        print("   网络连接较慢，请稍后重试")
        return False
    except Exception as e:
        print(f"❌ 其他错误: {e}")
        return False

def check_backend_environment():
    """检查后端环境变量"""
    print("\n3️⃣ 检查后端环境变量...")
    print("   请在后端控制台中运行以下命令:")
    print("   python3 -c \"import os; print('DEEPSEEK_API_KEY:', os.getenv('DEEPSEEK_API_KEY', '未设置')); print('DEEPSEEK_API_BASE:', os.getenv('DEEPSEEK_API_BASE', '未设置'))\"")
    
    print("\n   或者在Python中检查:")
    print("   >>> import os")
    print("   >>> print(os.getenv('DEEPSEEK_API_KEY'))")
    print("   >>> print(os.getenv('DEEPSEEK_API_BASE'))")

def main():
    print("=" * 60)
    print("DeepSeek API连接测试工具")
    print("=" * 60)
    
    # 测试API连接
    api_success = test_deepseek_api()
    
    # 检查后端环境
    check_backend_environment()
    
    print("\n" + "=" * 60)
    if api_success:
        print("🎯 API连接测试成功")
        print("💡 如果AI选题仍然失败，请检查后端环境变量")
    else:
        print("❌ API连接测试失败")
        print("🔧 请根据错误信息修复问题")
    print("=" * 60)

if __name__ == "__main__":
    main()
