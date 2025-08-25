#!/usr/bin/env python3
"""
简单的AI生题功能测试
"""
import requests
import os

# 直接调用DeepSeek API测试
def test_deepseek_direct():
    print("🤖 直接测试DeepSeek API...")
    
    url = "https://api.deepseek.com/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {os.getenv('DEEPSEEK_API_KEY')}"
    }
    
    data = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": "你是一个专业的编程题目生成助手"},
            {"role": "user", "content": "请生成一个简单的数组排序题目，格式如下：\n题目名称：[名称]\n题目描述：[描述]\n测试用例：[用例]\n预期输出：[输出]\n难度：[难度]"}
        ],
        "max_tokens": 500,
        "temperature": 0.7
    }
    
    try:
        response = requests.post(url, json=data, headers=headers, timeout=30)
        if response.status_code == 200:
            result = response.json()
            content = result['choices'][0]['message']['content']
            print("✅ DeepSeek API调用成功!")
            print("生成的内容:")
            print("-" * 50)
            print(content)
            print("-" * 50)
            return True
        else:
            print(f"❌ API调用失败: {response.status_code}")
            print(response.text)
            return False
    except Exception as e:
        print(f"❌ 请求异常: {e}")
        return False

# 测试Flask应用的AI功能（使用内部调用）
def test_flask_ai_function():
    print("\n🔧 测试Flask应用内部AI调用...")
    
    # 这里我们需要导入Flask应用的函数来测试
    import sys
    sys.path.append('/Volumes/坞城/Judger_1/backend/main-service')
    
    try:
        from app import call_ai_model, generate_problem_prompt
        
        # 测试生成提示词
        requirements = "生成一个关于字符串反转的简单题目"
        prompt = generate_problem_prompt(requirements)
        print(f"生成的提示词: {prompt[:100]}...")
        
        # 测试AI调用
        response = call_ai_model(prompt, max_tokens=500)
        print("✅ Flask内部AI调用成功!")
        print("生成的内容:")
        print("-" * 50)
        print(response)
        print("-" * 50)
        return True
        
    except Exception as e:
        print(f"❌ Flask内部调用失败: {e}")
        return False

def main():
    print("🚀 开始AI功能测试...\n")
    
    # 检查API密钥
    api_key = os.getenv('DEEPSEEK_API_KEY')
    if not api_key:
        print("❌ 请设置DEEPSEEK_API_KEY环境变量")
        return
    
    print(f"API密钥: {api_key[:10]}...{api_key[-4:]}")
    
    # 测试1: 直接调用DeepSeek API
    success1 = test_deepseek_direct()
    
    # 测试2: Flask应用内部调用
    success2 = test_flask_ai_function()
    
    if success1 and success2:
        print("\n🎉 所有测试通过！AI智能生题功能正常工作！")
    else:
        print("\n⚠️ 部分测试失败，请检查配置")

if __name__ == "__main__":
    main()
