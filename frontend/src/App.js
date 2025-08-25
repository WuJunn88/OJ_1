import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminRegisterPage from './pages/AdminRegisterPage';
import SubmitPage from './pages/SubmitPage';
import ResultPage from './pages/ResultPage';
import ProblemListPage from './pages/ProblemListPage';
import ProblemDetailPage from './pages/ProblemDetailPage';
import TeacherDashboardPage from './pages/TeacherDashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import SubmissionsPage from './pages/SubmissionsPage';
import TestPage from './TestPage';
import './App.css';


// 简单的路由保护组件
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

function App() {
  const [auth, setAuth] = useState({
    user: JSON.parse(localStorage.getItem('user') || '{}'),
    isLoggedIn: !!localStorage.getItem('token')
  });

  useEffect(() => {
    const syncAuth = () => {
      setAuth({
        user: JSON.parse(localStorage.getItem('user') || '{}'),
        isLoggedIn: !!localStorage.getItem('token')
      });
    };
    window.addEventListener('storage', syncAuth);
    window.addEventListener('auth-changed', syncAuth);
    return () => {
      window.removeEventListener('storage', syncAuth);
      window.removeEventListener('auth-changed', syncAuth);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // 清理学生-课程关联关系数据
    localStorage.removeItem('studentClassRelations');
    window.dispatchEvent(new Event('auth-changed'));
    window.location.href = '/login';
  };

  return (
    <Router>
      <div className="app-container">
        {auth.isLoggedIn && (
          <nav className="navbar">
            <div className="container">
              <Link to="/" className="logo">OJ System</Link>
              <div className="nav-links">
                <Link to="/problems">题目列表</Link>
                <Link to="/submissions">提交记录</Link>
                {auth.user.role === 'teacher' && (
                  <>
                    <Link to="/teacher/dashboard">教师控制台</Link>
                  </>
                )}
                {auth.user.role === 'admin' && (
                  <>
                    <Link to="/admin/dashboard">管理员控制台</Link>
                  </>
                )}
                <div className="user-menu">
                  <span>欢迎, {auth.user.name}</span>
                  <button onClick={handleLogout} className="logout-btn">退出</button>
                </div>
              </div>
            </div>
          </nav>
        )}
        
        <main className="main-content">
          <div className="container">
            <Routes>
              <Route path="/test" element={<TestPage />} />
              <Route path="/login" element={!auth.isLoggedIn ? <LoginPage /> : <Navigate to="/problems" replace />} />
              <Route path="/register" element={!auth.isLoggedIn ? <RegisterPage /> : <Navigate to="/" replace />} />
              <Route path="/admin/register" element={!auth.isLoggedIn ? <AdminRegisterPage /> : <Navigate to="/" replace />} />
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/problems" element={
                <ProtectedRoute>
                  <ProblemListPage />
                </ProtectedRoute>
              } />
              <Route path="/problem/:problemId" element={
                <ProtectedRoute>
                  <ProblemDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/submit/:problemId" element={
                <ProtectedRoute>
                  <SubmitPage />
                </ProtectedRoute>
              } />
              <Route path="/result/:submissionId" element={
                <ProtectedRoute>
                  <ResultPage />
                </ProtectedRoute>
              } />
              <Route path="/submissions" element={
                <ProtectedRoute>
                  <SubmissionsPage />
                </ProtectedRoute>
              } />
              <Route path="/teacher/dashboard" element={
                <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                  <TeacherDashboardPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/dashboard" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboardPage />
                </ProtectedRoute>
              } />
            </Routes>
          </div>
        </main>
        
        {auth.isLoggedIn && (
          <footer className="footer">
            <div className="container">
              <p>© 2023 OJ System | 在线评测平台</p>
              <div className="footer-links">
                <a href="/">关于我们</a>
                <a href="/">帮助中心</a>
                <a href="/">联系我们</a>
              </div>
            </div>
          </footer>
        )}
      </div>
    </Router>
  );
}

export default App;