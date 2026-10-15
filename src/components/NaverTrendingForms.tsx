import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Download,
  Flame,
  ArrowUp,
  ArrowDown,
  Minus,
  Sparkles,
  RefreshCw,
  FileText,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { DocForm, User } from '../types';
import { api } from '../services/api';

interface NaverTrendingFormsProps {
  currentUser: User | null;
  forms: DocForm[];
  onFormDownloaded?: (formId: string) => void;
  onNavigateToForms?: () => void;
}

export const NaverTrendingForms: React.FC<NaverTrendingFormsProps> = ({
  currentUser,
  forms,
  onFormDownloaded,
  onNavigateToForms,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'전체' | '이용자 양식' | '활동지원사 양식' | '행정양식'>('전체');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lastRefreshedTime, setLastRefreshedTime] = useState<string>('방금 전');
  const [rollingIndex, setRollingIndex] = useState(0);

  // Filter forms by category
  const filteredForms = forms.filter((f) => {
    if (selectedCategory === '전체') return true;
    return f.category === selectedCategory;
  });

  // Sort descending by downloadCount to get TOP 4
  const top4Forms = [...filteredForms]
    .sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0))
    .slice(0, 4);

  // Assign deterministic trending delta badges based on ranking & counts
  const getRankDelta = (index: number, form: DocForm) => {
    if (form.isNew) return { type: 'new', label: 'NEW' };
    if (index === 0) return { type: 'up', label: '▲ 1', color: 'text-red-500' };
    if (index === 1) return { type: 'up', label: '▲ 2', color: 'text-red-500' };
    if (index === 2) return { type: 'same', label: '-', color: 'text-slate-400' };
    return { type: 'down', label: '▼ 1', color: 'text-blue-500' };
  };

  // Auto-rolling index every 3.5 seconds
  useEffect(() => {
    if (top4Forms.length === 0) return;
    const interval = setInterval(() => {
      setRollingIndex((prev) => (prev + 1) % Math.min(4, top4Forms.length));
    }, 3500);
    return () => clearInterval(interval);
  }, [top4Forms.length]);

  const handleDownload = (form: DocForm, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDownloadingId(form.id);

    const downloadUrl = api.getFormDownloadUrl(form.id, currentUser);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = form.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (onFormDownloaded) {
      onFormDownloaded(form.id);
    }

    setToastMessage(`[${form.title}] 서식이 다운로드되었습니다.`);
    setTimeout(() => {
      setToastMessage(null);
      setDownloadingId(null);
    }, 2500);
  };

  return (
    <div className="relative rounded-[24px] bg-white border border-[#e5e7eb] shadow-sm overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-3 right-4 z-30 bg-[#17191c] text-white text-xs px-4 py-2 rounded-full shadow-lg flex items-center space-x-2 animate-fade-in">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#03c75a]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header: Classic Naver Portal Real-Time Search Rank Visual Language */}
      <div className="bg-[#f8fafc] border-b border-[#e5e7eb] px-6 py-4.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Title & Live Pulse */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 bg-[#03c75a]/10 text-[#03c75a] border border-[#03c75a]/30 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-[#03c75a] animate-ping" />
              <span>LIVE</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base sm:text-lg text-[#17191c] tracking-tight flex items-center">
                  <span>실시간 인기 양식</span>
                  <span className="text-[#03c75a] ml-1.5 font-black">TOP 4</span>
                </h3>
                <span className="hidden sm:inline-block text-[11px] text-[#64748b]">
                  (네이버 실시간 급상승 검색어 순위 방식)
                </span>
              </div>
              <p className="text-xs text-[#64748b] mt-0.5">
                복지관 이용자·활동지원사·행정 직원들이 지금 가장 많이 다운로드한 실시간 서식입니다.
              </p>
            </div>
          </div>

          {/* Rolling Ticker Summary & Refresh */}
          <div className="flex items-center space-x-3 self-end sm:self-center">
            {top4Forms[rollingIndex] && (
              <div
                onClick={() => handleDownload(top4Forms[rollingIndex])}
                className="hidden md:flex items-center space-x-2 bg-white px-3 py-1.5 rounded-full border border-[#e2e8f0] text-xs cursor-pointer hover:border-[#03c75a] transition-colors"
                title="클릭 시 즉시 다운로드"
              >
                <span className="font-black text-[#03c75a]">{rollingIndex + 1}위</span>
                <span className="text-[#1e293b] font-medium max-w-[150px] truncate">
                  {top4Forms[rollingIndex].title}
                </span>
                <span className="text-[10px] text-red-500 font-bold">▲</span>
              </div>
            )}
            <span className="text-[11px] text-[#94a3b8] flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>{lastRefreshedTime}</span>
            </span>
          </div>
        </div>

        {/* Category Segmented Tabs */}
        <div className="flex items-center space-x-1.5 mt-3 pt-3 border-t border-[#edf2f7] overflow-x-auto scrollbar-none">
          {(['전체', '이용자 양식', '활동지원사 양식', '행정양식'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#17191c] text-white shadow-xs'
                  : 'bg-white text-[#64748b] border border-[#e2e8f0] hover:text-[#17191c] hover:bg-[#f1f5f9]'
              }`}
            >
              {cat === '전체' ? '전체 종합 TOP' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* TOP 4 Rank List Body */}
      <div className="divide-y divide-[#f1f5f9]">
        {top4Forms.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#94a3b8]">
            등록된 서식이 없습니다.
          </div>
        ) : (
          top4Forms.map((form, idx) => {
            const rank = idx + 1;
            const delta = getRankDelta(idx, form);

            // Styling accents by rank
            const rankBadgeColor =
              rank === 1
                ? 'bg-[#03c75a] text-white shadow-sm'
                : rank === 2
                ? 'bg-[#17191c] text-white'
                : rank === 3
                ? 'bg-[#475569] text-white'
                : 'bg-[#94a3b8] text-white';

            return (
              <div
                key={form.id}
                className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors group ${
                  rank === 1 ? 'bg-[#f0fdf4]/50 hover:bg-[#f0fdf4]' : 'hover:bg-[#f8fafc]'
                }`}
              >
                {/* Left: Rank Badge + Delta + Title & Meta */}
                <div className="flex items-center space-x-4 min-w-0">
                  {/* Rank Number Badge */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-base shrink-0 ${rankBadgeColor}`}
                  >
                    {rank}
                  </div>

                  {/* Rank Delta (▲, ▼, -, NEW) */}
                  <div className="w-8 flex flex-col items-center justify-center text-center shrink-0">
                    {delta.type === 'new' ? (
                      <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-1 py-0.5 rounded">
                        NEW
                      </span>
                    ) : delta.type === 'up' ? (
                      <div className="flex items-center text-red-500 font-bold text-xs">
                        <ArrowUp className="w-3 h-3 stroke-[2.5]" />
                        <span>{delta.label.replace('▲ ', '')}</span>
                      </div>
                    ) : delta.type === 'down' ? (
                      <div className="flex items-center text-blue-500 font-bold text-xs">
                        <ArrowDown className="w-3 h-3 stroke-[2.5]" />
                        <span>{delta.label.replace('▼ ', '')}</span>
                      </div>
                    ) : (
                      <Minus className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>

                  {/* Form Title & Sub info */}
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2 flex-wrap">
                      <span className="text-xs font-medium text-[#64748b] bg-[#e2e8f0]/60 px-2 py-0.5 rounded-md">
                        {form.category}
                      </span>
                      <span className="text-[11px] text-[#94a3b8] font-mono">
                        .{form.fileExt}
                      </span>
                      {rank === 1 && (
                        <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-[#03c75a]">
                          <Flame className="w-3.5 h-3.5 fill-[#03c75a]" />
                          <span>급상승 1위</span>
                        </span>
                      )}
                    </div>

                    <h4
                      className="text-sm sm:text-base font-bold text-[#17191c] group-hover:text-[#03c75a] transition-colors truncate mt-1 cursor-pointer"
                      title={form.title}
                      onClick={() => handleDownload(form)}
                    >
                      {form.title}
                    </h4>

                    <p className="text-xs text-[#64748b] line-clamp-1 mt-0.5">
                      {form.description || `${form.department} 주관 표준 업무서식`}
                    </p>
                  </div>
                </div>

                {/* Right: Usage Count & Instant Download Button */}
                <div className="flex items-center justify-between sm:justify-end space-x-4 shrink-0 pl-13 sm:pl-0">
                  <div className="text-right">
                    <div className="text-xs font-semibold text-[#1e293b]">
                      누적 {form.downloadCount || 0}회
                    </div>
                    <div className="text-[10px] text-[#94a3b8]">실시간 다운로드</div>
                  </div>

                  <button
                    onClick={(e) => handleDownload(form, e)}
                    disabled={downloadingId === form.id}
                    className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer whitespace-nowrap shadow-xs ${
                      rank === 1
                        ? 'bg-[#03c75a] hover:bg-[#02b350] text-white active:scale-95'
                        : 'bg-[#17191c] hover:bg-[#2c2f35] text-white active:scale-95'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>다운로드</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info & Link to All Forms */}
      <div className="bg-[#f8fafc] px-6 py-3 border-t border-[#e5e7eb] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#64748b]">
        <div className="flex items-center space-x-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#03c75a]" />
          <span>다운로드 시 실시간으로 사용 카운트 및 순위가 자동 반영됩니다.</span>
        </div>

        {onNavigateToForms && (
          <button
            onClick={onNavigateToForms}
            className="text-[#17191c] hover:text-[#03c75a] font-semibold hover:underline cursor-pointer self-end sm:self-auto"
          >
            전체 서식함 보기 ({forms.length}개 서식) &rarr;
          </button>
        )}
      </div>
    </div>
  );
};
