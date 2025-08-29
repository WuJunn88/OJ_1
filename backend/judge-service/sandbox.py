# 沙箱环境配置，用于安全地运行用户提交的代码
import subprocess
import tempfile
import os
import signal
import resource
import time
from typing import Tuple, Optional

class SandboxError(Exception):
    """沙箱运行错误"""
    pass

def set_resource_limits(memory_limit_mb: int, time_limit_ms: int):
    """设置资源限制"""
    try:
        # 设置内存限制 (MB -> KB)
        memory_limit_kb = memory_limit_mb * 1024
        resource.setrlimit(resource.RLIMIT_AS, (memory_limit_kb * 1024, memory_limit_kb * 1024))
        
        # 设置CPU时间限制 (毫秒 -> 秒)
        time_limit_sec = time_limit_ms / 1000
        resource.setrlimit(resource.RLIMIT_CPU, (time_limit_sec, time_limit_sec))
    except Exception:
        # 在某些系统上可能不支持资源限制，忽略错误
        pass

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
    
    # 设置Java环境变量
    env = os.environ.copy()
    
    # 尝试设置JAVA_HOME，如果未设置的话
    if 'JAVA_HOME' not in env:
        # 在macOS上，Java通常安装在以下位置
        possible_java_homes = [
            '/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home',  # Homebrew OpenJDK
            '/Library/Java/JavaVirtualMachines',
            '/System/Library/Java/JavaVirtualMachines',
            '/usr/local/opt/openjdk'
        ]
        
        for java_home in possible_java_homes:
            if os.path.exists(java_home):
                # 检查是否有bin目录和java可执行文件
                java_bin = os.path.join(java_home, 'bin')
                java_exe = os.path.join(java_bin, 'java')
                if os.path.exists(java_bin) and os.path.exists(java_exe):
                    env['JAVA_HOME'] = java_home
                    break
    
    # 如果找到了JAVA_HOME，更新PATH
    if 'JAVA_HOME' in env:
        java_bin = os.path.join(env['JAVA_HOME'], 'bin')
        if os.path.exists(java_bin):
            env['PATH'] = java_bin + os.pathsep + env.get('PATH', '')
    else:
        # 如果还是没找到，尝试直接使用Homebrew的Java路径
        homebrew_java = '/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home/bin'
        if os.path.exists(homebrew_java):
            env['PATH'] = homebrew_java + os.pathsep + env.get('PATH', '')
    
    try:
        # 编译Java代码
        compile_process = subprocess.run(
            ['javac', java_file],
            capture_output=True,
            text=True,
            timeout=10,
            env=env
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
            cwd=tmp_dir,
            env=env
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