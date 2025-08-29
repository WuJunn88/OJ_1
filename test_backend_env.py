#!/usr/bin/env python3
"""
测试后端环境变量读取
"""

import os
import sys

def test_backend_environment():
    """测试后端环境变量读取"""
    print("🔍 测试后端环境变量读取...")
    
    # 模拟后端代码的环境变量读取
    deepseek_api_key = os.getenv('DEEPSEEK_API_KEY', 'your-deepseek-api-key-here')
    deepseek_api_base = os.getenv('DEEPSEEK_API_BASE', 'https://api.deepseek.com/v1')
    
    print(f"📝 DEEPSEEK_API_KEY: {deepseek_api_key}")
    print(f"📝 DEEPSEEK_API_BASE: {deepseek_api_base}")
    
    # 检查是否是默认值
    if deepseek_api_key == 'your-deepseek-api-key-here':
        print("❌ 环境变量读取失败，使用的是默认值")
        return False
    else:
        print("✅ 环境变量读取成功")
        return True

def check_environment_source():
    """检查环境变量来源"""
    print("\n🔍 检查环境变量来源...")
    
    # 检查常见的环境变量文件
    env_files = [
        '~/.zshrc',
        '~/.bash_profile', 
        '~/.bashrc',
        '~/.profile'
    ]
    
    for env_file in env_files:
        expanded_path = os.path.expanduser(env_file)
        if os.path.exists(expanded_path):
            print(f"📁 检查文件: {expanded_path}")
            
            try:
                with open(expanded_path, 'r') as f:
                    content = f.read()
                    if 'DEEPSEEK_API_KEY' in content:
                        print(f"   ✅ 找到 DEEPSEEK_API_KEY 设置")
                        # 显示相关行
                        lines = content.split('\n')
                        for i, line in enumerate(lines):
                            if 'DEEPSEEK_API_KEY' in line:
                                print(f"      第{i+1}行: {line.strip()}")
                    else:
                        print(f"   ❌ 未找到 DEEPSEEK_API_KEY 设置")
            except Exception as e:
                print(f"   ❌ 读取文件失败: {e}")
        else:
            print(f"📁 文件不存在: {expanded_path}")

def main():
    print("=" * 60)
    print("后端环境变量测试工具")
    print("=" * 60)
    
    # 测试环境变量读取
    env_success = test_backend_environment()
    
    # 检查环境变量来源
    check_environment_source()
    
    print("\n" + "=" * 60)
    if env_success:
        print("🎯 环境变量读取成功")
        print("💡 如果后端仍然无法使用，请重启后端服务")
    else:
        print("❌ 环境变量读取失败")
        print("🔧 请检查环境变量设置")
    print("=" * 60)

if __name__ == "__main__":
    main()
