import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { AuthGateView } from './components/AuthGateView';
import { DashboardView } from './components/DashboardView';
import { PdfToolsView } from './components/PdfToolsView';
import { FormsView } from './components/FormsView';
import { BoardView } from './components/BoardView';
import { AdminView } from './components/AdminView';
import { User } from './types';
import { api } from './services/api';

export default function App() {
  // Current user state (persisted to localStorage)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('smart_doc_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [pendingUsersCount, setPendingUsersCount] = useState<number>(0);

  // Load pending users count for admin notification
  const refreshPendingCount = async () => {
    try {
      const users = await api.getUsers();
      const pending = users.filter((u) => u.status === 'pending').length;
      setPendingUsersCount(pending);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      refreshPendingCount();
      const timer = setInterval(() => {
        refreshPendingCount();
      }, 30000);
      return () => clearInterval(timer);
    }
  }, [currentUser]);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('smart_doc_user', JSON.stringify(user));
    } catch (e) {
      console.error(e);
    }
    if (user.role === 'admin') {
      refreshPendingCount();
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('smart_doc_user');
    setActiveTab('dashboard');
  };

  // FIRST SCREEN GATE: If not logged in, show the dedicated AuthGateView!
  if (!currentUser) {
    return <AuthGateView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#fafafb] flex flex-col font-sans text-[#17191c] selection:bg-[#fbe1d1] selection:text-[#5d2a1a]">
      {/* Top Header */}
      <Header
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        pendingUsersCount={pendingUsersCount}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            currentUser={currentUser}
            onNavigate={(tab) => setActiveTab(tab)}
            pendingUsersCount={pendingUsersCount}
          />
        )}

        {activeTab === 'pdf-tools' && (
          <PdfToolsView currentUser={currentUser} />
        )}

        {activeTab === 'forms' && (
          <FormsView
            currentUser={currentUser}
          />
        )}

        {activeTab === 'board' && (
          <BoardView
            currentUser={currentUser}
          />
        )}

        {activeTab === 'admin' && (
          <AdminView
            currentUser={currentUser}
            onRefreshPendingCount={refreshPendingCount}
          />
        )}
      </main>

      {/* Steep Editorial Quiet Footer */}
      <footer className="bg-white border-t border-[#ececec] text-[#777b86] py-10 mt-16 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-[#17191c] text-white flex items-center justify-center font-serif text-sm">
              수
            </div>
            <div>
              <span className="font-semibold text-[#17191c] block">수원시장애인종합복지관 스마트 문서지원 포털</span>
              <span className="text-[#979799] text-[11px] block mt-0.5">
                Suwon Community Rehabilitation Center for Persons with Disabilities · 보안 문서 작업 시스템
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center sm:space-x-4 text-[11px] text-[#777b86] gap-2">
            <div className="flex items-center space-x-2">
              <span>서식 영구보관 가동</span>
              <span>•</span>
              <span>관리자 승인 체계</span>
              <span>•</span>
              <span>활동 감사기록 암호화</span>
            </div>
            <button
              onClick={() => setActiveTab('admin')}
              className="text-[#94a3b8] hover:text-[#17191c] underline transition-colors cursor-pointer text-[11px] flex items-center space-x-1"
            >
              <span>관리자 센터 & 활동로그 확인</span>
              {pendingUsersCount > 0 && (
                <span className="px-1.5 py-0.2 bg-[#ef4444] text-white text-[9px] font-bold rounded-full">
                  {pendingUsersCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
