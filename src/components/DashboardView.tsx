import React, { useState, useEffect } from 'react';
import {
  Files,
  Scissors,
  FileText,
  MessageSquare,
  ShieldAlert,
  Download,
  ArrowRight,
  Layers,
  Edit3,
  CheckCircle2,
  Building,
  UserCheck,
  ThumbsUp,
  MessageCircle,
  Sparkles,
  Unlock,
} from 'lucide-react';
import { DocForm, Post, User } from '../types';
import { api } from '../services/api';
import { NaverTrendingForms } from './NaverTrendingForms';

interface DashboardViewProps {
  currentUser: User | null;
  onNavigate: (tab: string) => void;
  pendingUsersCount: number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  onNavigate,
  pendingUsersCount,
}) => {
  const [forms, setForms] = useState<DocForm[]>([]);
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDashData = async () => {
    try {
      setIsLoading(true);
      const [formsData, postsData] = await Promise.all([api.getForms(), api.getPosts()]);
      setForms(formsData);
      setRecentPosts(postsData.slice(0, 4));
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashData();
  }, []);

  const handleFormDownloaded = (formId: string) => {
    setForms((prev) =>
      prev.map((f) => (f.id === formId ? { ...f, downloadCount: (f.downloadCount || 0) + 1 } : f))
    );
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case '반영완료':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case '검토중':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case '답변완료':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-8">
      {/* Admin Alert Banner (Only for admin) */}
      {currentUser?.role === 'admin' && pendingUsersCount > 0 && (
        <div className="rounded-[20px] bg-[#fbe1d1] border border-[#f5c6aa] p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3 text-[#5d2a1a]">
            <div className="w-10 h-10 rounded-full bg-[#5d2a1a] text-[#fbe1d1] flex items-center justify-center font-bold shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold flex items-center space-x-2">
                <span>신규 등록 직원 가입 승인 요청이 있습니다</span>
                <span className="bg-[#5d2a1a] text-white text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {pendingUsersCount}건 대기
                </span>
              </div>
              <p className="text-xs text-[#5d2a1a]/80 mt-0.5 font-normal">
                신규 직원이 복지관 업무 포털에 로그인할 수 있도록 관리자 센터에서 승인해 주세요.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('admin')}
            className="px-5 py-2 rounded-full bg-[#17191c] hover:bg-[#2c2f35] text-white text-xs font-semibold cursor-pointer whitespace-nowrap transition-all shadow-xs"
          >
            승인 관리 바로가기 &rarr;
          </button>
        </div>
      )}

      {/* Hero Section */}
      <div className="rounded-[24px] bg-white border border-[#e5e7eb] p-8 sm:p-10 relative overflow-hidden flex flex-col lg:flex-row items-start justify-between gap-8 shadow-xs">
        <div className="max-w-2xl space-y-4">
          <div className="text-xs uppercase tracking-widest text-[#94a3b8] font-semibold flex items-center space-x-2">
            <span>Suwon Community Rehabilitation Center</span>
            <span>·</span>
            <span className="text-[#03c75a] font-bold">스마트 통합 행정</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#17191c] tracking-tight leading-[1.25]">
            수원시장애인종합복지관 <br />
            <span className="text-[#475569] font-normal">스마트 문서지원</span> 포털
          </h1>

          <p className="text-[#64748b] text-sm sm:text-base leading-relaxed max-w-xl">
            복지관 실무자와 활동지원사를 위한 공식 행정 문서 처리 포털입니다. PDF 가공, 도장 직인 추출, 이용자 및 활동지원사 서식을 언제든 안전하고 신속하게 활용하세요.
          </p>

          <div className="flex items-center space-x-3 pt-2">
            <button
              onClick={() => onNavigate('forms')}
              className="px-5 py-2.5 rounded-full bg-[#17191c] hover:bg-[#2c2f35] text-white text-xs sm:text-sm font-semibold cursor-pointer transition-all shadow-xs flex items-center space-x-1.5"
            >
              <FileText className="w-4 h-4" />
              <span>서식함 바로가기</span>
            </button>
            <button
              onClick={() => onNavigate('pdf-tools')}
              className="px-5 py-2.5 rounded-full bg-white hover:bg-[#f8fafc] text-[#17191c] border border-[#d1d5db] text-xs sm:text-sm font-semibold cursor-pointer transition-all"
            >
              PDF 통합도구 열기 &rarr;
            </button>
          </div>
        </div>

        {/* Floating Stat Widget */}
        <div className="w-full lg:w-80 rounded-[20px] bg-[#f8fafc] border border-[#e2e8f0] p-6 space-y-3 shrink-0">
          <div className="text-xs uppercase tracking-wider text-[#94a3b8] font-bold flex items-center justify-between">
            <span>포털 가동 현황</span>
            <span className="flex items-center space-x-1 text-[#03c75a]">
              <span className="w-2 h-2 rounded-full bg-[#03c75a] animate-pulse" />
              <span className="text-[11px] font-bold">정상 가동</span>
            </span>
          </div>
          <div className="text-xl font-bold text-[#17191c]">안전 문서망 가동 중</div>
          <div className="text-xs text-[#64748b] space-y-1.5 leading-relaxed pt-1 border-t border-[#e2e8f0]">
            <div className="flex items-center justify-between">
              <span>보관 표준 서식</span>
              <span className="font-bold text-[#17191c]">{forms.length}종 영구보존</span>
            </div>
            <div className="flex items-center justify-between">
              <span>실시간 인기 집계</span>
              <span className="font-bold text-[#03c75a]">TOP 4 실시간 갱신</span>
            </div>
            <div className="flex items-center justify-between">
              <span>계정 보안 체계</span>
              <span className="font-bold text-[#17191c]">관리자 승인제 운용</span>
            </div>
          </div>
        </div>
      </div>

      {/* ★ KEY FEATURE: NAVER REAL-TIME TRENDING FORMS TOP 4 WIDGET ★ */}
      <div>
        <NaverTrendingForms
          currentUser={currentUser}
          forms={forms}
          onFormDownloaded={handleFormDownloaded}
          onNavigateToForms={() => onNavigate('forms')}
        />
      </div>

      {/* 4 Core Quick Action Cards */}
      <div>
        <div className="text-xs uppercase tracking-widest text-[#94a3b8] font-semibold mb-3">
          Core Work Stations
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: PDF Merge & Split */}
          <div
            onClick={() => onNavigate('pdf-tools')}
            className="rounded-[20px] bg-white border border-[#e5e7eb] p-6 cursor-pointer group flex flex-col justify-between hover:border-[#17191c] hover:shadow-md transition-all"
          >
            <div>
              <div className="w-11 h-11 rounded-2xl bg-[#f1f5f9] text-[#17191c] flex items-center justify-center font-bold mb-4 group-hover:bg-[#17191c] group-hover:text-white transition-colors">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[#17191c] mb-1.5">
                PDF 파일 합치기 & 분리
              </h3>
              <p className="text-xs text-[#64748b] leading-relaxed">
                복수의 첨부서류를 하나의 PDF로 병합하거나 특정 페이지만 손쉽게 분리 추출합니다.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-[#f1f5f9] flex items-center text-xs text-[#17191c] font-semibold">
              <span>도구 열기</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 2: PDF Content Redact & Edit */}
          <div
            onClick={() => onNavigate('pdf-tools')}
            className="rounded-[20px] bg-white border border-[#e5e7eb] p-6 cursor-pointer group flex flex-col justify-between hover:border-[#17191c] hover:shadow-md transition-all"
          >
            <div>
              <div className="w-11 h-11 rounded-2xl bg-[#f1f5f9] text-[#17191c] flex items-center justify-center font-bold mb-4 group-hover:bg-[#17191c] group-hover:text-white transition-colors">
                <Edit3 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[#17191c] mb-1.5">
                PDF 내용 삭제 및 수정
              </h3>
              <p className="text-xs text-[#64748b] leading-relaxed">
                민감정보 화이트아웃/블랙아웃 삭제, 페이지 회전/삭제, 텍스트 입력 및 도장을 날인합니다.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-[#f1f5f9] flex items-center text-xs text-[#17191c] font-semibold">
              <span>수정 시작</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 3: Decrypt Tools (엑셀·한글·PDF 암호해제) */}
          <div
            onClick={() => onNavigate('decrypt-tools')}
            className="rounded-[20px] bg-white border-2 border-[#03c75a]/40 p-6 cursor-pointer group flex flex-col justify-between hover:border-[#03c75a] hover:shadow-md transition-all relative overflow-hidden"
          >
            <div className="absolute top-2 right-2 bg-[#03c75a] text-white text-[9px] font-black px-2 py-0.5 rounded-full">
              NEW
            </div>
            <div>
              <div className="w-11 h-11 rounded-2xl bg-[#03c75a]/10 text-[#03c75a] flex items-center justify-center font-bold mb-4 group-hover:bg-[#03c75a] group-hover:text-white transition-colors">
                <Unlock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[#17191c] mb-1.5">
                엑셀·한글·PDF 암호해제
              </h3>
              <p className="text-xs text-[#64748b] leading-relaxed">
                암호화된 엑셀, 한글 배포용 문서, 인쇄·편집 제한 PDF의 보안을 원클릭으로 해제합니다.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-[#f1f5f9] flex items-center text-xs text-[#03c75a] font-bold">
              <span>암호해제 시작</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 4: Background Removal (누끼따기) */}
          <div
            onClick={() => onNavigate('background-removal')}
            className="rounded-[20px] bg-white border border-[#e5e7eb] p-6 cursor-pointer group flex flex-col justify-between hover:border-[#17191c] hover:shadow-md transition-all"
          >
            <div>
              <div className="w-11 h-11 rounded-2xl bg-[#f1f5f9] text-[#17191c] flex items-center justify-center font-bold mb-4 group-hover:bg-[#17191c] group-hover:text-white transition-colors">
                <Scissors className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[#17191c] mb-1.5">
                도장·서명 누끼따기
              </h3>
              <p className="text-xs text-[#64748b] leading-relaxed">
                종이에 날인된 복지관 직인 및 서명에서 종이 배경을 제거하여 투명 PNG로 추출합니다.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-[#f1f5f9] flex items-center text-xs text-[#17191c] font-semibold">
              <span>누끼 제거</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 5: Korean Forms (한글 양식함) */}
          <div
            onClick={() => onNavigate('forms')}
            className="rounded-[20px] bg-white border border-[#e5e7eb] p-6 cursor-pointer group flex flex-col justify-between hover:border-[#17191c] hover:shadow-md transition-all"
          >
            <div>
              <div className="w-11 h-11 rounded-2xl bg-[#f1f5f9] text-[#17191c] flex items-center justify-center font-bold mb-4 group-hover:bg-[#17191c] group-hover:text-white transition-colors">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[#17191c] mb-1.5">
                복지관 한글 양식함
              </h3>
              <p className="text-xs text-[#64748b] leading-relaxed">
                이용자 양식, 활동지원사 양식, 행정양식을 언제든 원클릭으로 다운로드하여 사용합니다.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-[#f1f5f9] flex items-center text-xs text-[#17191c] font-semibold">
              <span>서식함 보기</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* Program User Suggestions Feed: 프로그램 이용자 건의사항 */}
      <div className="rounded-[24px] bg-white border border-[#e5e7eb] p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#f1f5f9] gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-lg text-[#17191c]">프로그램 이용자 건의사항</h3>
              <span className="text-[11px] font-semibold text-[#03c75a] bg-[#03c75a]/10 px-2 py-0.5 rounded-full">
                포털 개선의견
              </span>
            </div>
            <p className="text-xs text-[#64748b] mt-0.5">
              ※ 여기서 '이용자 건의사항'은 기관 복지관 이용자가 아니라, 본 문서 포털 프로그램을 이용하는 이용자(직원 및 사용자)의 기능 개선 및 서식 요청입니다.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onNavigate('board')}
              className="px-4 py-2 rounded-full bg-[#17191c] hover:bg-[#2c2f35] text-white text-xs font-semibold cursor-pointer transition-all whitespace-nowrap shadow-xs"
            >
              건의 작성 & 전체보기 &rarr;
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          {recentPosts.map((post) => (
            <div
              key={post.id}
              onClick={() => onNavigate('board')}
              className="p-4 rounded-[18px] bg-[#f8fafc] hover:bg-[#f1f5f9] border border-[#e2e8f0] cursor-pointer transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[11px] font-semibold text-[#64748b] bg-white border border-[#e2e8f0] px-2 py-0.5 rounded-md">
                      {post.category}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(
                        post.status
                      )}`}
                    >
                      {post.status || '접수완료'}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#94a3b8]">
                    {new Date(post.createdAt).toLocaleDateString('ko-KR')}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-[#17191c] group-hover:text-[#03c75a] transition-colors line-clamp-1">
                  {post.title}
                </h4>

                <p className="text-xs text-[#64748b] line-clamp-2 mt-1 leading-relaxed">
                  {post.content}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-[#e2e8f0]/60 flex items-center justify-between text-[11px] text-[#64748b]">
                <span className="font-medium text-[#1e293b]">
                  {post.authorName} · {post.department}
                </span>
                <div className="flex items-center space-x-3 text-[#94a3b8]">
                  <span className="flex items-center space-x-1">
                    <ThumbsUp className="w-3 h-3" />
                    <span>{post.likes || 0}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <MessageCircle className="w-3 h-3" />
                    <span>{post.comments?.length || 0}</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
