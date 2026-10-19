import React, { useState, useEffect } from 'react';
import {
  FileText,
  Files,
  LayoutDashboard,
  ShieldAlert,
  MessageSquare,
  LogOut,
  Building2,
  TrendingUp,
  Flame,
  ArrowUp,
  Clock,
} from 'lucide-react';
import { User, DocForm } from '../types';
import { api } from '../services/api';

interface HeaderProps {
  currentUser: User | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  pendingUsersCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  onLogout,
  pendingUsersCount,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [topForms, setTopForms] = useState<DocForm[]>([]);
  const [rollingIndex, setRollingIndex] = useState(0);

  // Load top forms for header real-time rolling ticker
  useEffect(() => {
    async function loadTopForms() {
      try {
        const forms = await api.getForms();
        const sorted = [...forms].sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0));
        setTopForms(sorted.slice(0, 4));
      } catch (e) {
        // ignore
      }
    }
    loadTopForms();
    const interval = setInterval(loadTopForms, 20000);
    return () => clearInterval(interval);
  }, []);

  // Cycle through 1위 ~ 4위 every 3.5 seconds
  useEffect(() => {
    if (topForms.length === 0) return;
    const timer = setInterval(() => {
      setRollingIndex((prev) => (prev + 1) % topForms.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [topForms.length]);

  const currentTrending = topForms[rollingIndex];

  return (
    <header className="bg-white border-b border-[#e5e7eb] sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Header Row */}
        <div className="flex items-center justify-between h-20 border-b border-[#f1f5f9] gap-4">
          {/* Institution Logo & Title */}
          <div
            className="flex items-center space-x-3.5 cursor-pointer select-none shrink-0"
            onClick={() => setActiveTab('dashboard')}
          >
            <div className="w-10 h-10 rounded-2xl bg-[#17191c] text-white flex items-center justify-center font-bold text-lg shadow-sm">
              수
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg text-[#17191c] tracking-tight">
                  수원시장애인종합복지관
                </span>
                <span className="text-[11px] text-[#03c75a] bg-[#03c75a]/10 border border-[#03c75a]/30 px-2.5 py-0.5 rounded-full font-bold">
                  스마트 문서포털
                </span>
              </div>
              <p className="text-xs text-[#64748b]">
                행정업무 포털 · PDF 편집 · 도장 직인 누끼 · 한글 표준 서식함
              </p>
            </div>
          </div>

          {/* Center: Classic Naver Style Real-Time Trending Search Ticker */}
          {currentTrending && (
            <div
              onClick={() => setActiveTab('dashboard')}
              className="hidden lg:flex items-center space-x-2.5 px-3.5 py-1.5 rounded-full bg-[#f8fafc] border border-[#e2e8f0] hover:border-[#03c75a] transition-all cursor-pointer group shadow-xs"
              title="클릭 시 실시간 인기 서식 순위로 이동"
            >
              <div className="flex items-center space-x-1 text-[#03c75a] text-[11px] font-black">
                <span className="w-1.5 h-1.5 rounded-full bg-[#03c75a] animate-ping" />
                <span>실시간 {rollingIndex + 1}위</span>
              </div>
              <span className="text-xs font-semibold text-[#1e293b] max-w-[180px] truncate group-hover:text-[#03c75a] transition-colors">
                {currentTrending.title}
              </span>
              <span className="text-[10px] text-red-500 font-bold flex items-center">
                <ArrowUp className="w-2.5 h-2.5 stroke-[3]" />
                <span>▲</span>
              </span>
            </div>
          )}

          {/* User Account Session Area */}
          <div className="flex items-center space-x-3 shrink-0">
            {currentUser && (
              <div className="flex items-center space-x-3 bg-[#f8fafc] px-4 py-2 rounded-full border border-[#e2e8f0]">
                <div className="flex flex-col text-right">
                  <div className="flex items-center space-x-1.5 justify-end">
                    <span className="text-xs font-bold text-[#17191c]">{currentUser.name}</span>
                    {isAdmin ? (
                      <span className="bg-[#17191c] text-white text-[10px] font-bold px-2 py-0.2 rounded-full">
                        시스템관리자
                      </span>
                    ) : (
                      <span className="bg-white text-[#64748b] text-[10px] font-medium px-2 py-0.2 rounded-full border border-[#cbd5e1]">
                        {currentUser.position || '직원'}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#64748b]">{currentUser.department || '소속부서'}</span>
                </div>

                <div className="h-5 w-px bg-[#cbd5e1]" />

                <button
                  onClick={onLogout}
                  title="로그아웃"
                  className="flex items-center space-x-1 text-xs text-[#64748b] hover:text-[#17191c] font-medium transition-colors px-2 py-1 rounded-full hover:bg-white cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">로그아웃</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto py-3 text-sm font-medium scrollbar-none">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-full transition-all whitespace-nowrap text-xs sm:text-sm cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-[#17191c] text-white shadow-xs font-bold'
                : 'text-[#64748b] hover:text-[#17191c] hover:bg-[#f1f5f9]'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>종합 대시보드</span>
          </button>

          <button
            onClick={() => setActiveTab('forms')}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-full transition-all whitespace-nowrap text-xs sm:text-sm cursor-pointer ${
              activeTab === 'forms'
                ? 'bg-[#17191c] text-white shadow-xs font-bold'
                : 'text-[#64748b] hover:text-[#17191c] hover:bg-[#f1f5f9]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>한글(HWP) 양식함</span>
          </button>

          <button
            onClick={() => setActiveTab('pdf-tools')}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-full transition-all whitespace-nowrap text-xs sm:text-sm cursor-pointer ${
              activeTab === 'pdf-tools'
                ? 'bg-[#17191c] text-white shadow-xs font-bold'
                : 'text-[#64748b] hover:text-[#17191c] hover:bg-[#f1f5f9]'
            }`}
          >
            <Files className="w-3.5 h-3.5" />
            <span>PDF 통합 도구함</span>
          </button>



          <button
            onClick={() => setActiveTab('board')}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-full transition-all whitespace-nowrap text-xs sm:text-sm cursor-pointer ${
              activeTab === 'board'
                ? 'bg-[#17191c] text-white shadow-xs font-bold'
                : 'text-[#64748b] hover:text-[#17191c] hover:bg-[#f1f5f9]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>프로그램 이용자 건의사항</span>
          </button>

          </div>
      </div>
    </header>
  );
};
