#!/usr/bin/env python3
"""
测试教师权限修改是否生效
验证教师是否可以编辑所有题目（包括导入的题目）
"""

import requests
import json

# 配置
BASE_URL = "http://localhost:5001"
TEACHER_TOKEN = None  # 需要先登录获取

def login_teacher():
    """教师登录获取token"""
    global TEACHER_TOKEN
    
    login_data = {
        "username": "teacher1",  # 替换为实际的教师用户名
        "password": "password123"  # 替换为实际的教师密码
    }
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
        if response.status_code == 200:
            data = response.json()
            TEACHER_TOKEN = data.get('token')
            print(f"✅ 教师登录成功，获取到token: {TEACHER_TOKEN[:20]}...")
            return True
        else:
            print(f"❌ 教师登录失败: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ 登录请求异常: {e}")
        return False

def get_problems():
    """获取题目列表"""
    headers = {"Authorization": f"Bearer {TEACHER_TOKEN}"} if TEACHER_TOKEN else {}
    
    try:
        response = requests.get(f"{BASE_URL}/problems?page=1&per_page=5", headers=headers)
        if response.status_code == 200:
            data = response.json()
            problems = data.get('problems', [])
            print(f"✅ 获取到 {len(problems)} 个题目")
            
            # 显示前几个题目的信息
            for i, problem in enumerate(problems[:3]):
                print(f"  题目 {i+1}: ID={problem['id']}, 标题='{problem['title']}', 创建者={problem.get('created_by', 'N/A')}")
            
            return problems
        else:
            print(f"❌ 获取题目失败: {response.status_code} - {response.text}")
            return []
    except Exception as e:
        print(f"❌ 获取题目请求异常: {e}")
        return []

def test_edit_imported_problem(problem_id):
    """测试编辑导入的题目（非自己创建的题目）"""
    if not TEACHER_TOKEN:
        print("❌ 未登录，无法测试")
        return False
    
    headers = {"Authorization": f"Bearer {TEACHER_TOKEN}"}
    
    # 尝试更新题目描述
    update_data = {
        "description": "这是教师修改后的题目描述 - 测试权限修改是否生效"
    }
    
    try:
        response = requests.put(f"{BASE_URL}/problems/{problem_id}", 
                              json=update_data, 
                              headers=headers)
        
        if response.status_code == 200:
            print(f"✅ 成功编辑题目 {problem_id}！权限修改生效")
            data = response.json()
            print(f"   更新后的描述: {data['problem']['description']}")
            return True
        else:
            print(f"❌ 编辑题目 {problem_id} 失败: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ 编辑题目请求异常: {e}")
        return False

def test_delete_imported_problem(problem_id):
    """测试删除导入的题目（非自己创建的题目）"""
    if not TEACHER_TOKEN:
        print("❌ 未登录，无法测试")
        return False
    
    headers = {"Authorization": f"Bearer {TEACHER_TOKEN}"}
    
    try:
        response = requests.delete(f"{BASE_URL}/problems/{problem_id}", headers=headers)
        
        if response.status_code == 200:
            print(f"✅ 成功删除题目 {problem_id}！权限修改生效")
            return True
        else:
            print(f"❌ 删除题目 {problem_id} 失败: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ 删除题目请求异常: {e}")
        return False

def main():
    """主测试流程"""
    print("🔍 开始测试教师权限修改...")
    print("=" * 50)
    
    # 1. 教师登录
    if not login_teacher():
        print("❌ 无法继续测试，教师登录失败")
        return
    
    print()
    
    # 2. 获取题目列表
    problems = get_problems()
    if not problems:
        print("❌ 无法继续测试，没有获取到题目")
        return
    
    print()
    
    # 3. 测试编辑第一个题目
    first_problem = problems[0]
    print(f"🧪 测试编辑题目: {first_problem['id']} - {first_problem['title']}")
    edit_success = test_edit_imported_problem(first_problem['id'])
    
    print()
    
    # 4. 测试删除第二个题目（如果编辑成功的话）
    if len(problems) > 1 and edit_success:
        second_problem = problems[1]
        print(f"🧪 测试删除题目: {second_problem['id']} - {second_problem['title']}")
        delete_success = test_delete_imported_problem(second_problem['id'])
        
        if delete_success:
            print()
            print("🔄 测试删除成功，现在恢复题目...")
            # 恢复被删除的题目
            restore_success = test_restore_problem(second_problem['id'])
            if restore_success:
                print("✅ 题目恢复成功")
            else:
                print("❌ 题目恢复失败")
    
    print()
    print("=" * 50)
    if edit_success:
        print("🎉 权限修改测试完成！教师现在可以编辑所有题目了")
    else:
        print("❌ 权限修改测试失败，请检查后端代码")

def test_restore_problem(problem_id):
    """测试恢复被删除的题目"""
    if not TEACHER_TOKEN:
        return False
    
    headers = {"Authorization": f"Bearer {TEACHER_TOKEN}"}
    
    try:
        response = requests.post(f"{BASE_URL}/problems/{problem_id}/restore", headers=headers)
        return response.status_code == 200
    except:
        return False

if __name__ == "__main__":
    main()
