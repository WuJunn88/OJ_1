#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试AI智能选题功能
"""

import requests
import json
import os

# 配置
BASE_URL = "http://localhost:5000"
TEST_TOKEN = "your-test-token-here"  # 需要替换为实际的测试token

def test_ai_problem_selection():
    """测试AI智能选题功能"""
    print("🧪 开始测试AI智能选题功能...")
    
    # 测试数据
    test_data = {
        "requirements": "需要3道关于数组和循环的题目，难度从简单到困难，适合大一学生",
        "course_id": 1,
        "problem_count": 3
    }
    
    try:
        # 调用AI选题API
        print(f"📡 调用AI选题API: {BASE_URL}/ai/select-problems")
        response = requests.post(
            f"{BASE_URL}/ai/select-problems",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {TEST_TOKEN}"
            },
            json=test_data,
            timeout=60
        )
        
        print(f"📊 响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ AI选题成功!")
            print(f"📝 返回结果: {json.dumps(result, ensure_ascii=False, indent=2)}")
            
            # 验证返回结果
            if 'selected_problems' in result and len(result['selected_problems']) > 0:
                print(f"🎯 成功选择 {len(result['selected_problems'])} 道题目")
                
                # 测试预览功能
                test_preview(result['selected_problems'])
            else:
                print("❌ 返回结果中没有选中的题目")
                
        else:
            print(f"❌ AI选题失败: {response.status_code}")
            print(f"错误信息: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ 请求异常: {e}")
    except Exception as e:
        print(f"❌ 测试异常: {e}")

def test_preview(selected_problems):
    """测试预览功能"""
    print("\n👁️ 测试预览功能...")
    
    try:
        preview_data = {
            "selected_problem_ids": [p['problem_id'] for p in selected_problems]
        }
        
        response = requests.post(
            f"{BASE_URL}/ai/select-problems/preview",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {TEST_TOKEN}"
            },
            json=preview_data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ 预览功能正常!")
            print(f"📋 预览结果: {json.dumps(result, ensure_ascii=False, indent=2)}")
        else:
            print(f"❌ 预览功能失败: {response.status_code}")
            print(f"错误信息: {response.text}")
            
    except Exception as e:
        print(f"❌ 预览测试异常: {e}")

def test_without_auth():
    """测试无权限访问"""
    print("\n🔒 测试无权限访问...")
    
    try:
        response = requests.post(
            f"{BASE_URL}/ai/select-problems",
            headers={"Content-Type": "application/json"},
            json={"requirements": "test", "course_id": 1, "problem_count": 1},
            timeout=30
        )
        
        if response.status_code == 401:
            print("✅ 权限验证正常，无token访问被拒绝")
        else:
            print(f"⚠️ 权限验证异常，状态码: {response.status_code}")
            
    except Exception as e:
        print(f"❌ 权限测试异常: {e}")

def main():
    """主函数"""
    print("🚀 AI智能选题功能测试")
    print("=" * 50)
    
    # 检查环境变量
    if 'DEEPSEEK_API_KEY' not in os.environ:
        print("⚠️ 警告: 未设置DEEPSEEK_API_KEY环境变量")
        print("请设置环境变量: export DEEPSEEK_API_KEY='your-api-key'")
    
    # 运行测试
    test_without_auth()
    test_ai_problem_selection()
    
    print("\n" + "=" * 50)
    print("🏁 测试完成")

if __name__ == "__main__":
    main()
