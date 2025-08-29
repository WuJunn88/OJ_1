#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys

# Ensure judge-service package path
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend', 'judge-service'))

from special_judge import SpecialJudgeEngine

def test_float():
    engine = SpecialJudgeEngine()
    result, message, score = engine.judge(
        user_output="3.141590 2.718280",
        expected_output="3.141592 2.718281",
        input_data="",
        judge_config={'type': 'float', 'epsilon': 1e-3, 'relative_error': 1e-6}
    )
    print(f"[FLOAT] {result} | {message} | score={score}")


def test_multiple_solutions():
    engine = SpecialJudgeEngine()
    result, message, score = engine.judge(
        user_output="8 5 2",
        expected_output="2 5 8",
        input_data="",
        judge_config={'type': 'multiple_solutions', 'solutions': ['2 5 8', '8 5 2']}
    )
    print(f"[MULTI] {result} | {message} | score={score}")


if __name__ == '__main__':
    test_float()
    test_multiple_solutions()
