import React, { useState, useEffect } from 'react';
import { getUsers, getSchools, getMajors, getClasses, batchImportStudents, getProblems, createProblem, updateProblem, deleteProblem, updateUser, deleteUser, registerStudent, getTeacherCourses, getCourseAssignments, createAssignment, updateAssignment, deleteAssignment, getCourseStudents, addStudentToCourse, removeStudentFromCourse, getDepartments, batchImportStudentsFromExcel } from '../services/api';
import * as XLSX from 'xlsx';
import './TeacherDashboardPage.css';
import AIProblemGenerationPage from './AIProblemGenerationPage';
import { mockCourses, mockAssignments, formatDate } from '../testData/courses';

const TeacherDashboardPage = () => {
  const [activeTab, setActiveTab] = useState('students');
  const [activeSubTab, setActiveSubTab] = useState('list'); // 子标签页
  const [users, setUsers] = useState([]);
  const [problems, setProblems] = useState([]);
  const [schools, setSchools] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [majors, setMajors] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 批量导入相关状态
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedMajor, setSelectedMajor] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);

  // 手动创建题目相关状态
  const [problemForm, setProblemForm] = useState({
    title: '',
    description: '',
    type: 'programming', // 题目类型：programming(编程题), choice(选择题), judge(判断题), short_answer(简答题)
    test_cases: '',
    expected_output: '',
    difficulty: 'easy',
    time_limit: 1000,
    memory_limit: 128,
    // 选择题相关字段
    options: [], // 选项数组
    correct_answers: [], // 正确答案数组（支持多选）
    is_multiple_choice: false, // 是否多选
    // 简答题相关字段
    answer: '' // 简答题答案
  });

  // 编辑题目状态
  const [editingProblem, setEditingProblem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // 添加学生相关状态（按新规则：学号、姓名、密码必填）
  const [addStudentForm, setAddStudentForm] = useState({
    student_no: '',
    name: '',
    password: '',
    email: '',
    phone: '',
    school_id: '',
    department_id: '',
    major_id: '',
    class_id: ''
  });

  // 学生编辑相关状态
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    email: '',
    phone: '',
    school_id: '',
    major_id: '',
    class_id: '',
    new_password: ''
  });

  // 课程相关状态（只读，用于查看）
  const [courses, setCourses] = useState([]);
  const [editingCourse, setEditingCourse] = useState(null);

  // 作业相关状态
  const [assignments, setAssignments] = useState([]);
  const [assignmentForm, setAssignmentForm] = useState({
    name: '',
    description: '',
    requirements: '',
    due_date: '',
    course_id: '',
    problem_ids: []
  });

  // 编辑作业状态
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [isEditingAssignment, setIsEditingAssignment] = useState(false);
  const [editingAssignmentContext, setEditingAssignmentContext] = useState(''); // 记录编辑作业时的上下文
  
  // 添加学生到课程的状态
  const [addingStudentContext, setAddingStudentContext] = useState(''); // 记录添加学生时的上下文
  
  // 学生-教学班关联关系状态
  const [studentClassRelations, setStudentClassRelations] = useState([]); // 存储学生与教学班的关联关系

  useEffect(() => {
    fetchInitialData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 从API加载学生-课程关联关系
  useEffect(() => {
    const loadCourseStudents = async () => {
      if (editingCourse && editingCourse.id) {
        console.log('开始加载课程学生数据，课程ID:', editingCourse.id);
        
        try {
          const courseStudentsData = await getCourseStudents(editingCourse.id);
          console.log('从API获取的课程学生数据:', courseStudentsData);
          
          if (courseStudentsData && courseStudentsData.length > 0) {
            const apiRelations = courseStudentsData.map(student => ({
              student_id: student.student_id,
              class_id: student.class_id,
              course_id: editingCourse.id,
              student_name: student.student_name,
              student_no: student.student_no,
              added_at: student.added_at || new Date().toISOString()
            }));
            setStudentClassRelations(apiRelations);
            console.log('成功加载课程学生数据:', apiRelations);
          } else {
            setStudentClassRelations([]);
            console.log('该课程暂无学生');
          }
        } catch (error) {
          console.error('加载课程学生数据失败:', error);
          setStudentClassRelations([]);
        }
      }
    };
    
    loadCourseStudents();
  }, [editingCourse]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      const [schoolsData, usersData, problemsData] = await Promise.all([
        getSchools(),
        getUsers(1, 50, 'student'),
        getProblems(1, 50)
      ]);
      
      setSchools(schoolsData);
      setUsers(usersData.users);
      setProblems(problemsData.problems);
      
      // 获取所有专业和班级数据 - 确保schools数据已经设置
      if (schoolsData && schoolsData.length > 0) {
        await fetchAllMajorsAndClasses(schoolsData);
      }
      
      // 调试信息：打印题目数据
      console.log('从API获取的题目数据:', problemsData.problems);
      if (problemsData.problems && problemsData.problems.length > 0) {
        problemsData.problems.forEach((problem, index) => {
          console.log(`题目 ${index + 1}:`, {
            id: problem.id,
            title: problem.title,
            type: problem.type,
            difficulty: problem.difficulty
          });
        });
      }
      
      // 获取课程和作业数据（使用测试数据）
      try {
        const [coursesData, assignmentsData] = await Promise.all([
          getTeacherCourses(),
          getCourseAssignments()
        ]);
        
        setCourses(coursesData.courses || mockCourses);
        setAssignments(assignmentsData.assignments || mockAssignments);
      } catch (error) {
        console.warn('获取课程或作业数据失败，使用测试数据:', error);
        setCourses(mockCourses);
        setAssignments(mockAssignments);
      }
      
      // 学生-课程关联关系数据将在进入课程详情页时从API加载
    } catch (error) {
      setError(error?.response?.data?.error || '获取数据失败');
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取所有专业和班级数据的函数
  const fetchAllMajorsAndClasses = async (schoolsData = null) => {
    // 防止重复调用
    if (fetchAllMajorsAndClasses.isLoading) {
      console.log('fetchAllMajorsAndClasses 正在执行中，跳过重复调用');
      return;
    }
    
    fetchAllMajorsAndClasses.isLoading = true;
    
    try {
      // 使用传入的schoolsData参数，如果没有传入则使用state中的schools
      const schoolsToUse = schoolsData || schools;
      
      if (!schoolsToUse || schoolsToUse.length === 0) {
        console.warn('没有学校数据，无法获取专业和班级');
        return;
      }
      
      console.log('开始获取数据，学校数量:', schoolsToUse.length);
      console.log('学校数据:', schoolsToUse);
      
      // 按照正确的层次结构获取数据：学校 → 院部 → 专业 → 班级
      const allDepartments = [];
      const allMajors = [];
      const allClasses = [];
      
      for (const school of schoolsToUse) {
        try {
          console.log(`正在获取学校 ${school.id} (${school.name}) 的数据...`);
          
          // 1. 获取学校的院部
          const departmentsData = await getDepartments(school.id);
          console.log(`学校 ${school.id} 的院部数据:`, departmentsData);
          allDepartments.push(...departmentsData);
          
          // 2. 获取学校下的所有专业（按school_id过滤）
          try {
            console.log(`正在获取学校 ${school.id} 的专业...`);
            const majorsData = await getMajors(school.id);
            console.log(`学校 ${school.id} 的专业数据:`, majorsData);
            allMajors.push(...majorsData);
            
            // 3. 获取每个专业的班级
            for (const major of majorsData) {
              try {
                console.log(`正在获取专业 ${major.id} (${major.name}) 的班级...`);
                const classesData = await getClasses(major.id);
                console.log(`专业 ${major.id} 的班级数据:`, classesData);
                allClasses.push(...classesData);
              } catch (error) {
                console.error(`获取专业 ${major.id} 的班级失败:`, error);
              }
            }
          } catch (error) {
            console.error(`获取学校 ${school.id} 的专业失败:`, error);
          }
        } catch (error) {
          console.error(`获取学校 ${school.id} 的院部失败:`, error);
        }
      }
      
      console.log('最终获取到的数据:');
      console.log('院部:', allDepartments);
      console.log('专业:', allMajors);
      console.log('班级:', allClasses);
      
      setDepartments(allDepartments);
      setMajors(allMajors);
      setClasses(allClasses);
      
      console.log('获取到的所有院部:', allDepartments);
      console.log('获取到的所有专业:', allMajors);
      console.log('获取到的所有班级:', allClasses);
    } catch (error) {
      console.error('获取所有院部、专业和班级失败:', error);
    } finally {
      fetchAllMajorsAndClasses.isLoading = false;
    }
  };

  const handleSchoolChange = async (schoolId) => {
    setSelectedSchool(schoolId);
    setSelectedDepartment('');
    setSelectedMajor('');
    setSelectedClass('');
    
    // 不再重置全局的departments、majors和classes数组
    // 这些数组应该保持完整，用于学生列表显示
  };

  const handleDepartmentChange = async (departmentId) => {
    setSelectedDepartment(departmentId);
    setSelectedMajor('');
    setSelectedClass('');
    
    // 不再重置全局的majors和classes数组
    // 这些数组应该保持完整，用于学生列表显示
  };

  const handleMajorChange = async (majorId) => {
    setSelectedMajor(majorId);
    setSelectedClass('');
    
    // 不再重置全局的classes数组
    // 这个数组应该保持完整，用于学生列表显示
  };

  const handleBatchImport = async () => {
    if (!uploadedFile) {
      setError('请选择要上传的Excel文件');
      setSuccess('');
      return;
    }

    if (!selectedSchool || !selectedDepartment || !selectedMajor || !selectedClass) {
      setError('请选择学校、院部、专业和班级');
      setSuccess('');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // 创建FormData对象来上传文件
      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('school_id', selectedSchool);
      formData.append('department_id', selectedDepartment);
      formData.append('major_id', selectedMajor);
      formData.append('class_id', selectedClass);
      
      // 调用新的批量导入API
      const resp = await batchImportStudentsFromExcel(formData);
      
      const msg = resp?.message || `批量导入完成: 成功 ${resp?.success_count ?? 0} 个, 失败 ${resp?.failed_count ?? 0} 个`;
      setSuccess(msg);
      
      if (resp?.errors && resp.errors.length > 0) {
        const preview = resp.errors.slice(0, 5).join('；');
        setError(`部分导入失败：${preview}${resp.errors.length > 5 ? ' 等' : ''}`);
      }
      
      // 刷新用户列表
      const usersData = await getUsers(1, 50, 'student');
      setUsers(usersData.users);
      
      // 清理上传的文件
      setUploadedFile(null);
      
    } catch (error) {
      setError(error.response?.data?.error || '批量导入失败');
    } finally {
      setLoading(false);
    }
  };

  // 下载Excel模板
  const handleDownloadTemplate = () => {
    // 创建Excel模板数据
    const templateData = [
      ['学号', '姓名', '密码'],
      ['2021001', '张三', '123456'],
      ['2021002', '李四', '123456'],
      ['2021003', '王五', '123456']
    ];
    
    // 创建工作簿
    const workbook = XLSX.utils.book_new();
    
    // 创建工作表
    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    
    // 设置列宽
    const colWidths = [
      { wch: 15 }, // 学号列宽
      { wch: 15 }, // 姓名列宽
      { wch: 15 }  // 密码列宽
    ];
    worksheet['!cols'] = colWidths;
    
    // 将工作表添加到工作簿
    XLSX.utils.book_append_sheet(workbook, worksheet, '学生信息');
    
    // 生成Excel文件并下载
    XLSX.writeFile(workbook, '学生信息导入模板.xlsx');
    
    setSuccess('Excel模板下载成功！请填写学生信息后重新上传。');
  };

  // 处理文件上传
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // 检查文件类型
      const validTypes = ['.xlsx', '.xls', '.csv'];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      if (!validTypes.includes(fileExtension)) {
        setError('请选择有效的Excel文件格式（.xlsx, .xls, .csv）');
        return;
      }
      
      // 检查文件大小（5MB限制）
      if (file.size > 5 * 1024 * 1024) {
        setError('文件大小不能超过5MB');
        return;
      }
      
      setUploadedFile(file);
      setError('');
      setSuccess('文件选择成功！');
    }
  };

  // 移除上传的文件
  const handleRemoveFile = () => {
    setUploadedFile(null);
    setError('');
    setSuccess('');
  };

  const handleCreateProblem = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // 构建提交给后端的数据
      const submitData = { ...problemForm };
      
      // 如果是选择题，需要将options数组转换为choice_options字符串
      if (problemForm.type === 'choice') {
        // 将选项数组转换为字符串格式：A.选项内容\nB.选项内容\nC.选项内容
        submitData.choice_options = problemForm.options
          .map((option) => `${option.id}.${option.text}`)
          .join('\n');
        
        // 将正确答案数组转换为expected_output字符串
        submitData.expected_output = problemForm.correct_answers.join(',');
        
        // 删除前端特有的字段，避免后端报错
        delete submitData.options;
        delete submitData.correct_answers;
      }
      
      // 如果是判断题，需要特殊处理
      if (problemForm.type === 'judge') {
        // 判断题的选项固定为"正确"和"错误"
        submitData.choice_options = 'A.正确\nB.错误';
        
        // 将正确答案转换为expected_output
        submitData.expected_output = problemForm.correct_answers.join(',');
        
        // 删除前端特有的字段
        delete submitData.options;
        delete submitData.correct_answers;
      }
      
      // 如果是简答题，需要特殊处理
      if (problemForm.type === 'short_answer') {
        // 将简答题答案设置为expected_output
        submitData.expected_output = problemForm.answer;
        
        // 删除前端特有的字段
        delete submitData.answer;
      }
      
      // 添加调试信息
      console.log('提交的题目数据:', submitData);
      console.log('题目类型:', submitData.type);
      console.log('完整表单数据:', JSON.stringify(submitData, null, 2));
      
      if (isEditing && editingProblem) {
        console.log('更新题目，ID:', editingProblem.id);
        await updateProblem(editingProblem.id, submitData);
        setSuccess('题目更新成功！');
      } else {
        console.log('创建新题目');
        await createProblem(submitData);
        setSuccess('题目创建成功！');
      }
      
      // 重置表单
      setProblemForm({
        title: '',
        description: '',
        type: 'programming',
        test_cases: '',
        expected_output: '',
        difficulty: 'easy',
        time_limit: 1000,
        memory_limit: 128,
        options: [],
        correct_answers: [],
        is_multiple_choice: false,
        answer: ''
      });
      
      setIsEditing(false);
      setEditingProblem(null);
      
      // 刷新题目列表
      const problemsData = await getProblems(1, 50);
      setProblems(problemsData.problems);
      
      // 切换到题目列表
      setActiveSubTab('list');
      
    } catch (error) {
      console.error('题目操作失败:', error);
      console.error('错误响应:', error.response);
      setError(error.response?.data?.error || (isEditing ? '更新题目失败' : '创建题目失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleEditProblem = (problem) => {
    setEditingProblem(problem);
    // 根据题目类型初始化表单数据
    let initialOptions = [];
    let initialCorrectAnswers = [];
    
    if (problem.type === 'choice') {
      // 解析选择题的choice_options字符串
      if (problem.choice_options) {
        const optionLines = problem.choice_options.split('\n').filter(line => line.trim());
        initialOptions = optionLines.map((line, index) => {
          const match = line.match(/^([A-Z])\.(.+)$/);
          if (match) {
            return {
              id: match[1], // 使用字母ID (A, B, C...)
              text: match[2].trim(),
              is_correct: false
            };
          }
          return {
            id: String.fromCharCode(65 + index), // 如果没有匹配到字母，使用默认字母ID
            text: line.trim(),
            is_correct: false
          };
        });
      }
      
      // 解析expected_output中的正确答案
      if (problem.expected_output) {
        const correctAnswers = problem.expected_output.split(',').filter(ans => ans.trim());
        initialCorrectAnswers = correctAnswers;
        
        // 设置选项的正确状态
        initialOptions = initialOptions.map(option => ({
          ...option,
          is_correct: correctAnswers.includes(option.id)
        }));
      }
    } else if (problem.type === 'judge') {
      // 判断题固定选项
      initialOptions = [
        { id: 'A', text: '正确', is_correct: false },
        { id: 'B', text: '错误', is_correct: false }
      ];
      
      // 根据expected_output设置正确答案
      if (problem.expected_output) {
        const correctAnswer = problem.expected_output.trim();
        if (correctAnswer === 'A') {
          initialOptions[0].is_correct = true;
          initialCorrectAnswers = ['A'];
        } else if (correctAnswer === 'B') {
          initialOptions[1].is_correct = true;
          initialCorrectAnswers = ['B'];
        }
      }
    }
    
    setProblemForm({
      title: problem.title,
      description: problem.description,
      type: problem.type || 'programming',
      test_cases: problem.test_cases || '',
      expected_output: problem.expected_output || '',
      difficulty: problem.difficulty,
      time_limit: problem.time_limit || 1000,
      memory_limit: problem.memory_limit || 128,
      options: initialOptions,
      correct_answers: initialCorrectAnswers,
      is_multiple_choice: problem.is_multiple_choice || false,
      answer: problem.answer || ''
    });
    
    setIsEditing(true);
    setActiveSubTab('create');
  };

  const handleDeleteProblem = async (problemId) => {
    if (!window.confirm('确定要删除这个题目吗？此操作不可恢复。')) {
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await deleteProblem(problemId);
      setSuccess('题目删除成功！');
      
      // 刷新题目列表
      const problemsData = await getProblems(1, 50);
      setProblems(problemsData.problems);
    } catch (error) {
      setError(error.response?.data?.error || '删除题目失败');
    } finally {
      setLoading(false);
    }
  };

  // 根据题目特征推断题目类型
  const inferProblemType = (problem) => {
    console.log('开始推断题目类型，题目数据:', problem);
    
    // 优先使用明确设置的题目类型
    if (problem.type && problem.type !== 'undefined') {
      console.log('使用明确设置的题目类型:', problem.type);
      return problem.type;
    }
    
    // 如果没有明确设置类型，则通过特征推断
    console.log('没有明确设置类型，开始推断...');
    
    // 检查所有可能的选项字段
    const options = problem.options || problem.choices || problem.alternatives || problem.option_list || [];
    console.log('检查到的选项:', options);
    
    // 如果有选项，判断是选择题还是判断题
    if (Array.isArray(options) && options.length > 0) {
      console.log('发现选项，数量:', options.length);
      
      // 检查是否是判断题（只有两个选项：正确、错误）
      if (options.length === 2) {
        const optionTexts = options.map(opt => {
          const text = opt.text || opt.option_text || opt.content || opt.label || '';
          console.log('选项文本:', text);
          return text;
        });
        
        if (optionTexts.includes('正确') && optionTexts.includes('错误')) {
          console.log('推断为判断题');
          return 'judge';
        }
      }
      
      console.log('推断为选择题');
      return 'choice';
    }
    
    // 检查所有可能的答案字段
    const answer = problem.answer || problem.solution || problem.correct_answer || problem.answer_text || '';
    console.log('检查到的答案:', answer);
    
    if (answer && answer.trim()) {
      console.log('推断为简答题');
      return 'short_answer';
    }
    
    // 检查编程题相关字段
    const testCases = problem.test_cases || problem.test_cases_text || problem.test_input || '';
    const expectedOutput = problem.expected_output || problem.expected_result || problem.expected_answer || '';
    console.log('检查到的测试用例:', testCases);
    console.log('检查到的期望输出:', expectedOutput);
    
    if (testCases && expectedOutput) {
      console.log('推断为编程题');
      return 'programming';
    }
    
    // 如果都无法推断，默认返回编程题
    console.log('无法推断类型，默认返回编程题');
    return 'programming';
  };

  // 根据ID获取学校名称
  const getSchoolName = (schoolId) => {
    if (!schoolId) return '-';
    const school = schools.find(s => {
      const sId = s.id;
      return sId === schoolId || sId === parseInt(schoolId) || parseInt(sId) === schoolId;
    });
    return school ? school.name : schoolId;
  };

  // 根据ID获取专业名称
  const getMajorName = (majorId) => {
    if (!majorId) return '-';
    const major = majors.find(m => {
      const mId = m.id;
      return mId === majorId || mId === parseInt(majorId) || parseInt(mId) === majorId;
    });
    return major ? major.name : majorId;
  };

  // 根据ID获取班级名称
  const getClassName = (classId) => {
    if (!classId) return '-';
    const classItem = classes.find(c => {
      const cId = c.id;
      return cId === classId || cId === parseInt(classId) || parseInt(cId) === classId;
    });
    return classItem ? classItem.name : classId;
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingProblem(null);
    setProblemForm({
      title: '',
      description: '',
      type: 'programming',
      test_cases: '',
      expected_output: '',
      difficulty: 'easy',
      time_limit: 1000,
      memory_limit: 128,
      options: [],
      correct_answers: [],
      is_multiple_choice: false,
      answer: ''
    });
    setActiveSubTab('list');
  };

  // 课程相关处理函数（只读功能）
  const handleViewCourseDetail = (courseId) => {
    const course = courses.find(c => c.id === courseId);
    if (course) {
      setActiveTab('courses');
      setActiveSubTab('detail');
      setEditingCourse(course);
    }
  };

  // 作业相关处理函数
  const handleCreateAssignment = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // 如果在课程详情页面创建作业，自动设置课程ID
      const assignmentData = { ...assignmentForm };
      if (activeSubTab === 'create-assignment' && editingCourse) {
        assignmentData.course_id = editingCourse.id;
      }
      
      if (isEditingAssignment && editingAssignment) {
        await updateAssignment(editingAssignment.id, assignmentData);
        setSuccess('作业更新成功！');
      } else {
        await createAssignment(assignmentData);
        setSuccess('作业布置成功！');
      }
      
      // 重置表单
      setAssignmentForm({
        name: '',
        description: '',
        requirements: '',
        due_date: '',
        course_id: '',
        problem_ids: []
      });
      
      setIsEditingAssignment(false);
      setEditingAssignment(null);
      
      // 刷新作业列表
      const assignmentsData = await getCourseAssignments();
      setAssignments(assignmentsData.assignments || []);
      
      // 如果在课程详情页面，返回到课程详情；否则返回到课程列表
      if (activeSubTab === 'create-assignment') {
        setActiveSubTab('detail');
      } else {
        setActiveSubTab('list');
      }
      
    } catch (error) {
      setError(error.response?.data?.error || (isEditingAssignment ? '更新作业失败' : '布置作业失败'));
    } finally {
      setLoading(false);
    }
  };

  const handleEditAssignment = (assignment) => {
    setEditingAssignment(assignment);
    setAssignmentForm({
      name: assignment.name,
      description: assignment.description || '',
      requirements: assignment.requirements || '',
      due_date: assignment.due_date || '',
      course_id: assignment.course_id || '',
      problem_ids: assignment.problem_ids || []
    });
    setIsEditingAssignment(true);
    
    // 记录编辑作业时的上下文
    if (activeSubTab === 'detail' && editingCourse) {
      setEditingAssignmentContext('course-detail');
    } else {
      setEditingAssignmentContext('course-list');
    }
    
    // 切换到作业创建模式
    setActiveSubTab('create-assignment');
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!window.confirm('确定要删除该作业吗？此操作不可恢复。')) return;
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      await deleteAssignment(assignmentId);
      setSuccess('作业已删除');
      
      // 刷新作业列表
      const assignmentsData = await getCourseAssignments();
      setAssignments(assignmentsData.assignments || []);
      
    } catch (error) {
      setError(error.response?.data?.error || '删除作业失败');
    } finally {
      setLoading(false);
    }
  };

  // 学生-课程关联关系处理函数
  const handleAddStudentToCourse = async () => {
    if (!editingCourse) return;
    
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // 查找学生是否已存在
      const existingStudent = users.find(user => 
        user.username === addStudentForm.student_no && user.role === 'student'
      );
      
      if (!existingStudent) {
        setError('学生不存在，请先创建学生账号');
        return;
      }
      
      // 使用API添加学生到课程
      try {
        await addStudentToCourse(editingCourse.id, {
          student_id: existingStudent.id,
          class_id: editingCourse.class_id
        });
        setSuccess('学生已成功添加到课程！');
        
        // 重新加载课程学生数据
        const courseStudentsData = await getCourseStudents(editingCourse.id);
        if (courseStudentsData && courseStudentsData.length > 0) {
          const apiRelations = courseStudentsData.map(student => ({
            student_id: student.student_id,
            class_id: student.class_id,
            course_id: editingCourse.id,
            student_name: student.student_name,
            student_no: student.student_no,
            added_at: student.added_at || new Date().toISOString()
          }));
          setStudentClassRelations(apiRelations);
        }
      } catch (apiError) {
        console.error('添加学生到课程失败:', apiError);
        setError(apiError.response?.data?.error || '添加学生失败');
        return;
      }
      
      // 重置表单
      setAddStudentForm({
        student_no: '',
        name: '',
        password: '',
        email: '',
        phone: '',
        school_id: '',
        department_id: '',
        major_id: '',
        class_id: ''
      });
      
      // 返回到课程详情页
      setActiveSubTab('detail');
      
    } catch (error) {
      setError(error.response?.data?.error || '添加学生失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveStudentFromCourse = async (relationId) => {
    if (!window.confirm('确定要从该课程中移除该学生吗？')) return;
    
    try {
      // 解析relationId获取学生ID和课程ID
      const [studentId] = relationId.split('_');
      
      // 使用API从课程中移除学生
      try {
        await removeStudentFromCourse(editingCourse.id, studentId);
        setSuccess('学生已从课程中移除');
        
        // 重新加载课程学生数据
        const courseStudentsData = await getCourseStudents(editingCourse.id);
        if (courseStudentsData && courseStudentsData.length > 0) {
          const apiRelations = courseStudentsData.map(student => ({
            student_id: student.student_id,
            class_id: student.class_id,
            course_id: editingCourse.id,
            student_name: student.student_name,
            student_no: student.student_no,
            added_at: student.added_at || new Date().toISOString()
          }));
          setStudentClassRelations(apiRelations);
        } else {
          setStudentClassRelations([]);
        }
      } catch (apiError) {
        console.error('从课程中移除学生失败:', apiError);
        setError(apiError.response?.data?.error || '移除学生失败');
        return;
      }
    } catch (error) {
      setError('移除学生失败');
    }
  };

  // 学生管理标签页渲染函数
  const renderStudentsTab = () => (
    <div className="tab-content">
      <div className="sub-tabs">
        <button 
          className={`sub-tab-btn ${activeSubTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('list')}
        >
          学生列表
        </button>
        <button 
          className={`sub-tab-btn ${activeSubTab === 'add' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('add')}
        >
          添加学生
        </button>
        <button 
          className={`sub-tab-btn ${activeSubTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('import')}
        >
          批量导入
        </button>
      </div>

      {activeSubTab === 'list' && (
        <div className="section-content">
          <div className="section-header">
            <h2>学生列表</h2>
            <button 
              className="add-btn"
              onClick={() => setActiveSubTab('add')}
            >
              添加学生
            </button>
          </div>
          
          <div className="students-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>学号</th>
                  <th>姓名</th>
                  <th>邮箱</th>
                  <th>手机号</th>
                  <th>学校</th>
                  <th>专业</th>
                  <th>班级</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.username}</td>
                    <td>{user.name}</td>
                    <td>{user.email || '-'}</td>
                    <td>{user.phone || '-'}</td>
                    <td>{getSchoolName(user.school_id)}</td>
                    <td>{getMajorName(user.major_id)}</td>
                    <td>{getClassName(user.class_id)}</td>
                    <td>
                      <button 
                        className="action-btn edit"
                        onClick={() => handleEditStudentClick(user)}
                      >
                        编辑
                      </button>
                      <button 
                        className="action-btn delete"
                        onClick={() => handleDeleteStudent(user.id)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'add' && (
        <div className="section-content">
          <div className="section-header">
            <h2>➕ 添加学生</h2>
            <button 
              className="secondary-btn"
              onClick={() => setActiveSubTab('list')}
            >
              ← 返回学生列表
            </button>
          </div>
          
          <div className="add-student-form">
            <div className="form-row">
              <div className="form-group">
                <label>学号：<span className="required-mark">*</span></label>
                <input 
                  type="text" 
                  placeholder="请输入学号"
                  value={addStudentForm.student_no}
                  onChange={(e) => setAddStudentForm(prev => ({ ...prev, student_no: e.target.value }))}
                />
              </div>
              
              <div className="form-group">
                <label>姓名：<span className="required-mark">*</span></label>
                <input 
                  type="text" 
                  placeholder="请输入学生姓名"
                  value={addStudentForm.name}
                  onChange={(e) => setAddStudentForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>密码：<span className="required-mark">*</span></label>
                <input 
                  type="password" 
                  placeholder="请输入初始密码"
                  value={addStudentForm.password}
                  onChange={(e) => setAddStudentForm(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
              
              <div className="form-group">
                <label>邮箱：</label>
                <input 
                  type="email" 
                  placeholder="请输入邮箱地址"
                  value={addStudentForm.email}
                  onChange={(e) => setAddStudentForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>手机号：</label>
                <input 
                  type="tel" 
                  placeholder="请输入手机号码"
                  value={addStudentForm.phone}
                  onChange={(e) => setAddStudentForm(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              
              <div className="form-group">
                <label>学校：</label>
                <select 
                  value={addStudentForm.school_id} 
                  onChange={(e) => handleAddStudentSchoolChange(e.target.value)}
                >
                  <option value="">请选择学校（可选）</option>
                  {schools.map(school => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>院部：</label>
                <select 
                  value={addStudentForm.department_id} 
                  onChange={(e) => handleAddStudentDepartmentChange(e.target.value)}
                  disabled={!addStudentForm.school_id}
                >
                  <option value="">请选择院部（可选）</option>
                  {getAddStudentSchoolDepartments().map(department => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
                {/* 调试信息 */}
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  当前学校ID: {addStudentForm.school_id} | 
                  可用院部数量: {getAddStudentSchoolDepartments().length} | 
                  总院部数量: {departments.length}
                </div>
              </div>
              
              <div className="form-group">
                <label>专业：</label>
                <select 
                  value={addStudentForm.major_id} 
                  onChange={(e) => handleAddStudentMajorChange(e.target.value)}
                  disabled={!addStudentForm.department_id}
                >
                  <option value="">请选择专业（可选）</option>
                  {getAddStudentDepartmentMajors().map(major => (
                    <option key={major.id} value={major.id}>
                      {major.name}
                    </option>
                  ))}
                </select>
                {/* 调试信息 */}
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  当前院部ID: {addStudentForm.department_id} | 
                  可用专业数量: {getAddStudentDepartmentMajors().length} | 
                  总专业数量: {majors.length}
                </div>
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>班级：</label>
                <select 
                  value={addStudentForm.class_id} 
                  onChange={(e) => setAddStudentForm(prev => ({ ...prev, class_id: e.target.value }))}
                  disabled={!addStudentForm.major_id}
                >
                  <option value="">请选择班级（可选）</option>
                  {getAddStudentMajorClasses().map(classItem => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.name}
                    </option>
                  ))}
                </select>
                {/* 调试信息 */}
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  当前专业ID: {addStudentForm.major_id} | 
                  可用班级数量: {getAddStudentMajorClasses().length} | 
                  总班级数量: {classes.length}
                </div>
              </div>
            </div>
            
            <div className="form-actions">
              <button 
                className="submit-btn"
                onClick={handleAddStudent}
                disabled={loading || !addStudentForm.student_no || !addStudentForm.name || !addStudentForm.password}
              >
                {loading ? '创建中...' : '创建学生账号'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'import' && (
        <div className="section-content">
          <div className="section-header">
            <h2>📥 批量导入学生</h2>
            <button 
              className="secondary-btn"
              onClick={() => setActiveSubTab('list')}
            >
              ← 返回学生列表
            </button>
          </div>
          
          <div className="import-form">
            <div className="form-help">
              <h3>导入说明</h3>
              <p>请按以下步骤操作：</p>
              <ol>
                <li>点击下方"下载Excel模板"按钮，下载标准格式的Excel文件（.xlsx格式）</li>
                <li>在Excel文件中填写学生信息（学号、姓名、密码）</li>
                <li>选择学校、院部、专业、班级信息</li>
                <li>上传填写好的Excel文件</li>
                <li>系统将自动识别并添加学生信息</li>
              </ol>
              <p><strong>注意：</strong>学号、姓名、密码为必填项，学校、院部、专业、班级信息将应用到所有导入的学生</p>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>学校：</label>
                <select 
                  value={selectedSchool} 
                  onChange={(e) => handleSchoolChange(e.target.value)}
                >
                  <option value="">请选择学校（必选）</option>
                  {schools.map(school => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>院部：</label>
                <select 
                  value={selectedDepartment} 
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  disabled={!selectedSchool}
                >
                  <option value="">请选择院部（必选）</option>
                  {getCurrentSchoolDepartments().map(department => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>专业：</label>
                <select 
                  value={selectedMajor} 
                  onChange={(e) => handleMajorChange(e.target.value)}
                  disabled={!selectedDepartment}
                >
                  <option value="">请选择专业（必选）</option>
                  {getCurrentDepartmentMajors().map(major => (
                    <option key={major.id} value={major.id}>
                      {major.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>班级：</label>
                <select 
                  value={selectedClass} 
                  onChange={(e) => setSelectedClass(e.target.value)}
                  disabled={!selectedMajor}
                >
                  <option value="">请选择班级（必选）</option>
                  {getCurrentMajorClasses().map(classItem => (
                    <option key={classItem.id} value={classItem.id}>
                      {classItem.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <button 
                  className="download-btn"
                  onClick={handleDownloadTemplate}
                  disabled={loading}
                >
                  📥 下载Excel模板
                </button>
                <span className="form-help-text">下载包含学号、姓名、密码三列的标准Excel模板（.xlsx格式）</span>
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>上传Excel文件：<span className="required-mark">*</span></label>
                <input 
                  type="file" 
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  disabled={loading || !selectedSchool || !selectedDepartment || !selectedMajor || !selectedClass}
                />
                <span className="form-help-text">支持.xlsx和.xls格式，文件大小不超过5MB。建议使用下载的Excel模板填写数据。</span>
              </div>
            </div>
            
            {uploadedFile && (
              <div className="form-row">
                <div className="form-group">
                  <div className="file-info">
                    <span>📎 已选择文件: {uploadedFile.name}</span>
                    <button 
                      className="remove-file-btn"
                      onClick={handleRemoveFile}
                    >
                      ✕ 移除
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="form-actions">
              <button 
                className="submit-btn"
                onClick={handleBatchImport}
                disabled={loading || !uploadedFile || !selectedSchool || !selectedDepartment || !selectedMajor || !selectedClass}
              >
                {loading ? '导入中...' : '开始导入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // 题目管理标签页渲染函数
  const renderProblemsTab = () => (
    <div className="tab-content">
      <div className="sub-tabs">
        <button 
          className={`sub-tab-btn ${activeSubTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('list')}
        >
          题目列表
        </button>
        <button 
          className={`sub-tab-btn ${activeSubTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('create')}
        >
          创建题目
        </button>
        <button 
          className={`sub-tab-btn ${activeSubTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('ai')}
        >
          AI生题
        </button>
      </div>

      {activeSubTab === 'list' && (
        <div className="section-content">
          <div className="section-header">
            <h2>题目列表</h2>
            <button 
              className="add-btn"
              onClick={() => setActiveSubTab('create')}
            >
              创建题目
            </button>
          </div>
          
          <div className="problems-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>标题</th>
                  <th>类型</th>
                  <th>难度</th>
                  <th>时间限制</th>
                  <th>内存限制</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {problems.map(problem => {
                  // 调试信息：打印每个题目的类型
                  console.log(`=== 题目 ${problem.id} 调试信息 ===`);
                  console.log('题目标题:', problem.title);
                  console.log('原始类型:', problem.type);
                  console.log('完整题目对象:', problem);
                  console.log('所有字段名:', Object.keys(problem));
                  console.log('选项字段:', problem.options);
                  console.log('答案字段:', problem.answer);
                  console.log('测试用例字段:', problem.test_cases);
                  console.log('期望输出字段:', problem.expected_output);
                  
                  const inferredType = inferProblemType(problem);
                  console.log('推断类型:', inferredType);
                  console.log('=== 调试信息结束 ===');
                  
                  return (
                    <tr key={problem.id}>
                      <td>{problem.id}</td>
                      <td>{problem.title}</td>
                      <td>
                        {(() => {
                          const inferredType = inferProblemType(problem);
                          const displayType = inferredType === 'choice' ? '选择题' : 
                                            inferredType === 'judge' ? '判断题' : 
                                            inferredType === 'short_answer' ? '简答题' : '编程题';
                          
                          return (
                            <span className={`type-badge ${inferredType}`}>
                              {displayType}
                            </span>
                          );
                        })()}
                        {/* 调试信息 */}
                        <small style={{display: 'block', color: '#999', fontSize: '10px'}}>
                          原始类型: {problem.type || 'undefined'} | 推断类型: {inferProblemType(problem)}
                        </small>
                      </td>
                      <td>
                        <span className={`difficulty-badge ${problem.difficulty}`}>
                          {problem.difficulty === 'easy' ? '简单' : 
                           problem.difficulty === 'medium' ? '中等' : '困难'}
                        </span>
                      </td>
                      <td>{problem.time_limit || '-'}ms</td>
                      <td>{problem.memory_limit || '-'}MB</td>
                      <td>
                        <button 
                          className="action-btn edit"
                          onClick={() => handleEditProblem(problem)}
                        >
                          编辑
                        </button>
                        <button 
                          className="action-btn delete"
                          onClick={() => handleDeleteProblem(problem.id)}
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'create' && (
        <div className="section-content">
          <div className="section-header">
            <h2>{isEditing ? '✏️ 编辑题目' : '➕ 创建题目'}</h2>
            <button 
              className="secondary-btn"
              onClick={handleCancelEdit}
            >
              ← 返回题目列表
            </button>
          </div>
          
          <div className="problem-form">
            <div className="form-row">
              <div className="form-group">
                <label>题目标题：<span className="required-mark">*</span></label>
                <input 
                  type="text" 
                  placeholder="请输入题目标题"
                  value={problemForm.title}
                  onChange={(e) => setProblemForm(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              
              <div className="form-group">
                <label>题目类型：<span className="required-mark">*</span></label>
                <select 
                  value={problemForm.type}
                  onChange={(e) => handleProblemTypeChange(e.target.value)}
                >
                  <option value="programming">编程题</option>
                  <option value="choice">选择题</option>
                  <option value="judge">判断题</option>
                  <option value="short_answer">简答题</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>难度：<span className="required-mark">*</span></label>
                <select 
                  value={problemForm.difficulty}
                  onChange={(e) => setProblemForm(prev => ({ ...prev, difficulty: e.target.value }))}
                >
                  <option value="easy">简单</option>
                  <option value="medium">中等</option>
                  <option value="hard">困难</option>
                </select>
              </div>
              
              {problemForm.type === 'choice' && (
                <div className="form-group">
                  <label>选择类型：</label>
                  <div className="checkbox-group">
                    <label className="checkbox-label">
                      <input 
                        type="checkbox"
                        checked={problemForm.is_multiple_choice}
                        onChange={(e) => setProblemForm(prev => ({ 
                          ...prev, 
                          is_multiple_choice: e.target.checked 
                        }))}
                      />
                      <span>多选题</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
            
            <div className="form-group">
              <label>题目描述：<span className="required-mark">*</span></label>
              <textarea
                placeholder="请输入题目描述"
                value={problemForm.description}
                onChange={(e) => setProblemForm(prev => ({ ...prev, description: e.target.value }))}
                rows={6}
              />
            </div>

            {/* 选择题选项管理 */}
            {problemForm.type === 'choice' && (
              <div className="form-group">
                <label>选项：<span className="required-mark">*</span></label>
                <div className="choice-options">
                  {problemForm.options.map((option, index) => (
                    <div key={option.id} className="choice-option">
                      <div className="option-header">
                        <span className="option-label">选项 {String.fromCharCode(65 + index)}</span>
                        <div className="option-controls">
                          <label className="checkbox-label">
                            <input 
                              type="checkbox"
                              checked={option.is_correct}
                              onChange={() => toggleChoiceOptionCorrect(option.id)}
                            />
                            <span>正确答案</span>
                          </label>
                          {problemForm.options.length > 2 && (
                            <button 
                              type="button"
                              className="remove-option-btn"
                              onClick={() => removeChoiceOption(option.id)}
                            >
                              删除
                            </button>
                          )}
                        </div>
                      </div>
                      <input 
                        type="text" 
                        placeholder={`请输入选项 ${String.fromCharCode(65 + index)} 的内容`}
                        value={option.text}
                        onChange={(e) => updateChoiceOption(option.id, 'text', e.target.value)}
                        className="option-input"
                      />
                    </div>
                  ))}
                  <button 
                    type="button"
                    className="add-option-btn"
                    onClick={addChoiceOption}
                  >
                    + 添加选项
                  </button>
                </div>
                <small>至少需要2个选项，最多支持10个选项</small>
              </div>
            )}

            {/* 判断题选项管理 */}
            {problemForm.type === 'judge' && (
              <div className="form-group">
                <label>选项：<span className="required-mark">*</span></label>
                <div className="choice-options">
                  {problemForm.options.map((option, index) => (
                    <div key={option.id} className="choice-option">
                      <div className="option-header">
                        <span className="option-label">选项 {index + 1}</span>
                        <div className="option-controls">
                          <label className="checkbox-label">
                            <input 
                              type="checkbox"
                              checked={option.is_correct}
                              onChange={() => toggleChoiceOptionCorrect(option.id)}
                            />
                            <span>正确答案</span>
                          </label>
                        </div>
                      </div>
                      <input 
                        type="text" 
                        value={option.text}
                        onChange={(e) => updateChoiceOption(option.id, 'text', e.target.value)}
                        className="option-input"
                        readOnly
                      />
                      <small className="option-hint">判断题选项不可编辑</small>
                    </div>
                  ))}
                </div>
                <small>判断题固定为"正确"和"错误"两个选项，请选择其中一个作为正确答案</small>
              </div>
            )}
            
            {/* 简答题答案 */}
            {problemForm.type === 'short_answer' && (
              <div className="form-group">
                <label>答案：<span className="required-mark">*</span></label>
                <textarea
                  placeholder="请输入简答题的标准答案"
                  value={problemForm.answer}
                  onChange={(e) => setProblemForm(prev => ({ ...prev, answer: e.target.value }))}
                  rows={6}
                />
                <small>请提供详细的答案内容，供学生参考和教师评分使用</small>
              </div>
            )}
            
            {/* 编程题相关字段 */}
            {problemForm.type === 'programming' && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>测试用例：<span className="required-mark">*</span></label>
                    <textarea
                      placeholder="请输入测试用例，每行一个"
                      value={problemForm.test_cases}
                      onChange={(e) => setProblemForm(prev => ({ ...prev, test_cases: e.target.value }))}
                      rows={4}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>期望输出：<span className="required-mark">*</span></label>
                    <textarea
                      placeholder="请输入期望输出，每行一个"
                      value={problemForm.expected_output}
                      onChange={(e) => setProblemForm(prev => ({ ...prev, expected_output: e.target.value }))}
                      rows={4}
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>时间限制：<span className="required-mark">*</span></label>
                    <input 
                      type="number" 
                      placeholder="请输入时间限制（毫秒）"
                      value={problemForm.time_limit}
                      onChange={(e) => setProblemForm(prev => ({ ...prev, time_limit: parseInt(e.target.value) || 1000 }))}
                      min="100"
                      max="10000"
                    />
                    <small>单位：毫秒，范围：100-10000</small>
                  </div>
                  
                  <div className="form-group">
                    <label>内存限制：<span className="required-mark">*</span></label>
                    <input 
                      type="number" 
                      placeholder="请输入内存限制（MB）"
                      value={problemForm.memory_limit}
                      onChange={(e) => setProblemForm(prev => ({ ...prev, memory_limit: parseInt(e.target.value) || 128 }))}
                      min="16"
                      max="512"
                    />
                    <small>单位：MB，范围：16-512</small>
                  </div>
                </div>
              </>
            )}
            
            <div className="form-actions">
              <button 
                className="submit-btn"
                onClick={handleCreateProblem}
                disabled={loading || !problemForm.title || !problemForm.description || 
                  (problemForm.type === 'programming' && (!problemForm.test_cases || !problemForm.expected_output)) ||
                  (problemForm.type === 'choice' && (problemForm.options.length < 2 || 
                    problemForm.options.some(option => !option.text) || 
                    problemForm.correct_answers.length === 0)) ||
                  (problemForm.type === 'judge' && problemForm.correct_answers.length !== 1) ||
                  (problemForm.type === 'short_answer' && !problemForm.answer)}
              >
                {loading ? (isEditing ? '更新中...' : '创建中...') : (isEditing ? '更新题目' : '创建题目')}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'ai' && (
        <AIProblemGenerationPage />
      )}
    </div>
  );

  // 课程查看标签页渲染函数（只读功能）
  const renderCoursesTab = () => (
    <div className="tab-content">
      <div className="sub-tabs">
        <button 
          className={`sub-tab-btn ${activeSubTab === 'list' ? 'active' : ''}`}
          onClick={() => {
            setActiveSubTab('list');
            // 如果当前在课程详情页，清除课程详情状态
            if (activeSubTab === 'detail') {
              setEditingCourse(null);
            }
            // 清除添加学生上下文
            setAddingStudentContext('');
          }}
        >
          课程列表
        </button>
        <button 
          className={`sub-tab-btn ${activeSubTab === 'detail' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('detail')}
          style={{ display: (editingCourse && activeSubTab === 'detail') ? 'inline-block' : 'none' }}
        >
          课程详情
        </button>
        <button 
          className={`sub-tab-btn ${activeSubTab === 'add-student-to-course' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('add-student-to-course')}
          style={{ display: (editingCourse && activeSubTab === 'detail') ? 'inline-block' : 'none' }}
        >
          添加学生
        </button>
      </div>

      {activeSubTab === 'list' && (
        <div className="section-content">
          <div className="section-header">
            <h2>我的课程</h2>
            <div className="section-info">
              <p>💡 点击任意课程卡片即可查看详情、管理学生和布置作业</p>
            </div>
          </div>
          
          <div className="courses-grid">
            {courses.length === 0 ? (
              <div className="empty-state">
                <p>暂无课程，请联系管理员添加课程</p>
              </div>
            ) : (
              courses.map(course => (
                <div 
                  key={course.id} 
                  className="course-card"
                  onClick={() => handleViewCourseDetail(course.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="course-header">
                    <h3>{course.name}</h3>
                    <span className="course-status active">进行中</span>
                  </div>
                  <div className="course-info">
                    <p><strong>教学班：</strong>{course.class_name}</p>
                    <p><strong>专业：</strong>{course.major_name}</p>
                    <p><strong>学校：</strong>{course.school_name}</p>
                    <p><strong>学生数量：</strong>{course.student_count || 0}人</p>
                    <p><strong>创建时间：</strong>{formatDate(course.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'detail' && editingCourse && (
        <div className="section-content">
          <div className="section-header">
            <h2>📚 课程详情：{editingCourse.name}</h2>
            <button 
              className="secondary-btn"
              onClick={() => {
                setActiveSubTab('list');
                setEditingCourse(null);
              }}
            >
              ← 返回课程列表
            </button>
          </div>
          
          <div className="course-detail">
            <div className="course-info-section">
              <h3>课程基本信息</h3>
              <div className="info-grid">
                <div className="info-item">
                  <label>课程名称：</label>
                  <span>{editingCourse.name}</span>
                </div>
                <div className="info-item">
                  <label>课程描述：</label>
                  <span>{editingCourse.description}</span>
                </div>
                <div className="info-item">
                  <label>教学班：</label>
                  <span>{editingCourse.class_name}</span>
                </div>
                <div className="info-item">
                  <label>专业：</label>
                  <span>{editingCourse.major_name}</span>
                </div>
                <div className="info-item">
                  <label>学校：</label>
                  <span>{editingCourse.school_name}</span>
                </div>
                <div className="info-item">
                  <label>学生数量：</label>
                  <span>{editingCourse.student_count || 0}人</span>
                </div>
                <div className="info-item">
                  <label>创建时间：</label>
                  <span>{formatDate(editingCourse.created_at)}</span>
                </div>
              </div>
            </div>

            <div className="course-students-section">
              <div className="section-header">
                <h3>教学班学生</h3>
                <button 
                  className="add-btn"
                  onClick={() => {
                    // 设置添加学生上下文为课程详情页
                    setAddingStudentContext('course-detail');
                    setActiveSubTab('add-student-to-course');
                  }}
                >
                  添加学生
                </button>
              </div>
              <div className="students-table">
                <table>
                  <thead>
                    <tr>
                      <th>学号</th>
                      <th>姓名</th>
                      <th>邮箱</th>
                      <th>状态</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // 获取当前课程的所有学生
                      const courseStudents = [];
                      
                      // 1. 添加原本属于该教学班的学生
                      const originalStudents = users.filter(user => 
                        user.class_id === editingCourse.class_id && user.role === 'student'
                      );
                      courseStudents.push(...originalStudents);
                      
                      // 2. 添加通过关联关系添加的学生
                      const relatedStudents = studentClassRelations
                        .filter(relation => relation.course_id === editingCourse.id)
                        .map(relation => {
                          // 查找学生的完整信息
                          const studentInfo = users.find(user => user.id === relation.student_id);
                          return {
                            ...studentInfo,
                            // 使用关联关系中的信息作为后备
                            name: studentInfo ? studentInfo.name : relation.student_name,
                            username: studentInfo ? studentInfo.username : relation.student_no,
                            // 标记这是通过关联关系添加的学生
                            isRelatedStudent: true,
                            relationId: `${relation.student_id}_${relation.course_id}`
                          };
                        });
                      courseStudents.push(...relatedStudents);
                      
                      if (courseStudents.length === 0) {
                        return (
                          <tr>
                            <td colSpan="5">
                              <div className="empty-state">
                                <p>该教学班暂无学生</p>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      
                      return courseStudents.map(student => (
                        <tr key={student.id || student.relationId}>
                          <td>{student.username}</td>
                          <td>{student.name}</td>
                          <td>{student.email || '-'}</td>
                          <td>
                            <span className={`status-badge ${student.isRelatedStudent ? 'related' : 'original'}`}>
                              {student.isRelatedStudent ? '已添加' : '原班级'}
                            </span>
                          </td>
                          <td>
                            {student.isRelatedStudent && (
                              <button 
                                className="action-btn delete"
                                onClick={() => handleRemoveStudentFromCourse(student.relationId)}
                              >
                                移除
                              </button>
                            )}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="course-assignments-section">
              <div className="section-header">
                <h3>已布置作业</h3>
                <button 
                  className="add-btn"
                  onClick={() => {
                    // 自动设置当前课程ID到作业表单
                    setAssignmentForm(prev => ({
                      ...prev,
                      course_id: editingCourse.id
                    }));
                    // 设置编辑作业上下文为课程详情页
                    setEditingAssignmentContext('course-detail');
                    setActiveSubTab('create-assignment');
                  }}
                >
                  布置作业
                </button>
              </div>
              <div className="assignments-table">
                <table>
                  <thead>
                    <tr>
                      <th>作业名称</th>
                      <th>描述</th>
                      <th>截止时间</th>
                      <th>状态</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.filter(assignment => assignment.course_id === editingCourse.id).map(assignment => (
                      <tr key={assignment.id}>
                        <td>{assignment.name}</td>
                        <td>{assignment.description}</td>
                        <td>{formatDate(assignment.due_date)}</td>
                        <td>
                          <span className={`status-badge ${assignment.is_active ? 'active' : 'inactive'}`}>
                            {assignment.is_active ? '进行中' : '已结束'}
                          </span>
                        </td>
                        <td>
                          <button 
                            className="action-btn edit"
                            onClick={() => handleEditAssignment(assignment)}
                          >
                            编辑
                          </button>
                          <button 
                            className="action-btn delete"
                            onClick={() => handleDeleteAssignment(assignment.id)}
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {assignments.filter(assignment => assignment.course_id === editingCourse.id).length === 0 && (
                  <div className="empty-state">
                    <p>该课程暂无作业</p>
                  </div>
                )}
              </div>
            </div>

            {/* 作业创建表单 */}
            {activeSubTab === 'create-assignment' && (
              <div className="course-assignment-form">
                <div className="section-header">
                  <h3>📝 布置作业（{editingCourse.name}）</h3>
                  <button 
                    className="secondary-btn"
                    onClick={() => setActiveSubTab('detail')}
                  >
                    ← 返回课程详情
                  </button>
                </div>
                
                <div className="assignment-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>作业名称：<span className="required-mark">*</span></label>
                      <input 
                        type="text" 
                        placeholder="请输入作业名称"
                        value={assignmentForm.name}
                        onChange={(e) => setAssignmentForm(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>课程：</label>
                      <input 
                        type="text" 
                        value={editingCourse.name}
                        disabled
                        className="disabled-input"
                      />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>作业描述：<span className="required-mark">*</span></label>
                    <textarea
                      placeholder="请输入作业描述"
                      value={assignmentForm.description}
                      onChange={(e) => setAssignmentForm(prev => ({ ...prev, description: e.target.value }))}
                      rows={4}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>作业要求：<span className="required-mark">*</span></label>
                    <textarea
                      placeholder="请输入作业要求"
                      value={assignmentForm.requirements}
                      onChange={(e) => setAssignmentForm(prev => ({ ...prev, requirements: e.target.value }))}
                      rows={4}
                    />
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>截止时间：<span className="required-mark">*</span></label>
                      <input 
                        type="datetime-local" 
                        value={assignmentForm.due_date}
                        onChange={(e) => setAssignmentForm(prev => ({ ...prev, due_date: e.target.value }))}
                      />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>选择题目：</label>
                    <div className="problem-selection">
                      {problems.map(problem => (
                        <label key={problem.id} className="problem-checkbox">
                          <input 
                            type="checkbox" 
                            value={problem.id}
                            checked={assignmentForm.problem_ids.includes(problem.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAssignmentForm(prev => ({ 
                                  ...prev, 
                                  problem_ids: [...prev.problem_ids, problem.id] 
                                }));
                              } else {
                                setAssignmentForm(prev => ({ 
                                  ...prev, 
                                  problem_ids: prev.problem_ids.filter(id => id !== problem.id) 
                                }));
                              }
                            }}
                          />
                          <span className="problem-title">{problem.title}</span>
                          <span className={`difficulty-badge ${problem.difficulty}`}>
                            {problem.difficulty === 'easy' ? '简单' : 
                             problem.difficulty === 'medium' ? '中等' : '困难'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div className="form-actions">
                    <button 
                      className="submit-btn"
                      onClick={handleCreateAssignment}
                      disabled={loading || !assignmentForm.name || !assignmentForm.description || !assignmentForm.requirements || !assignmentForm.due_date || !assignmentForm.course_id}
                    >
                      {loading ? '创建中...' : '布置作业'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 添加学生到课程的表单 */}
            {activeSubTab === 'add-student-to-course' && editingCourse && (
              <div className="section-content">
                <div className="section-header">
                  <h3>👥 添加学生到课程：{editingCourse.name}</h3>
                  <button 
                    className="secondary-btn"
                    onClick={() => setActiveSubTab('detail')}
                  >
                    ← 返回课程详情
                  </button>
                </div>
                
                <div className="add-student-to-course-form">
                  <div className="form-help">
                    <p>请选择要添加到该课程的学生：</p>
                    <p>注意：只能添加已存在的学生账号</p>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>学号：<span className="required-mark">*</span></label>
                      <input 
                        type="text" 
                        placeholder="请输入学号"
                        value={addStudentForm.student_no}
                        onChange={(e) => setAddStudentForm(prev => ({ ...prev, student_no: e.target.value }))}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>姓名：<span className="required-mark">*</span></label>
                      <input 
                        type="text" 
                        placeholder="请输入学生姓名"
                        value={addStudentForm.name}
                        onChange={(e) => setAddStudentForm(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                  </div>
                  
                  <div className="form-actions">
                    <button 
                      className="submit-btn"
                      onClick={handleAddStudentToCourse}
                      disabled={loading || !addStudentForm.student_no || !addStudentForm.name}
                    >
                      {loading ? '添加中...' : '添加学生到课程'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // 学生相关处理函数
  const handleAddStudent = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      await registerStudent(addStudentForm);
      setSuccess('学生账号创建成功！');
      
      // 重置表单
      setAddStudentForm({
        student_no: '',
        name: '',
        password: '',
        email: '',
        phone: '',
        school_id: '',
        department_id: '',
        major_id: '',
        class_id: ''
      });
      
      // 刷新用户列表
      const usersData = await getUsers(1, 50, 'student');
      setUsers(usersData.users);
      
      // 切换到学生列表
      setActiveSubTab('list');
      
    } catch (error) {
      setError(error.response?.data?.error || '创建学生账号失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEditStudentClick = (user) => {
    setEditingUser(user);
    setEditForm({
      email: user.email || '',
      phone: user.phone || '',
      school_id: user.school_id || '',
      major_id: user.major_id || '',
      class_id: user.class_id || '',
      new_password: ''
    });
    setError('');
    setSuccess('');
  };

  const handleSaveStudent = async () => {
    if (!editingUser) return;
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await updateUser(editingUser.id, editForm);
      setSuccess('学生信息已更新');
      // 刷新列表
      const usersData = await getUsers(1, 50, 'student');
      setUsers(usersData.users);
      setEditingUser(null);
    } catch (error) {
      setError(error.response?.data?.error || '更新学生信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEditStudent = () => {
    setEditingUser(null);
    setEditForm({ email: '', phone: '', school_id: '', major_id: '', class_id: '', new_password: '' });
  };

  const handleDeleteStudent = async (userId) => {
    if (!window.confirm('确定要删除该学生吗？此操作不可恢复。')) return;
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      await deleteUser(userId);
      setSuccess('学生已删除');
      const usersData = await getUsers(1, 50, 'student');
      setUsers(usersData.users);
    } catch (error) {
      setError(error.response?.data?.error || '删除学生失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudentSchoolChange = async (schoolId) => {
    setAddStudentForm(prev => ({ 
      ...prev, 
      school_id: schoolId, 
      department_id: '', 
      major_id: '', 
      class_id: '' 
    }));
    
    // 不再重置全局的departments、majors和classes数组
    // 这些数组应该保持完整，用于学生列表显示
  };

  const handleAddStudentDepartmentChange = async (departmentId) => {
    setAddStudentForm(prev => ({ 
      ...prev, 
      department_id: departmentId, 
      major_id: '', 
      class_id: '' 
    }));
    
    // 不再重置全局的majors和classes数组
    // 这些数组应该保持完整，用于学生列表显示
  };

  const handleAddStudentMajorChange = async (majorId) => {
    setAddStudentForm(prev => ({ 
      ...prev, 
      major_id: majorId, 
      class_id: '' 
    }));
    
    // 不再重置全局的classes数组
    // 这个数组应该保持完整，用于学生列表显示
  };

  // 选择题选项管理函数
  const addChoiceOption = () => {
    setProblemForm(prev => {
      // 计算下一个可用的字母ID
      const existingIds = prev.options.map(option => option.id);
      let nextId = 'A';
      for (let i = 0; i < 26; i++) {
        const candidateId = String.fromCharCode(65 + i); // A, B, C, D...
        if (!existingIds.includes(candidateId)) {
          nextId = candidateId;
          break;
        }
      }
      
      return {
        ...prev,
        options: [...prev.options, { id: nextId, text: '', is_correct: false }]
      };
    });
  };

  const removeChoiceOption = (optionId) => {
    setProblemForm(prev => ({
      ...prev,
      options: prev.options.filter(option => option.id !== optionId)
    }));
  };

  const updateChoiceOption = (optionId, field, value) => {
    setProblemForm(prev => ({
      ...prev,
      options: prev.options.map(option => 
        option.id === optionId ? { ...option, [field]: value } : option
      )
    }));
  };

  const toggleChoiceOptionCorrect = (optionId) => {
    setProblemForm(prev => {
      let updatedOptions;
      
      if (prev.type === 'judge') {
        // 判断题：单选模式，点击一个选项时取消其他选项
        updatedOptions = prev.options.map(option => ({
          ...option,
          is_correct: option.id === optionId ? !option.is_correct : false
        }));
      } else {
        // 选择题：多选模式，可以同时选择多个选项
        updatedOptions = prev.options.map(option => 
          option.id === optionId ? { ...option, is_correct: !option.is_correct } : option
        );
      }
      
      // 更新正确答案数组 - 统一使用选项ID
      const correctAnswers = updatedOptions
        .filter(option => option.is_correct)
        .map(option => option.id);
      
      return {
        ...prev,
        options: updatedOptions,
        correct_answers: correctAnswers
      };
    });
  };

  const handleProblemTypeChange = (type) => {
    setProblemForm(prev => {
      if (type === 'choice') {
        // 切换到选择题时，初始化至少两个选项
        return {
          ...prev,
          type,
          options: [
            { id: 'A', text: '', is_correct: false },
            { id: 'B', text: '', is_correct: false }
          ],
          correct_answers: [],
          is_multiple_choice: false
        };
      } else if (type === 'judge') {
        // 切换到判断题时，初始化两个固定选项
        return {
          ...prev,
          type,
          options: [
            { id: 'A', text: '正确', is_correct: false },
            { id: 'B', text: '错误', is_correct: false }
          ],
          correct_answers: [],
          is_multiple_choice: false
        };
      } else if (type === 'short_answer') {
        // 切换到简答题时，清空选项相关字段，添加答案字段
        return {
          ...prev,
          type,
          options: [],
          correct_answers: [],
          is_multiple_choice: false,
          answer: '' // 简答题答案
        };
      } else {
        // 切换到其他题型时，清空选择题相关字段
        return {
          ...prev,
          type,
          options: [],
          correct_answers: [],
          is_multiple_choice: false
        };
      }
    });
  };

  // 获取当前选中学校对应的专业列表（用于选择器显示）
  const getCurrentSchoolMajors = () => {
    if (!selectedSchool) return [];
    return majors.filter(major => major.school_id === selectedSchool);
  };

  // 获取当前选中专业对应的班级列表（用于选择器显示）
  const getCurrentMajorClasses = () => {
    if (!selectedMajor) return [];
    
    const majorId = selectedMajor;
    const filteredClasses = classes.filter(classItem => {
      const classMajorId = classItem.major_id;
      const isMatch = classMajorId === majorId || classMajorId === parseInt(majorId) || parseInt(classMajorId) === majorId;
      return isMatch;
    });
    
    return filteredClasses;
  };

  // 获取添加学生表单中选中学校对应的专业列表
  const getAddStudentSchoolMajors = () => {
    if (!addStudentForm.school_id) return [];
    
    const schoolId = addStudentForm.school_id;
    const filteredMajors = majors.filter(major => {
      const majorSchoolId = major.school_id;
      const isMatch = majorSchoolId === schoolId || majorSchoolId === parseInt(schoolId) || parseInt(majorSchoolId) === schoolId;
      return isMatch;
    });
    
    return filteredMajors;
  };

  // 获取添加学生表单中选中学校对应的院部列表
  const getAddStudentSchoolDepartments = () => {
    if (!addStudentForm.school_id) return [];
    
    const schoolId = addStudentForm.school_id;
    const filteredDepartments = departments.filter(department => {
      const deptSchoolId = department.school_id;
      const isMatch = deptSchoolId === schoolId || deptSchoolId === parseInt(schoolId) || parseInt(deptSchoolId) === schoolId;
      return isMatch;
    });
    
    return filteredDepartments;
  };

  // 获取添加学生表单中选中院部对应的专业列表
  const getAddStudentDepartmentMajors = () => {
    if (!addStudentForm.department_id) return [];
    
    const departmentId = addStudentForm.department_id;
    const filteredMajors = majors.filter(major => {
      const majorDeptId = major.department_id;
      const isMatch = majorDeptId === departmentId || majorDeptId === parseInt(departmentId) || parseInt(majorDeptId) === departmentId;
      return isMatch;
    });
    
    return filteredMajors;
  };

  // 获取添加学生表单中选中专业对应的班级列表
  const getAddStudentMajorClasses = () => {
    if (!addStudentForm.major_id) return [];
    
    const majorId = addStudentForm.major_id;
    const filteredClasses = classes.filter(classItem => {
      const classMajorId = classItem.major_id;
      const isMatch = classMajorId === majorId || classMajorId === parseInt(majorId) || parseInt(classMajorId) === majorId;
      return isMatch;
    });
    
    return filteredClasses;
  };

  // 获取编辑学生表单中选中学校对应的专业列表
  const getEditStudentSchoolMajors = () => {
    if (!editForm.school_id) return [];
    
    const schoolId = editForm.school_id;
    const filteredMajors = majors.filter(major => {
      const majorSchoolId = major.school_id;
      const isMatch = majorSchoolId === schoolId || majorSchoolId === parseInt(schoolId) || parseInt(majorSchoolId) === schoolId;
      return isMatch;
    });
    
    return filteredMajors;
  };

  // 获取编辑学生表单中选中专业对应的班级列表
  const getEditStudentMajorClasses = () => {
    if (!editForm.major_id) return [];
    
    const majorId = editForm.major_id;
    const filteredClasses = classes.filter(classItem => {
      const classMajorId = classItem.major_id;
      const isMatch = classMajorId === majorId || classMajorId === parseInt(majorId) || parseInt(classMajorId) === majorId;
      return isMatch;
    });
    
    return filteredClasses;
  };

  // 获取当前选中学校对应的院部列表
  const getCurrentSchoolDepartments = () => {
    if (!selectedSchool) return [];
    
    const schoolId = selectedSchool;
    const filteredDepartments = departments.filter(department => {
      const deptSchoolId = department.school_id;
      const isMatch = deptSchoolId === schoolId || deptSchoolId === parseInt(schoolId) || parseInt(deptSchoolId) === schoolId;
      return isMatch;
    });
    
    return filteredDepartments;
  };

  // 获取当前选中院部对应的专业列表
  const getCurrentDepartmentMajors = () => {
    if (!selectedDepartment) return [];
    
    const departmentId = selectedDepartment;
    const filteredMajors = majors.filter(major => {
      const majorDeptId = major.department_id;
      const isMatch = majorDeptId === departmentId || majorDeptId === parseInt(departmentId) || parseInt(majorDeptId) === departmentId;
      return isMatch;
    });
    
    return filteredMajors;
  };





  return (
    <div className="teacher-dashboard">
      <div className="dashboard-header">
        <h1>教师管理控制台</h1>
      </div>
      
      <div className="dashboard-tabs">
        <button 
          className={`tab-btn ${activeTab === 'students' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('students');
            setActiveSubTab('list');
          }}
        >
          学生管理
        </button>
        <button 
          className={`tab-btn ${activeTab === 'problems' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('problems');
            setActiveSubTab('list');
          }}
        >
          题目管理
        </button>
        <button 
          className={`tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('courses');
            setActiveSubTab('list');
            // 清除课程详情状态
            setEditingCourse(null);
            setEditingAssignmentContext('');
            setAddingStudentContext('');
          }}
        >
          我的课程
        </button>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      {activeTab === 'students' && renderStudentsTab()}
      {activeTab === 'problems' && renderProblemsTab()}
      {activeTab === 'courses' && renderCoursesTab()}
      
      {/* 独立的布置作业表单面板 */}
      {activeTab === 'courses' && activeSubTab === 'create-assignment' && editingCourse && (
        <div className="tab-content">
          <div className="section-header">
            <h3>📝 布置作业（{editingCourse.name}）</h3>
            <button 
              className="secondary-btn"
              onClick={() => setActiveSubTab('detail')}
            >
              ← 返回课程详情
            </button>
          </div>
          
          <div className="assignment-form">
            <div className="form-row">
              <div className="form-group">
                <label>作业名称：<span className="required-mark">*</span></label>
                <input 
                  type="text" 
                  placeholder="请输入作业名称"
                  value={assignmentForm.name}
                  onChange={(e) => setAssignmentForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div className="form-group">
                <label>课程：</label>
                <input 
                  type="text" 
                  value={editingCourse.name}
                  disabled
                  className="disabled-input"
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>作业描述：<span className="required-mark">*</span></label>
              <textarea
                placeholder="请输入作业描述"
                value={assignmentForm.description}
                onChange={(e) => setAssignmentForm(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
              />
            </div>
            
            <div className="form-group">
              <label>作业要求：<span className="required-mark">*</span></label>
              <textarea
                placeholder="请输入作业要求"
                value={assignmentForm.requirements}
                onChange={(e) => setAssignmentForm(prev => ({ ...prev, requirements: e.target.value }))}
                rows={4}
              />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>截止时间：<span className="required-mark">*</span></label>
                <input 
                  type="datetime-local" 
                  value={assignmentForm.due_date}
                  onChange={(e) => setAssignmentForm(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>选择题目：</label>
              <div className="problem-selection">
                {problems.map(problem => (
                  <label key={problem.id} className="problem-checkbox">
                    <input 
                      type="checkbox" 
                      value={problem.id}
                      checked={assignmentForm.problem_ids.includes(problem.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAssignmentForm(prev => ({ 
                            ...prev, 
                            problem_ids: [...prev.problem_ids, problem.id] 
                          }));
                        } else {
                          setAssignmentForm(prev => ({ 
                            ...prev, 
                            problem_ids: prev.problem_ids.filter(id => id !== problem.id) 
                          }));
                        }
                      }}
                    />
                    <span className="problem-title">{problem.title}</span>
                    <span className={`difficulty-badge ${problem.difficulty}`}>
                      {problem.difficulty === 'easy' ? '简单' : 
                       problem.difficulty === 'medium' ? '中等' : '困难'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="form-actions">
              <button 
                className="submit-btn"
                onClick={handleCreateAssignment}
                disabled={loading || !assignmentForm.name || !assignmentForm.description || !assignmentForm.requirements || !assignmentForm.due_date || !assignmentForm.course_id}
              >
                {loading ? '创建中...' : '布置作业'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 独立的添加学生到课程表单面板 */}
      {activeTab === 'courses' && activeSubTab === 'add-student-to-course' && editingCourse && (
        <div className="tab-content">
          <div className="section-header">
            <h3>👥 添加学生到课程：{editingCourse.name}</h3>
            <button 
              className="secondary-btn"
              onClick={() => setActiveSubTab('detail')}
            >
              ← 返回课程详情
            </button>
          </div>
          
          <div className="add-student-to-course-form">
            <div className="form-help">
              <p>请选择要添加到该课程的学生：</p>
              <p>注意：只能添加已存在的学生账号</p>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label>学号：<span className="required-mark">*</span></label>
                <input 
                  type="text" 
                  placeholder="请输入学号"
                  value={addStudentForm.student_no}
                  onChange={(e) => setAddStudentForm(prev => ({ ...prev, student_no: e.target.value }))}
                />
              </div>
              
              <div className="form-group">
                <label>姓名：<span className="required-mark">*</span></label>
                <input 
                  type="text" 
                  placeholder="请输入学生姓名"
                  value={addStudentForm.name}
                  onChange={(e) => setAddStudentForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="form-actions">
              <button 
                className="submit-btn"
                onClick={handleAddStudentToCourse}
                disabled={loading || !addStudentForm.student_no || !addStudentForm.name}
              >
                {loading ? '添加中...' : '添加学生到课程'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 编辑学生表单 - 全局显示 */}
      {editingUser && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>编辑学生：{editingUser.name}（学号{editingUser.username}）</h3>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>邮箱：</label>
                  <input type="email" value={editForm.email} onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>手机号：</label>
                  <input type="tel" value={editForm.phone} onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>学校：</label>
                  <select value={editForm.school_id} onChange={(e) => {
                    const val = e.target.value;
                    setEditForm(prev => ({ ...prev, school_id: val, major_id: '', class_id: '' }));
                  }}>
                    <option value="">请选择学校</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>专业：</label>
                  <select value={editForm.major_id} onChange={(e) => {
                    const val = e.target.value;
                    setEditForm(prev => ({ ...prev, major_id: val, class_id: '' }));
                  }} disabled={!editForm.school_id}>
                    <option value="">请选择专业</option>
                    {getEditStudentSchoolMajors().map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>班级：</label>
                  <select value={editForm.class_id} onChange={(e) => setEditForm(prev => ({ ...prev, class_id: e.target.value }))} disabled={!editForm.major_id}>
                    <option value="">请选择班级</option>
                    {getEditStudentMajorClasses().map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>重置密码（可选）：</label>
                  <input type="password" value={editForm.new_password} onChange={(e) => setEditForm(prev => ({ ...prev, new_password: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-btn" onClick={handleCancelEditStudent}>取消</button>
              <button className="submit-btn" onClick={handleSaveStudent} disabled={loading}>{loading ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboardPage;
