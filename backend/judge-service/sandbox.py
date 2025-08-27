# 沙箱环境配置，用于安全地运行用户提交的代码
import subprocess
import tempfile
import os
import signal
import time
import platform
from typing import Tuple, Optional

# 跨平台资源限制实现
def _get_platform_resource_limits():
    """获取平台特定的资源限制设置函数"""
    system = platform.system()
    
    if system in ["Linux", "Darwin"]:  # Linux 或 macOS
        try:
            import resource
            return resource
        except ImportError:
            return None
    elif system == "Windows":
        try:
            import psutil
            return psutil
        except ImportError:
            return None
    else:
        return None

class SandboxError(Exception):
    """沙箱运行错误"""
    pass

def set_resource_limits(memory_limit_mb: int, time_limit_ms: int):
    """设置资源限制（跨平台兼容）"""
    system = platform.system()
    
    if system in ["Linux", "Darwin"]:  # Linux 或 macOS
        try:
            import resource
            # 设置内存限制 (MB -> KB)
            memory_limit_kb = memory_limit_mb * 1024
            resource.setrlimit(resource.RLIMIT_AS, (memory_limit_kb * 1024, memory_limit_kb * 1024))
            
            # 设置CPU时间限制 (毫秒 -> 秒)
            time_limit_sec = time_limit_ms / 1000
            resource.setrlimit(resource.RLIMIT_CPU, (time_limit_sec, time_limit_sec))
            print(f"资源限制设置成功 (Unix系统): 内存{memory_limit_mb}MB, 时间{time_limit_ms}ms")
        except ImportError:
            print("resource模块不可用，跳过资源限制设置")
        except Exception as e:
            print(f"设置资源限制失败: {e}")
    
    elif system == "Windows":
        try:
            import psutil
            # Windows 下设置进程优先级（无法设置严格的资源限制）
            process = psutil.Process()
            process.nice(psutil.BELOW_NORMAL_PRIORITY_CLASS)
            print(f"Windows系统：已设置进程优先级，内存限制{memory_limit_mb}MB, 时间限制{time_limit_ms}ms")
            print("注意：Windows系统无法设置严格的资源限制，主要依赖超时控制")
        except ImportError:
            print("Windows系统：psutil不可用，跳过资源限制设置")
            print("建议安装: pip install psutil")
        except Exception as e:
            print(f"Windows资源限制设置失败: {e}")
    
    else:
        print(f"未知系统: {system}，跳过资源限制设置")
        print(f"配置的内存限制: {memory_limit_mb}MB, 时间限制: {time_limit_ms}ms")

def check_memory_usage():
    """检查当前进程内存使用情况（跨平台）"""
    try:
        import psutil
        process = psutil.Process()
        memory_info = process.memory_info()
        return memory_info.rss  # 返回内存使用量（字节）
    except ImportError:
        # 如果没有 psutil，返回估算值
        return 0

def enforce_timeout(timeout_seconds=5):
    """强制超时控制（跨平台）"""
    def timeout_handler(signum, frame):
        raise TimeoutError("执行超时")
    
    if platform.system() != "Windows":  # Windows 下 signal 有限制
        try:
            signal.signal(signal.SIGALRM, timeout_handler)
            signal.alarm(timeout_seconds)
            return timeout_handler
        except Exception as e:
            print(f"设置超时信号失败: {e}")
            return None
    else:
        print("Windows系统：使用subprocess超时控制")
        return None

def run_code(code: str, language: str, input_data: str, 
             time_limit_ms: int = 1000, memory_limit_mb: int = 128) -> Tuple[str, Optional[str]]:
    """
    在沙箱环境中运行用户代码
    
    Args:
        code: 用户提交的代码
        language: 编程语言
        input_data: 输入数据
        time_limit_ms: 时间限制（毫秒）
        memory_limit_mb: 内存限制（MB）
    
    Returns:
        (output, error)
    """
    try:
        if language == 'python':
            return run_python_code(code, input_data, time_limit_ms, memory_limit_mb)
        elif language == 'cpp':
            return run_cpp_code(code, input_data, time_limit_ms, memory_limit_mb)
        elif language == 'java':
            return run_java_code(code, input_data, time_limit_ms, memory_limit_mb)
        elif language == 'javascript':
            return run_javascript_code(code, input_data, time_limit_ms, memory_limit_mb)
        else:
            raise SandboxError(f"不支持的语言: {language}")
    except Exception as e:
        return "", str(e)

