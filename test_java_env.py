#!/usr/bin/env python3
"""
测试Java环境变量设置
"""

import os
import subprocess
import tempfile

def test_java_environment():
    """测试Java环境变量设置"""
    print("🔍 测试Java环境变量设置...")
    print("=" * 50)
    
    # 复制当前环境
    env = os.environ.copy()
    
    print(f"当前JAVA_HOME: {env.get('JAVA_HOME', '未设置')}")
    print(f"当前PATH: {env.get('PATH', '未设置')}")
    
    # 尝试设置JAVA_HOME，如果未设置的话
    if 'JAVA_HOME' not in env:
        print("\n🔧 尝试自动设置JAVA_HOME...")
        
        # 在macOS上，Java通常安装在以下位置
        possible_java_homes = [
            '/Library/Java/JavaVirtualMachines',
            '/System/Library/Java/JavaVirtualMachines',
            '/opt/homebrew/opt/openjdk',
            '/usr/local/opt/openjdk'
        ]
        
        for java_home in possible_java_homes:
            if os.path.exists(java_home):
                print(f"  检查目录: {java_home}")
                # 查找第一个可用的JDK
                try:
                    for item in os.listdir(java_home):
                        if item.endswith('.jdk') or item.endswith('.jre'):
                            env['JAVA_HOME'] = os.path.join(java_home, item)
                            print(f"  ✅ 找到JDK: {env['JAVA_HOME']}")
                            break
                    if 'JAVA_HOME' in env:
                        break
                except PermissionError:
                    print(f"  ❌ 权限不足，无法访问: {java_home}")
                except Exception as e:
                    print(f"  ❌ 访问失败: {e}")
    
    # 如果找到了JAVA_HOME，更新PATH
    if 'JAVA_HOME' in env:
        java_bin = os.path.join(env['JAVA_HOME'], 'bin')
        if os.path.exists(java_bin):
            env['PATH'] = java_bin + os.pathsep + env.get('PATH', '')
            print(f"\n✅ 更新PATH，添加: {java_bin}")
        else:
            print(f"\n❌ JAVA_HOME/bin目录不存在: {java_bin}")
    else:
        print("\n❌ 未找到可用的JDK")
    
    print(f"\n最终JAVA_HOME: {env.get('JAVA_HOME', '未设置')}")
    print(f"最终PATH中的Java路径: {[p for p in env.get('PATH', '').split(os.pathsep) if 'java' in p.lower()]}")
    
    # 测试Java命令
    print("\n🧪 测试Java命令...")
    
    # 测试javac
    try:
        result = subprocess.run(['javac', '-version'], 
                              capture_output=True, text=True, env=env, timeout=5)
        if result.returncode == 0:
            print(f"  ✅ javac 可用: {result.stdout.strip()}")
        else:
            print(f"  ❌ javac 失败: {result.stderr.strip()}")
    except Exception as e:
        print(f"  ❌ javac 异常: {e}")
    
    # 测试java
    try:
        result = subprocess.run(['java', '-version'], 
                              capture_output=True, text=True, env=env, timeout=5)
        if result.returncode == 0:
            print(f"  ✅ java 可用: {result.stdout.strip()}")
        else:
            print(f"  ❌ java 失败: {result.stderr.strip()}")
    except Exception as e:
        print(f"  ❌ java 异常: {e}")
    
    # 测试简单的Java代码编译和运行
    print("\n🧪 测试Java代码编译和运行...")
    
    java_code = """
public class Test {
    public static void main(String[] args) {
        System.out.println("Hello, Java!");
    }
}
"""
    
    try:
        # 创建临时目录
        with tempfile.TemporaryDirectory() as tmp_dir:
            java_file = os.path.join(tmp_dir, "Test.java")
            
            # 写入Java代码
            with open(java_file, 'w') as f:
                f.write(java_code)
            
            print(f"  📝 创建Java文件: {java_file}")
            
            # 编译
            compile_result = subprocess.run(
                ['javac', java_file],
                capture_output=True,
                text=True,
                env=env,
                timeout=10
            )
            
            if compile_result.returncode == 0:
                print("  ✅ 编译成功")
                
                # 运行
                run_result = subprocess.run(
                    ['java', 'Test'],
                    capture_output=True,
                    text=True,
                    env=env,
                    cwd=tmp_dir,
                    timeout=10
                )
                
                if run_result.returncode == 0:
                    print(f"  ✅ 运行成功，输出: {run_result.stdout.strip()}")
                else:
                    print(f"  ❌ 运行失败: {run_result.stderr.strip()}")
            else:
                print(f"  ❌ 编译失败: {compile_result.stderr.strip()}")
                
    except Exception as e:
        print(f"  ❌ 测试异常: {e}")
    
    print("\n" + "=" * 50)
    print("测试完成！")

if __name__ == "__main__":
    test_java_environment()
