#!/usr/bin/env python3
"""
补交作业功能测试脚本
测试后端API和数据库功能
"""

import requests
import json
import time
from datetime import datetime, timedelta

# 配置
BASE_URL = "http://localhost:5001"
TEST_USER = {
    "username": "test_teacher",
    "password": "test123"
}

def test_overdue_submission_features():
    """测试补交作业功能"""
    print("🚀 开始测试补交作业功能...")
    
    # 1. 登录获取token
    print("\n1. 测试用户登录...")
    login_response = requests.post(f"{BASE_URL}/login", json=TEST_USER)
    if login_response.status_code != 200:
        print(f"❌ 登录失败: {login_response.status_code}")
        return
    
    token = login_response.json().get('token')
    headers = {'Authorization': f'Bearer {token}'}
    print("✅ 登录成功")
    
    # 2. 获取作业列表
    print("\n2. 测试获取作业列表...")
    assignments_response = requests.get(f"{BASE_URL}/assignments", headers=headers)
    if assignments_response.status_code != 200:
        print(f"❌ 获取作业列表失败: {assignments_response.status_code}")
        return
    
    assignments = assignments_response.json().get('assignments', [])
    if not assignments:
        print("❌ 没有找到作业")
        return
    
    assignment = assignments[0]
    assignment_id = assignment['id']
    print(f"✅ 找到作业: {assignment['name']} (ID: {assignment_id})")
    
    # 3. 测试更新补交设置
    print("\n3. 测试更新补交设置...")
    overdue_settings = {
        "allow_overdue_submission": True,
        "overdue_deadline": (datetime.now() + timedelta(days=7)).isoformat(),
        "overdue_score_ratio": 0.8
    }
    
    settings_response = requests.put(
        f"{BASE_URL}/assignments/{assignment_id}/overdue-settings",
        json=overdue_settings,
        headers=headers
    )
    
    if settings_response.status_code == 200:
        print("✅ 补交设置更新成功")
        updated_assignment = settings_response.json().get('assignment')
        print(f"   允许补交: {updated_assignment.get('allow_overdue_submission')}")
        print(f"   补交截止: {updated_assignment.get('overdue_deadline')}")
        print(f"   得分比例: {updated_assignment.get('overdue_score_ratio')}")
    else:
        print(f"❌ 补交设置更新失败: {settings_response.status_code}")
        print(f"   错误信息: {settings_response.text}")
    
    # 4. 测试获取白名单
    print("\n4. 测试获取白名单...")
    whitelist_response = requests.get(
        f"{BASE_URL}/assignments/{assignment_id}/overdue-users",
        headers=headers
    )
    
    if whitelist_response.status_code == 200:
        whitelist = whitelist_response.json().get('overdue_users', [])
        print(f"✅ 获取白名单成功，当前用户数: {len(whitelist)}")
    else:
        print(f"❌ 获取白名单失败: {whitelist_response.status_code}")
    
    # 5. 测试添加用户到白名单
    print("\n5. 测试添加用户到白名单...")
    add_user_data = {"user_id": 1}  # 假设用户ID为1
    
    add_user_response = requests.post(
        f"{BASE_URL}/assignments/{assignment_id}/overdue-users",
        json=add_user_data,
        headers=headers
    )
    
    if add_user_response.status_code == 200:
        print("✅ 添加用户到白名单成功")
        updated_whitelist = add_user_response.json().get('overdue_users', [])
        print(f"   白名单用户数: {len(updated_whitelist)}")
    else:
        print(f"❌ 添加用户到白名单失败: {add_user_response.status_code}")
        print(f"   错误信息: {add_user_response.text}")
    
    # 6. 测试检查补交权限
    print("\n6. 测试检查补交权限...")
    # 创建一个学生用户来测试
    student_data = {
        "username": "test_student",
        "password": "test123",
        "name": "测试学生",
        "email": "student@test.com",
        "role": "student"
    }
    
    # 先尝试注册学生（如果已存在会失败，但不影响测试）
    register_response = requests.post(f"{BASE_URL}/register", json=student_data)
    
    # 学生登录
    student_login = requests.post(f"{BASE_URL}/login", json={
        "username": "test_student",
        "password": "test123"
    })
    
    if student_login.status_code == 200:
        student_token = student_login.json().get('token')
        student_headers = {'Authorization': f'Bearer {student_token}'}
        
        # 检查补交权限
        permission_response = requests.get(
            f"{BASE_URL}/assignments/{assignment_id}/can-overdue-submit",
            headers=student_headers
        )
        
        if permission_response.status_code == 200:
            permission_data = permission_response.json()
            print("✅ 检查补交权限成功")
            print(f"   可以补交: {permission_data.get('can_overdue')}")
            print(f"   原因: {permission_data.get('reason', 'N/A')}")
            if permission_data.get('can_overdue'):
                print(f"   补交截止: {permission_data.get('overdue_deadline')}")
                print(f"   得分比例: {permission_data.get('score_ratio')}")
        else:
            print(f"❌ 检查补交权限失败: {permission_response.status_code}")
    else:
        print("⚠️  无法创建测试学生，跳过权限检查测试")
    
    print("\n🎉 补交作业功能测试完成！")

if __name__ == "__main__":
    try:
        test_overdue_submission_features()
    except Exception as e:
        print(f"❌ 测试过程中发生错误: {e}")
        import traceback
        traceback.print_exc()
