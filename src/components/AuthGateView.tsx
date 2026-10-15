import React, { useState } from 'react';
import { Building2, Shield, AlertCircle, CheckCircle2, ArrowRight, UserPlus, KeyRound } from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';

interface AuthGateViewProps {
  onLoginSuccess: (user: User) => void;
}

export const AuthGateView: React.FC<AuthGateViewProps> = ({ onLoginSuccess }) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // Login form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Register form
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regDepartment, setRegDepartment] = useState('기획행정팀');
  const [regPosition, setRegPosition] = useState('사회복지사');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [regPhone, setRegPhone] = useState('');

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const res = await api.login(username, password);
      if (res.user) {
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setErrorMessage(err.message || '로그인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (regPassword !== regPasswordConfirm) {
      setErrorMessage('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (regPassword.length < 4) {
      setErrorMessage('비밀번호는 최소 4자리 이상 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.register({
        username: regUsername,
        password: regPassword,
        name: regName,
        department: regDepartment,
        position: regPosition,
        phone: regPhone,
      });

      setSuccessMessage(res.message);
      setRegUsername('');
      setRegPassword('');
      setRegPasswordConfirm('');
      setRegName('');
      setRegPhone('');
      setTimeout(() => {
        setTab('login');
      }, 2500);
    } catch (err: any) {
      setErrorMessage(err.message || '가입 신청 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafb] flex flex-col justify-between selection:bg-[#fbe1d1] selection:text-[#5d2a1a]">
      {/* Top Header Bar */}
      <header className="w-full max-w-6xl mx-auto px-6 py-8 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-[#17191c] text-white flex items-center justify-center font-serif text-lg">
            수
          </div>
          <div>
            <span className="font-semibold text-base text-[#17191c] tracking-tight block">
              수원시장애인종합복지관
            </span>
            <span className="text-xs text-[#777b86]">스마트 문서업무 지원 시스템</span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs text-[#777b86] font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span>보안 인증 포털</span>
        </div>
      </header>

      {/* Main Editorial Hero & Auth Section */}
      <main className="w-full max-w-6xl mx-auto px-6 py-6 flex-1 flex flex-col lg:flex-row items-center justify-between gap-12">
        {/* Left Editorial Branding */}
        <div className="lg:w-1/2 space-y-6 lg:pl-6">
          <div className="inline-block text-xs uppercase tracking-widest text-[#979799] font-medium">
            Internal Document Suite
          </div>

          <h1 className="font-steep-serif text-3xl sm:text-4xl lg:text-5xl text-[#17191c] leading-[1.25] tracking-tight">
            <span className="whitespace-nowrap">수원시장애인종합복지관</span> <br />
            <span className="italic text-[#5d2a1a] whitespace-nowrap">스마트 문서지원</span> 포털
          </h1>

          <p className="text-[#777b86] text-base sm:text-lg leading-relaxed max-w-lg">
            기관 내부 공문서 및 결재 서식, PDF 통합 가공(병합·분할·수정), 직인 도장 누끼 제거 및 이용자 건의사항을 안전하게 처리하는 통합 전산망입니다.
          </p>

          {/* Steep Blush Peach Editorial Accent Card */}
          <div className="steep-card-peach p-6 max-w-lg shadow-xs">
            <div className="text-xs uppercase tracking-widest text-[#5d2a1a]/70 font-semibold mb-1">
              보안 인증 및 접근 권한 안내
            </div>
            <p className="text-sm text-[#5d2a1a] font-medium leading-relaxed">
              본 시스템은 개인정보 및 기관 행정 문서를 보호하기 위해 <strong>인증된 직원만 접속이 허용</strong>됩니다. 신규 가입 직원은 <strong>시스템관리자의 최종 승인</strong> 후 로그인이 활성화됩니다.
            </p>
          </div>
        </div>

        {/* Right Authentication Card */}
        <div className="lg:w-5/12 w-full max-w-md">
          <div className="steep-floating-artifact p-8 bg-white border border-[#ececec]">
            {/* Tab Switcher */}
            <div className="flex p-1 bg-[#f2f2f3] rounded-full mb-6 text-sm font-medium">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`flex-1 py-2 rounded-full transition-all text-xs font-semibold ${
                  tab === 'login'
                    ? 'bg-[#17191c] text-white shadow-xs'
                    : 'text-[#777b86] hover:text-[#17191c]'
                }`}
              >
                로그인
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`flex-1 py-2 rounded-full transition-all text-xs font-semibold ${
                  tab === 'register'
                    ? 'bg-[#17191c] text-white shadow-xs'
                    : 'text-[#777b86] hover:text-[#17191c]'
                }`}
              >
                신규 등록 신청
              </button>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-4 p-3.5 bg-[#fff1f0] border border-[#ffccc7] rounded-[16px] text-[#cf1322] text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="mb-4 p-3.5 bg-[#f6ffed] border border-[#b7eb8f] rounded-[16px] text-[#389e0d] text-xs flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{successMessage}</span>
              </div>
            )}

            {/* Login Form */}
            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#777b86] mb-1.5">
                    계정 아이디
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="아이디 입력"
                    className="steep-input w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#777b86] mb-1.5">
                    비밀번호
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호 입력"
                    className="steep-input w-full"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-steep-primary w-full py-3.5 text-sm mt-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? '인증 확인 중...' : '시스템 접속하기'}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setTab('register')}
                    className="text-xs text-[#777b86] hover:text-[#17191c] font-medium transition-colors"
                  >
                    복지관 신규 입사자이신가요? <span className="underline">신규 등록 신청</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#777b86] mb-1">성명 (실명)</label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="홍길동"
                      className="steep-input w-full text-xs py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#777b86] mb-1">아이디</label>
                    <input
                      type="text"
                      required
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder="아이디"
                      className="steep-input w-full text-xs py-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#777b86] mb-1">소속 부서</label>
                    <select
                      value={regDepartment}
                      onChange={(e) => setRegDepartment(e.target.value)}
                      className="steep-input w-full text-xs py-2"
                    >
                      <option value="기획행정팀">기획행정팀</option>
                      <option value="상담사례관리팀">상담사례관리팀</option>
                      <option value="기능향상지원팀">기능향상지원팀</option>
                      <option value="평생교육지원팀">평생교육지원팀</option>
                      <option value="직업지원팀">직업지원팀</option>
                      <option value="활동지원팀">활동지원팀</option>
                      <option value="운영지원팀">운영지원팀</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#777b86] mb-1">직급/직책</label>
                    <input
                      type="text"
                      value={regPosition}
                      onChange={(e) => setRegPosition(e.target.value)}
                      placeholder="사회복지사 등"
                      className="steep-input w-full text-xs py-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#777b86] mb-1">비밀번호</label>
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="4자리 이상"
                      className="steep-input w-full text-xs py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#777b86] mb-1">비밀번호 확인</label>
                    <input
                      type="password"
                      required
                      value={regPasswordConfirm}
                      onChange={(e) => setRegPasswordConfirm(e.target.value)}
                      placeholder="재입력"
                      className="steep-input w-full text-xs py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#777b86] mb-1">연락처 / 내선번호</label>
                  <input
                    type="text"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    className="steep-input w-full text-xs py-2"
                  />
                </div>

                <div className="text-[11px] text-[#777b86] bg-[#f2f2f3] p-2.5 rounded-[12px] leading-relaxed">
                  신규 등록 신청 접수 후 <strong>시스템관리자의 최종 승인</strong>이 완료되어야 시스템을 이용하실 수 있습니다.
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-steep-primary w-full py-3 text-xs mt-1 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? '신청 접수 중...' : '신규 등록 신청 완료'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-6 text-xs text-[#777b86] flex flex-col sm:flex-row items-center justify-between border-t border-[#ececec]">
        <span>© 2026 수원시장애인종합복지관 (Suwon Community Rehabilitation Center). All rights reserved.</span>
        <span className="mt-2 sm:mt-0">보안 감사 및 시스템관리자 승인 체계 가동 중</span>
      </footer>
    </div>
  );
};
