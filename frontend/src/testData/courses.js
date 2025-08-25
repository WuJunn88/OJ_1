// 课程和作业的测试数据
export const mockCourses = [
  {
    id: 1,
    name: '数据结构与算法',
    description: '本课程介绍基本的数据结构和算法设计思想，包括线性表、栈、队列、树、图等数据结构，以及排序、查找等基本算法。',
    class_id: 1,
    major_id: 1,
    school_id: 1,
    teacher_id: 1,
    class_name: '计算机科学2021级1班',
    major_name: '计算机科学系',
    school_name: '索邦大学',
    student_count: 35,
    created_at: '2024-01-15T08:00:00Z'
  },
  {
    id: 2,
    name: '程序设计基础',
    description: '本课程教授C++编程语言的基础知识，包括语法、数据类型、控制结构、函数、数组、指针等核心概念。',
    class_id: 2,
    major_id: 1,
    school_id: 1,
    teacher_id: 1,
    class_name: '计算机科学2021级2班',
    major_name: '计算机科学系',
    school_name: '索邦大学',
    student_count: 32,
    created_at: '2024-01-10T08:00:00Z'
  },
  {
    id: 3,
    name: '高等数学',
    description: '本课程涵盖微积分、线性代数、概率论等数学基础知识，为后续专业课程打下坚实的数学基础。',
    class_id: 3,
    major_id: 2,
    school_id: 1,
    teacher_id: 1,
    class_name: '数学系2021级1班',
    major_name: '数学系',
    school_name: '索邦大学',
    student_count: 28,
    created_at: '2024-01-05T08:00:00Z'
  }
];

export const mockAssignments = [
  {
    id: 1,
    name: '第一次编程作业',
    description: '实现基本的数组操作和排序算法',
    requirements: '1. 实现冒泡排序算法\n2. 实现快速排序算法\n3. 比较两种算法的性能\n4. 提交源代码和测试结果',
    due_date: '2024-02-15T23:59:00Z',
    course_id: 1,
    course_name: '数据结构与算法',
    problem_ids: [1, 2, 3],
    is_active: true,
    created_at: '2024-01-20T08:00:00Z'
  },
  {
    id: 2,
    name: 'C++基础练习',
    description: '练习C++基本语法和面向对象编程',
    requirements: '1. 创建一个学生类\n2. 实现构造函数和析构函数\n3. 实现成员函数\n4. 编写测试程序',
    due_date: '2024-02-10T23:59:00Z',
    course_id: 2,
    course_name: '程序设计基础',
    problem_ids: [4, 5],
    is_active: true,
    created_at: '2024-01-18T08:00:00Z'
  },
  {
    id: 3,
    name: '微积分作业',
    description: '练习导数和积分的计算',
    requirements: '1. 计算给定函数的导数\n2. 计算定积分\n3. 应用微积分解决实际问题',
    due_date: '2024-02-20T23:59:00Z',
    course_id: 3,
    course_name: '高等数学',
    problem_ids: [6, 7],
    is_active: true,
    created_at: '2024-01-22T08:00:00Z'
  }
];

// 格式化日期显示
export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 获取课程状态
export const getCourseStatus = (course) => {
  // 这里可以根据实际业务逻辑判断课程状态
  return 'active';
};

// 获取作业状态
export const getAssignmentStatus = (assignment) => {
  const now = new Date();
  const dueDate = new Date(assignment.due_date);
  return now > dueDate ? 'inactive' : 'active';
};
