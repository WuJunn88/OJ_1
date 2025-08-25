# 简化的判题服务，不依赖RabbitMQ，直接轮询数据库中的pending提交
import sys
import os
import json
import time
from sandbox import run_code
from database import Session

# 将 backend 目录加入 sys.path，确保可以导入 shared.models
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_root = os.path.dirname(current_dir)
if backend_root not in sys.path:
    sys.path.append(backend_root)

# 从共享模型导入
from shared.models import Problem, Submission

def process_pending_submissions():
    """处理所有pending状态的提交"""
    session = Session()
    
    try:
        # 查找所有pending状态的提交
        pending_submissions = session.query(Submission).filter_by(status='pending').all()
        
        if not pending_submissions:
            return 0
        
        print(f"[*] 发现 {len(pending_submissions)} 个待处理的提交")
        
        for submission in pending_submissions:
            try:
                print(f"[*] 开始处理提交 {submission.id}")
                
                # 更新状态为判题中
                submission.status = 'judging'
                session.commit()
                
                # 获取题目信息
                problem = session.query(Problem).get(submission.problem_id)
                if not problem:
                    submission.status = 'error'
                    submission.result = 'Problem not found'
                    session.commit()
                    print(f"[!] 提交 {submission.id}: 题目不存在")
                    continue
                
                print(f"[*] 开始执行代码，语言: {submission.language}")
                
                # 执行代码
                start_time = time.time()
                output, error = run_code(
                    code=submission.code,
                    language=submission.language,
                    input_data=problem.test_cases,
                    time_limit_ms=problem.time_limit,
                    memory_limit_mb=problem.memory_limit
                )
                execution_time = time.time() - start_time
                
                print(f"[*] 代码执行完成，耗时: {execution_time:.3f}s")
                print(f"[*] 输出: {output[:100]}...")
                if error:
                    print(f"[*] 错误: {error}")
                
                # 判断结果
                if error:
                    submission.status = 'error'
                    submission.result = error
                elif output.strip() == problem.expected_output.strip():
                    submission.status = 'accepted'
                    submission.result = '答案正确'
                else:
                    submission.status = 'wrong_answer'
                    submission.result = f'答案错误\n期望输出: {problem.expected_output}\n实际输出: {output}'
                
                submission.execution_time = execution_time
                session.commit()
                print(f"[*] 提交 {submission.id} 判题完成，状态: {submission.status}")
                
            except Exception as e:
                print(f"[!] 处理提交 {submission.id} 时发生错误: {str(e)}")
                if submission:
                    submission.status = 'error'
                    submission.result = f'判题服务错误: {str(e)}'
                    session.commit()
        
        return len(pending_submissions)
        
    except Exception as e:
        print(f"[!] 查询待处理提交时发生错误: {str(e)}")
        return 0
    finally:
        session.close()

def start_simple_judge_worker():
    """启动简化的判题服务"""
    print("[*] 启动简化判题服务（不依赖RabbitMQ）")
    print("[*] 服务将每5秒检查一次待处理的提交")
    
    try:
        while True:
            try:
                count = process_pending_submissions()
                if count > 0:
                    print(f"[*] 本轮处理完成，处理了 {count} 个提交")
                else:
                    print("[*] 没有待处理的提交")
                
                # 等待5秒后继续下一轮
                time.sleep(5)
                
            except KeyboardInterrupt:
                print('\n[*] 判题服务正在停止...')
                break
            except Exception as e:
                print(f"[!] 服务运行错误: {str(e)}")
                time.sleep(5)  # 出错后等待5秒再继续
                
    except Exception as e:
        print(f"[!] 服务启动失败: {str(e)}")

if __name__ == '__main__':
    start_simple_judge_worker()
