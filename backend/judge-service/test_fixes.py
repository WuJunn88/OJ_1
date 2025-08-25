#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试修复后的判题功能
"""

import sys
sys.path.append('..')

from judge import judge_choice_problem, calculate_answer_similarity

# 模拟类
class MockProblem:
    def __init__(self, expected_output):
        self.expected_output = expected_output
        self.type = 'choice'

class MockSubmission:
    def __init__(self, code):
        self.code = code
        self.status = 'pending'
        self.result = ''
        self.execution_time = 0.0

class MockSession:
    def commit(self):
        pass

def test_choice_problem():
    """测试选择题判题"""
    print("=== 测试选择题判题 ===")
    
    # 测试多选题顺序不敏感
    problem = MockProblem('A,B')
    submission = MockSubmission('B,A')
    session = MockSession()
    
    judge_choice_problem(submission, problem, session)
    print(f"多选题 B,A vs A,B: {submission.status}")
    
    # 测试单选题
    problem = MockProblem('A')
    submission = MockSubmission('a')
    session = MockSession()
    
    judge_choice_problem(submission, problem, session)
    print(f"单选题 a vs A: {submission.status}")

def test_similarity():
    """测试相似度计算"""
    print("\n=== 测试相似度计算 ===")
    
    # 测试部分匹配
    similarity = calculate_answer_similarity('Python是编程语言', 'Python是一种编程语言')
    print(f"部分匹配相似度: {similarity:.3f}")
    
    # 测试完全不匹配
    similarity = calculate_answer_similarity('Java是编程语言', 'Python是一种编程语言')
    print(f"完全不匹配相似度: {similarity:.3f}")
    
    # 测试中文文本
    similarity = calculate_answer_similarity('编程语言Python', 'Python是一种编程语言')
    print(f"中文文本相似度: {similarity:.3f}")

if __name__ == "__main__":
    test_choice_problem()
    test_similarity()
    print("\n测试完成！")