def run_python_code(code: str, input_data: str, time_limit_ms: int, memory_limit_mb: int) -> Tuple[str, Optional[str]]:
    """运行Python代码"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
        f.write(code)
        temp_file = f.name
    
    try:
        # 创建进程
        process = subprocess.Popen(
            ['python3', temp_file],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # 运行代码
        try:
            # 处理空输入的情况
            if input_data is None or input_data.strip() == '':
                # 如果没有输入，不传递stdin
                stdout, stderr = process.communicate(
                    timeout=time_limit_ms / 1000
                )
            else:
                # 如果有输入，传递stdin
                stdout, stderr = process.communicate(
                    input=input_data,
                    timeout=time_limit_ms / 1000
                )
            
            if process.returncode == 0:
                return stdout.strip(), None
            else:
                return "", stderr.strip()
                
        except subprocess.TimeoutExpired:
            process.kill()
            return "", "时间超限"
            
    finally:
        # 清理临时文件
        try:
            os.unlink(temp_file)
        except:
            pass

def run_cpp_code(code: str, input_data: str, time_limit_ms: int, memory_limit_mb: int) -> Tuple[str, Optional[str]]:
    """运行C++代码"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.cpp', delete=False) as f:
        f.write(code)
        cpp_file = f.name
    
    exe_file = cpp_file + '.exe'
    
    try:
        # 编译C++代码
        compile_process = subprocess.run(
            ['g++', '-std=c++11', '-O2', cpp_file, '-o', exe_file],
            capture_output=True,
            text=True,
            timeout=10  # 编译超时10秒
        )
        
        if compile_process.returncode != 0:
            return "", f"编译错误: {compile_process.stderr}"
        
        # 运行编译后的程序
        process = subprocess.Popen(
            [exe_file],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        try:
            # 处理空输入的情况
            if input_data is None or input_data.strip() == '':
                # 如果没有输入，不传递stdin
                stdout, stderr = process.communicate(
                    timeout=time_limit_ms / 1000
                )
            else:
                # 如果有输入，传递stdin
                stdout, stderr = process.communicate(
                    input=input_data,
                    timeout=time_limit_ms / 1000
                )
            
            if process.returncode == 0:
                return stdout.strip(), None
            else:
                return "", stderr.strip()
                
        except subprocess.TimeoutExpired:
            process.kill()
            return "", "时间超限"
            
    finally:
        # 清理临时文件
        try:
            os.unlink(cpp_file)
            if os.path.exists(exe_file):
                os.unlink(exe_file)
        except:
            pass

def run_java_code(code: str, input_data: str, time_limit_ms: int, memory_limit_mb: int) -> Tuple[str, Optional[str]]:
    """运行Java代码"""
    # 提取类名（查找 public class 或 class 声明）。优先使用 public class
    import re
    class_name = "Main"
    m = re.search(r"public\s+class\s+([A-Za-z_][A-Za-z0-9_]*)", code)
    if not m:
        m = re.search(r"class\s+([A-Za-z_][A-Za-z0-9_]*)", code)
    if m:
        class_name = m.group(1)
    
    # 在临时目录下以类名命名文件，避免“公共类名与文件名不一致”的编译错误
    tmp_dir = tempfile.mkdtemp()
    java_file = os.path.join(tmp_dir, f"{class_name}.java")
    with open(java_file, 'w') as f:
        f.write(code)
    
    try:
        # 编译Java代码
        compile_process = subprocess.run(
            ['javac', java_file],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if compile_process.returncode != 0:
            return "", f"编译错误: {compile_process.stderr}"
        
        # 运行编译后的程序
        process = subprocess.Popen(
            ['java', '-Xmx' + str(memory_limit_mb) + 'm', class_name],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=tmp_dir
        )
        
        try:
            # 处理空输入的情况
            if input_data is None or (isinstance(input_data, str) and input_data.strip() == ''):
                stdout, stderr = process.communicate(
                    timeout=time_limit_ms / 1000
                )
            else:
                stdout, stderr = process.communicate(
                    input=input_data,
                    timeout=time_limit_ms / 1000
                )
            
            if process.returncode == 0:
                return stdout.strip(), None
            else:
                return "", stderr.strip()
                
        except subprocess.TimeoutExpired:
            process.kill()
            return "", "时间超限"
            
    finally:
        # 清理临时文件
        try:
            # 删除整个临时目录及其中的编译产物
            import shutil
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except:
            pass

def run_javascript_code(code: str, input_data: str, time_limit_ms: int, memory_limit_mb: int) -> Tuple[str, Optional[str]]:
    """运行JavaScript代码"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False) as f:
        f.write(code)
        js_file = f.name
    
    try:
        # 运行JavaScript代码
        process = subprocess.Popen(
            ['node', js_file],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        try:
            # 处理空输入的情况
            if input_data is None or input_data.strip() == '':
                # 如果没有输入，不传递stdin
                stdout, stderr = process.communicate(
                    timeout=time_limit_ms / 1000
                )
            else:
                # 如果有输入，传递stdin
                stdout, stderr = process.communicate(
                    input=input_data,
                    timeout=time_limit_ms / 1000
                )
            
            if process.returncode == 0:
                return stdout.strip(), None
            else:
                return "", stderr.strip()
                
        except subprocess.TimeoutExpired:
            process.kill()
            return "", "时间超限"
            
    finally:
        # 清理临时文件
        try:
            os.unlink(js_file)
        except:
            pass

def test_cross_platform_compatibility():
    """测试跨平台兼容性"""
    print("=== 跨平台兼容性测试 ===")
    system = platform.system()
    print(f"当前系统: {system}")
    
    # 测试资源限制设置
    print("\n1. 测试资源限制设置:")
    set_resource_limits(128, 1000)
    
    # 测试内存监控
    print("\n2. 测试内存监控:")
    memory_usage = check_memory_usage()
    if memory_usage > 0:
        print(f"当前内存使用: {memory_usage / 1024 / 1024:.2f} MB")
    else:
        print("内存监控不可用")
    
    # 测试超时控制
    print("\n3. 测试超时控制:")
    timeout_handler = enforce_timeout(5)
    if timeout_handler:
        print("超时控制设置成功")
    else:
        print("超时控制不可用")
    
    print("\n=== 测试完成 ===")

if __name__ == "__main__":
    test_cross_platform_compatibility()