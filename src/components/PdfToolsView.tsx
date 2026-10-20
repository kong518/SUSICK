import React, { useState, useRef } from 'react';
import {
  Files,
  Scissors,
  Edit3,
  Upload,
  Download,
  Trash2,
  ArrowUp,
  ArrowDown,
  RotateCw,
  Plus,
  FileCheck,
  CheckSquare,
  Square,
  Layers,
  Stamp,
  Type,
  Eraser,
  RefreshCw,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { pdfHelper, RedactionBox, TextOverlay, StampOverlay } from '../utils/pdfHelper';
import { api } from '../services/api';
import { User } from '../types';

interface PdfToolsViewProps {
  currentUser: User | null;
  activeStampPng?: string | null;
}

interface MergeItem {
  id: string;
  name: string;
  size: number;
  pageCount: number;
  buffer: ArrayBuffer;
}

export const PdfToolsView: React.FC<PdfToolsViewProps> = ({ currentUser, activeStampPng }) => {
  const [activeSubTab, setActiveSubTab] = useState<'merge' | 'split' | 'edit'>('merge');

  // ==================== 1. MERGE STATE ====================
  const [mergeFiles, setMergeFiles] = useState<MergeItem[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeOutputName, setMergeOutputName] = useState('기관_통합문서.pdf');
  const mergeInputRef = useRef<HTMLInputElement>(null);

  const handleMergeFilesAdded = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const newItems: MergeItem[] = [];

    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files[i];
      if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) continue;
      const buffer = await file.arrayBuffer();
      try {
        const info = await pdfHelper.getPdfInfo(buffer);
        newItems.push({
          id: `merge-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 5)}`,
          name: file.name,
          size: file.size,
          pageCount: info.pageCount,
          buffer: buffer,
        });
      } catch (err) {
        console.error('Failed to parse pdf:', err);
      }
    }

    setMergeFiles((prev) => [...prev, ...newItems]);
    if (mergeInputRef.current) mergeInputRef.current.value = '';
  };

  const handleMoveMergeItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= mergeFiles.length) return;
    const updated = [...mergeFiles];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setMergeFiles(updated);
  };

  const handleRemoveMergeItem = (id: string) => {
    setMergeFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const handleExecuteMerge = async () => {
    if (mergeFiles.length < 2) {
      alert('합치려면 최소 2개 이상의 PDF 파일이 필요합니다.');
      return;
    }
    setIsMerging(true);
    try {
      const totalPages = mergeFiles.reduce((acc, f) => acc + f.pageCount, 0);
      const mergedBytes = await pdfHelper.mergePdfs(mergeFiles);
      const filename = mergeOutputName.endsWith('.pdf') ? mergeOutputName : `${mergeOutputName}.pdf`;
      pdfHelper.downloadBytes(mergedBytes, filename);

      await api.logClientAudit({
        userId: currentUser?.id,
        username: currentUser?.username,
        name: currentUser?.name,
        department: currentUser?.department,
        action: 'PDF_MERGE',
        category: 'PDF',
        details: `PDF ${mergeFiles.length}건 병합 완료 (총 ${totalPages}페이지) -> [${filename}]`,
      });
    } catch (err) {
      console.error(err);
      alert('PDF 병합 중 오류가 발생했습니다.');
    } finally {
      setIsMerging(false);
    }
  };

  // ==================== 2. SPLIT STATE ====================
  const [splitFile, setSplitFile] = useState<{ name: string; buffer: ArrayBuffer; pageCount: number } | null>(null);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [rangeInput, setRangeInput] = useState('');
  const [isSplitting, setIsSplitting] = useState(false);
  const splitInputRef = useRef<HTMLInputElement>(null);

  const handleSplitFileLoaded = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const buffer = await file.arrayBuffer();
    try {
      const info = await pdfHelper.getPdfInfo(buffer);
      setSplitFile({
        name: file.name,
        buffer,
        pageCount: info.pageCount,
      });
      // Select all by default
      const all = new Set<number>();
      for (let i = 0; i < info.pageCount; i++) all.add(i);
      setSelectedPages(all);
      setRangeInput(`1-${info.pageCount}`);
    } catch (err) {
      alert('PDF 파일을 읽을 수 없습니다.');
    }
    if (splitInputRef.current) splitInputRef.current.value = '';
  };

  const handleRangeInputChange = (val: string) => {
    setRangeInput(val);
    if (!splitFile) return;
    const parsed = pdfHelper.parsePageRangeString(val, splitFile.pageCount);
    setSelectedPages(new Set(parsed));
  };

  const togglePageSelect = (pageIdx: number) => {
    const updated = new Set(selectedPages);
    if (updated.has(pageIdx)) {
      updated.delete(pageIdx);
    } else {
      updated.add(pageIdx);
    }
    setSelectedPages(updated);
    const sorted = Array.from(updated).sort((a, b) => a - b);
    setRangeInput(sorted.map((p) => p + 1).join(', '));
  };

  const handleExecuteExtract = async () => {
    if (!splitFile || selectedPages.size === 0) {
      alert('추출할 페이지를 하나 이상 선택해주세요.');
      return;
    }
    setIsSplitting(true);
    try {
      const pageList = Array.from(selectedPages).sort((a, b) => a - b);
      const extractedBytes = await pdfHelper.extractPages(splitFile.buffer, pageList);
      const outName = `분리추출_${splitFile.name.replace('.pdf', '')}_(${pageList.map((p) => p + 1).join('_')}p).pdf`;
      pdfHelper.downloadBytes(extractedBytes, outName);

      await api.logClientAudit({
        userId: currentUser?.id,
        username: currentUser?.username,
        name: currentUser?.name,
        department: currentUser?.department,
        action: 'PDF_SPLIT',
        category: 'PDF',
        details: `PDF 분할 추출: [${splitFile.name}]에서 ${pageList.length}개 페이지 추출 (${pageList.map((p) => p + 1).join(',')}p)`,
      });
    } catch (err) {
      console.error(err);
      alert('PDF 분할 추출 중 오류가 발생했습니다.');
    } finally {
      setIsSplitting(false);
    }
  };

  // ==================== 3. EDIT & CONTENT DELETION STATE ====================
  const [editFile, setEditFile] = useState<{ name: string; buffer: ArrayBuffer; originalPageCount: number } | null>(null);
  const [pagesOrder, setPagesOrder] = useState<number[]>([]); // active pages (original indices)
  const [selectedEditPageIndex, setSelectedEditPageIndex] = useState<number>(0);
  const [pageRotations, setPageRotations] = useState<Record<number, number>>({});
  const [redactions, setRedactions] = useState<RedactionBox[]>([]);
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [stampOverlays, setStampOverlays] = useState<StampOverlay[]>([]);

  // Editing tools modes
  const [editTool, setEditTool] = useState<'select' | 'redact_white' | 'redact_black' | 'text' | 'stamp'>('select');
  const [newTextVal, setNewTextVal] = useState('원본대조필 (직인생략)');
  const [newTextColor, setNewTextColor] = useState<'black' | 'red' | 'blue'>('red');
  const [newTextSize, setNewTextSize] = useState(14);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const handleEditFileLoaded = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const buffer = await file.arrayBuffer();
    try {
      const info = await pdfHelper.getPdfInfo(buffer);
      setEditFile({
        name: file.name,
        buffer,
        originalPageCount: info.pageCount,
      });
      // Initial sequential page order
      setPagesOrder(Array.from({ length: info.pageCount }, (_, i) => i));
      setSelectedEditPageIndex(0);
      setPageRotations({});
      setRedactions([]);
      setTextOverlays([]);
      setStampOverlays([]);
    } catch (err) {
      alert('PDF 파일을 불러오지 못했습니다.');
    }
    if (editInputRef.current) editInputRef.current.value = '';
  };

  // Delete page in edit mode
  const handleDeletePage = (pageIdxToDelete: number) => {
    if (pagesOrder.length <= 1) {
      alert('최소 1개 이상의 페이지가 남아있어야 합니다.');
      return;
    }
    const updated = pagesOrder.filter((_, idx) => idx !== pageIdxToDelete);
    setPagesOrder(updated);
    // remove overlays on this page or adjust pageIndex
    setRedactions((prev) => prev.filter((r) => r.pageIndex !== pageIdxToDelete));
    setTextOverlays((prev) => prev.filter((t) => t.pageIndex !== pageIdxToDelete));
    setStampOverlays((prev) => prev.filter((s) => s.pageIndex !== pageIdxToDelete));

    if (selectedEditPageIndex >= updated.length) {
      setSelectedEditPageIndex(updated.length - 1);
    }
  };

  // Rotate page
  const handleRotatePage = (pageIdx: number) => {
    setPageRotations((prev) => {
      const current = prev[pageIdx] || 0;
      return { ...prev, [pageIdx]: (current + 90) % 360 };
    });
  };

  // Click on current page preview canvas to apply tool
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xRatio = Math.max(0, Math.min(1, x / rect.width));
    const yRatio = Math.max(0, Math.min(1, y / rect.height));

    if (editTool === 'redact_white' || editTool === 'redact_black') {
      const boxW = 0.25; // 25% of width
      const boxH = 0.05; // 5% of height
      const newBox: RedactionBox = {
        id: `redact-${Date.now()}`,
        pageIndex: selectedEditPageIndex,
        xRatio: Math.max(0, xRatio - boxW / 2),
        yRatio: Math.max(0, yRatio - boxH / 2),
        widthRatio: boxW,
        heightRatio: boxH,
        fillColor: editTool === 'redact_white' ? 'white' : 'black',
      };
      setRedactions((prev) => [...prev, newBox]);
    } else if (editTool === 'text') {
      const newText: TextOverlay = {
        id: `txt-${Date.now()}`,
        pageIndex: selectedEditPageIndex,
        xRatio,
        yRatio,
        text: newTextVal,
        fontSize: newTextSize,
        color: newTextColor,
      };
      setTextOverlays((prev) => [...prev, newText]);
    } else if (editTool === 'stamp') {
      if (!activeStampPng) {
        alert('먼저 [누끼따기] 메뉴에서 도장/서명의 배경을 제거하거나 도장을 준비해주세요.');
        return;
      }
      const stampW = 0.18;
      const stampH = 0.18;
      const newStamp: StampOverlay = {
        id: `stamp-${Date.now()}`,
        pageIndex: selectedEditPageIndex,
        xRatio: Math.max(0, xRatio - stampW / 2),
        yRatio: Math.max(0, yRatio - stampH / 2),
        widthRatio: stampW,
        heightRatio: stampH,
        pngBase64: activeStampPng,
      };
      setStampOverlays((prev) => [...prev, newStamp]);
    }
  };

  // Save modified PDF
  const handleSaveEditedPdf = async () => {
    if (!editFile || pagesOrder.length === 0) return;
    setIsSavingEdit(true);
    try {
      const editedBytes = await pdfHelper.editPdf(editFile.buffer, {
        pageOrder: pagesOrder,
        rotations: pageRotations,
        redactions,
        textOverlays,
        stampOverlays,
      });

      const outName = `수정완료_${editFile.name}`;
      pdfHelper.downloadBytes(editedBytes, outName);

      const deletedCount = editFile.originalPageCount - pagesOrder.length;
      await api.logClientAudit({
        userId: currentUser?.id,
        username: currentUser?.username,
        name: currentUser?.name,
        department: currentUser?.department,
        action: 'PDF_EDIT',
        category: 'PDF',
        details: `PDF 수정 완료: [${editFile.name}] (페이지삭제: ${deletedCount}건, 가림막(삭제): ${redactions.length}건, 텍스트/도장: ${textOverlays.length + stampOverlays.length}건)`,
      });
    } catch (err) {
      console.error(err);
      alert('PDF 수정 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Tool Selector */}
      <div className="steep-card-neutral p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-[#979799] font-medium mb-1">
              Document Processing
            </div>
            <h1 className="font-steep-serif text-3xl sm:text-4xl text-[#17191c]">
              PDF 통합 편집 및 가공 센터
            </h1>
            <p className="text-sm text-[#777b86] mt-2 font-normal max-w-2xl leading-relaxed">
              기관 공문서, 증빙서류, 보고서 PDF를 브라우저 내에서 안전하고 빠르게 합치기, 분리하기, 내용 삭제 및 수정할 수 있습니다.
            </p>
          </div>

          {/* Sub tabs (Steep Pill Style) */}
          <div className="flex items-center space-x-1.5 bg-[#f2f2f3] p-1.5 rounded-full self-start md:self-auto shrink-0">
            <button
              onClick={() => setActiveSubTab('merge')}
              className={`flex items-center space-x-1.5 px-5 py-2 text-xs sm:text-sm font-semibold rounded-full transition-all cursor-pointer ${
                activeSubTab === 'merge'
                  ? 'bg-[#17191c] text-white shadow-xs'
                  : 'text-[#777b86] hover:text-[#17191c]'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>1. PDF 합치기</span>
            </button>
            <button
              onClick={() => setActiveSubTab('split')}
              className={`flex items-center space-x-1.5 px-5 py-2 text-xs sm:text-sm font-semibold rounded-full transition-all cursor-pointer ${
                activeSubTab === 'split'
                  ? 'bg-[#17191c] text-white shadow-xs'
                  : 'text-[#777b86] hover:text-[#17191c]'
              }`}
            >
              <Scissors className="w-4 h-4" />
              <span>2. PDF 분리하기</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          SUB-TAB 1: PDF 합치기 (MERGE)
         ======================================================== */}
      {activeSubTab === 'merge' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left / Upload & Options */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h2 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
                <Upload className="w-4 h-4 text-blue-600" />
                <span>PDF 파일 추가</span>
              </h2>

              <label className="border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/50 hover:bg-blue-50/80 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all text-center">
                <Upload className="w-8 h-8 text-blue-500 mb-2" />
                <span className="text-sm font-bold text-blue-900">PDF 파일 선택 또는 드래그</span>
                <span className="text-xs text-slate-500 mt-1">복수의 PDF를 한 번에 추가할 수 있습니다</span>
                <input
                  ref={mergeInputRef}
                  type="file"
                  multiple
                  accept="application/pdf,.pdf"
                  onChange={handleMergeFilesAdded}
                  className="hidden"
                />
              </label>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  합쳐질 저장 파일명
                </label>
                <input
                  type="text"
                  value={mergeOutputName}
                  onChange={(e) => setMergeOutputName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800">💡 병합 안내</div>
                <p>• 우측 목록에서 화살표(▲▼)를 눌러 결합할 순서를 조정하세요.</p>
                <p>• 여러 부서의 증빙서류, 첨부문서를 하나로 묶을 때 편리합니다.</p>
              </div>

              <button
                disabled={mergeFiles.length < 2 || isMerging}
                onClick={handleExecuteMerge}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
              >
                {isMerging ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>병합 처리 중...</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-4 h-4" />
                    <span>PDF 하나로 합치기 ({mergeFiles.reduce((a, b) => a + b.pageCount, 0)}페이지)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right / File List */}
          <div className="lg:col-span-2">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs min-h-[380px] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-800 text-sm">합칠 PDF 목록</span>
                  <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {mergeFiles.length}개 파일
                  </span>
                </div>
                {mergeFiles.length > 0 && (
                  <button
                    onClick={() => setMergeFiles([])}
                    className="text-xs text-rose-500 hover:text-rose-700 font-semibold"
                  >
                    전체 비우기
                  </button>
                )}
              </div>

              {mergeFiles.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
                  <FileText className="w-12 h-12 mb-3 text-slate-300" />
                  <p className="font-medium text-slate-600 text-sm">추가된 PDF 파일이 없습니다.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    왼쪽의 파일 추가 박스를 클릭하여 합칠 문서들을 등록하세요.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[420px] pr-1">
                  {mergeFiles.map((file, idx) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-300 transition-all"
                    >
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="truncate">
                          <div className="text-sm font-semibold text-slate-800 truncate" title={file.name}>
                            {file.name}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center space-x-2">
                            <span>{(file.size / 1024).toFixed(1)} KB</span>
                            <span>•</span>
                            <span className="text-blue-600 font-medium">{file.pageCount} 페이지</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0 ml-2">
                        <button
                          onClick={() => handleMoveMergeItem(idx, 'up')}
                          disabled={idx === 0}
                          title="위로 이동"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 disabled:opacity-20"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMoveMergeItem(idx, 'down')}
                          disabled={idx === mergeFiles.length - 1}
                          title="아래로 이동"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 disabled:opacity-20"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveMergeItem(file.id)}
                          title="제거"
                          className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          SUB-TAB 2: PDF 분리하기 (SPLIT)
         ======================================================== */}
      {activeSubTab === 'split' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Options */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h2 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
                <Scissors className="w-4 h-4 text-blue-600" />
                <span>분리할 PDF 파일 선택</span>
              </h2>

              <label className="border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/50 hover:bg-indigo-50/80 rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all text-center">
                <Upload className="w-7 h-7 text-indigo-500 mb-2" />
                <span className="text-sm font-bold text-indigo-950">분리할 PDF 열기</span>
                <span className="text-xs text-slate-500 mt-1">파일을 선택하면 페이지별 분할 옵션이 활성화됩니다</span>
                <input
                  ref={splitInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleSplitFileLoaded}
                  className="hidden"
                />
              </label>

              {splitFile && (
                <div className="space-y-4 pt-2 border-t border-slate-100">
                  <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
                    <div className="font-bold text-xs text-indigo-900 truncate">{splitFile.name}</div>
                    <div className="text-xs text-indigo-700 mt-0.5">총 {splitFile.pageCount}페이지</div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      추출할 페이지 범위 지정
                    </label>
                    <input
                      type="text"
                      value={rangeInput}
                      onChange={(e) => handleRangeInputChange(e.target.value)}
                      placeholder="예: 1-3, 5, 8"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      우측 화면에서 페이지를 직접 클릭하거나, 위 입력창에 범위를 직접 입력하세요.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        const all = new Set<number>();
                        for (let i = 0; i < splitFile.pageCount; i++) all.add(i);
                        setSelectedPages(all);
                        setRangeInput(`1-${splitFile.pageCount}`);
                      }}
                      className="flex-1 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                    >
                      전체 선택
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPages(new Set());
                        setRangeInput('');
                      }}
                      className="flex-1 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
                    >
                      선택 해제
                    </button>
                  </div>

                  <button
                    disabled={selectedPages.size === 0 || isSplitting}
                    onClick={handleExecuteExtract}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer active:scale-[0.98]"
                  >
                    {isSplitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>추출 중...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>선택한 {selectedPages.size}페이지 분리 다운로드</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Visual Page Grid */}
          <div className="lg:col-span-2">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs min-h-[380px]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <span className="font-bold text-slate-800 text-sm">페이지 선택 그리드</span>
                {splitFile && (
                  <span className="text-xs text-slate-500">
                    총 <strong className="text-indigo-600">{selectedPages.size}</strong>개 페이지 선택됨
                  </span>
                )}
              </div>

              {!splitFile ? (
                <div className="flex flex-col items-center justify-center text-center p-12 text-slate-400">
                  <Scissors className="w-12 h-12 mb-3 text-slate-300" />
                  <p className="font-medium text-slate-600 text-sm">분리할 PDF를 먼저 열어주세요.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 overflow-y-auto max-h-[500px] p-1">
                  {Array.from({ length: splitFile.pageCount }, (_, i) => {
                    const isSelected = selectedPages.has(i);
                    return (
                      <div
                        key={i}
                        onClick={() => togglePageSelect(i)}
                        className={`cursor-pointer rounded-xl border-2 p-3 transition-all relative flex flex-col items-center justify-between h-44 ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                            : 'border-slate-200 bg-slate-50/50 hover:border-slate-400 opacity-60'
                        }`}
                      >
                        {/* Checkbox indicator */}
                        <div className="w-full flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-700">Page {i + 1}</span>
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </div>

                        {/* Page preview representation */}
                        <div className="w-full flex-1 bg-white border border-slate-200 rounded p-2 flex flex-col justify-between shadow-2xs">
                          <div className="space-y-1">
                            <div className="h-1.5 bg-slate-200 rounded w-3/4" />
                            <div className="h-1 bg-slate-100 rounded w-full" />
                            <div className="h-1 bg-slate-100 rounded w-5/6" />
                            <div className="h-1 bg-slate-100 rounded w-2/3" />
                          </div>
                          <div className="text-[10px] text-center font-bold text-slate-400">
                            - {i + 1} -
                          </div>
                        </div>

                        <div className="mt-2 text-[11px] font-semibold text-indigo-900">
                          {isSelected ? '추출 포함' : '제외됨'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          SUB-TAB 3: PDF 내용 삭제 및 수정 (EDIT & REDACT & STAMP)
         ======================================================== */}
      {activeSubTab === 'edit' && (
        <div className="space-y-4">
          {/* File Picker / Status */}
          {!editFile ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-xs text-center max-w-xl mx-auto">
              <Edit3 className="w-12 h-12 text-blue-600 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-slate-900">수정 및 내용 삭제할 PDF 열기</h2>
              <p className="text-xs text-slate-500 mt-1 mb-6">
                페이지 삭제/회전, 민감정보 가림막(화이트아웃/블랙아웃)으로 내용 지우기, 텍스트 추가, 누끼 딴 도장 날인이 가능합니다.
              </p>
              <label className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/30 cursor-pointer active:scale-95 transition-all">
                <Upload className="w-4 h-4" />
                <span>PDF 파일 열기</span>
                <input
                  ref={editInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleEditFileLoaded}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Toolbar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-2 overflow-x-auto">
                  <div className="text-xs font-bold text-slate-800 pr-2 border-r border-slate-200">
                    작업 도구:
                  </div>

                  <button
                    onClick={() => setEditTool('select')}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      editTool === 'select'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>선택/이동</span>
                  </button>

                  <button
                    onClick={() => setEditTool('redact_white')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      editTool === 'redact_white'
                        ? 'bg-amber-100 border-amber-400 text-amber-900'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Eraser className="w-3.5 h-3.5 text-amber-600" />
                    <span>화이트아웃 (내용지우기)</span>
                  </button>

                  <button
                    onClick={() => setEditTool('redact_black')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      editTool === 'redact_black'
                        ? 'bg-slate-800 text-white border-slate-900'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>블랙아웃 (먹칠 가림)</span>
                  </button>

                  <button
                    onClick={() => setEditTool('text')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      editTool === 'text'
                        ? 'bg-blue-100 border-blue-400 text-blue-900'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Type className="w-3.5 h-3.5 text-blue-600" />
                    <span>텍스트 추가</span>
                  </button>

                  <button
                    onClick={() => setEditTool('stamp')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      editTool === 'stamp'
                        ? 'bg-rose-100 border-rose-400 text-rose-900'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Stamp className="w-3.5 h-3.5 text-rose-600" />
                    <span>도장/직인 날인</span>
                  </button>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setEditFile(null)}
                    className="text-xs text-slate-500 hover:text-slate-800 font-medium px-2 py-1"
                  >
                    다른 파일 열기
                  </button>
                  <button
                    disabled={isSavingEdit}
                    onClick={handleSaveEditedPdf}
                    className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                  >
                    {isSavingEdit ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>수정된 PDF 저장</span>
                  </button>
                </div>
              </div>

              {/* Sub-toolbar configuration for selected tool */}
              {editTool === 'text' && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex items-center space-x-3 text-xs">
                  <span className="font-bold text-blue-900">추가할 텍스트:</span>
                  <input
                    type="text"
                    value={newTextVal}
                    onChange={(e) => setNewTextVal(e.target.value)}
                    className="px-2 py-1 border border-blue-300 rounded bg-white text-xs w-56"
                  />
                  <span className="font-bold text-blue-900">색상:</span>
                  <select
                    value={newTextColor}
                    onChange={(e) => setNewTextColor(e.target.value as any)}
                    className="px-2 py-1 border border-blue-300 rounded bg-white text-xs"
                  >
                    <option value="red">빨간색</option>
                    <option value="black">검정색</option>
                    <option value="blue">파란색</option>
                  </select>
                  <span className="text-[11px] text-blue-700">
                    👉 아래 문서 원하는 위치를 클릭하면 텍스트가 삽입됩니다.
                  </span>
                </div>
              )}

              {editTool === 'stamp' && (
                <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <Stamp className="w-4 h-4 text-rose-600" />
                    <span className="font-bold text-rose-950">도장 날인 모드:</span>
                    {activeStampPng ? (
                      <span className="text-emerald-700 font-semibold flex items-center space-x-1">
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>누끼 딴 직인 도장 준비완료</span>
                      </span>
                    ) : (
                      <span className="text-rose-700">
                        [누끼따기] 메뉴에서 배경을 제거한 도장을 준비하면 자동으로 연결됩니다.
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-rose-800">
                    👉 문서의 결재란 또는 날인 위치를 클릭하세요.
                  </span>
                </div>
              )}

              {/* Main Work Area: Left Page Thumbnails & Actions, Right Page Canvas Overlay */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Left: Pages list */}
                <div className="lg:col-span-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-800">
                      페이지 관리 ({pagesOrder.length}페이지)
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                    {pagesOrder.map((origIdx, currentIdx) => {
                      const isCurrent = currentIdx === selectedEditPageIndex;
                      const rot = pageRotations[currentIdx] || 0;
                      return (
                        <div
                          key={`page-${origIdx}-${currentIdx}`}
                          onClick={() => setSelectedEditPageIndex(currentIdx)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isCurrent
                              ? 'border-blue-600 bg-blue-50/70 shadow-xs'
                              : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center">
                              {currentIdx + 1}
                            </span>
                            <span className="text-xs font-semibold text-slate-700">
                              (원본 {origIdx + 1}p)
                            </span>
                            {rot > 0 && (
                              <span className="text-[10px] bg-slate-200 text-slate-700 px-1 rounded">
                                {rot}°
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleRotatePage(currentIdx)}
                              title="90도 회전"
                              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePage(currentIdx)}
                              title="이 페이지 영구 삭제"
                              className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Active Page Canvas Overlay */}
                <div className="lg:col-span-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center justify-center min-h-[520px]">
                  <div className="w-full flex items-center justify-between mb-3 text-xs text-slate-500">
                    <span>
                      현재 선택된 편집 페이지:{' '}
                      <strong className="text-blue-600">{selectedEditPageIndex + 1}페이지</strong>
                    </span>
                    <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      내용 삭제: 원하는 단락을 클릭하여 가림막 박스를 배치하세요
                    </span>
                  </div>

                  {/* Document Page Representation Box */}
                  <div
                    onClick={handleCanvasClick}
                    className="relative w-full max-w-lg aspect-[1/1.414] bg-white border-2 border-slate-300 shadow-md rounded p-6 cursor-crosshair overflow-hidden select-none"
                    style={{
                      transform: `rotate(${pageRotations[selectedEditPageIndex] || 0}deg)`,
                      transition: 'transform 0.2s',
                    }}
                  >
                    {/* Simulated document layout background */}
                    <div className="w-full h-full border border-slate-100 flex flex-col justify-between text-slate-400 text-xs p-4 pointer-events-none">
                      <div>
                        <div className="h-4 bg-slate-200 rounded w-1/3 mb-4" />
                        <div className="space-y-2">
                          <div className="h-2 bg-slate-100 rounded w-full" />
                          <div className="h-2 bg-slate-100 rounded w-full" />
                          <div className="h-2 bg-slate-100 rounded w-4/5" />
                          <div className="h-2 bg-slate-100 rounded w-3/4" />
                        </div>
                        <div className="mt-8 p-3 border border-slate-200 rounded grid grid-cols-2 gap-2 text-[10px]">
                          <div>결재: [기안자 (인)]</div>
                          <div className="text-right">승인: [부서장 (인)]</div>
                        </div>
                      </div>
                      <div className="text-center text-[10px] text-slate-300">
                        기관 표준 문서 - {selectedEditPageIndex + 1}페이지
                      </div>
                    </div>

                    {/* Render Redaction Boxes for this page */}
                    {redactions
                      .filter((r) => r.pageIndex === selectedEditPageIndex)
                      .map((box) => (
                        <div
                          key={box.id}
                          className="absolute border border-dashed border-red-500 flex items-center justify-center text-[9px] font-bold group"
                          style={{
                            left: `${box.xRatio * 100}%`,
                            top: `${box.yRatio * 100}%`,
                            width: `${box.widthRatio * 100}%`,
                            height: `${box.heightRatio * 100}%`,
                            backgroundColor: box.fillColor === 'white' ? '#ffffff' : '#000000',
                            color: box.fillColor === 'white' ? '#666' : '#fff',
                            boxShadow: '0 0 4px rgba(0,0,0,0.2)',
                          }}
                        >
                          <span>내용삭제</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRedactions((prev) => prev.filter((b) => b.id !== box.id));
                            }}
                            className="hidden group-hover:flex absolute -top-3 -right-3 w-5 h-5 bg-rose-600 text-white rounded-full items-center justify-center text-xs shadow-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}

                    {/* Render Text Overlays for this page */}
                    {textOverlays
                      .filter((t) => t.pageIndex === selectedEditPageIndex)
                      .map((txt) => (
                        <div
                          key={txt.id}
                          className="absolute text-xs font-bold px-1 py-0.5 rounded border border-transparent hover:border-blue-500 group"
                          style={{
                            left: `${txt.xRatio * 100}%`,
                            top: `${txt.yRatio * 100}%`,
                            color:
                              txt.color === 'red'
                                ? '#dc2626'
                                : txt.color === 'blue'
                                  ? '#2563eb'
                                  : '#111827',
                            fontSize: `${txt.fontSize}px`,
                          }}
                        >
                          {txt.text}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setTextOverlays((prev) => prev.filter((item) => item.id !== txt.id));
                            }}
                            className="hidden group-hover:flex absolute -top-2.5 -right-2.5 w-4 h-4 bg-rose-600 text-white rounded-full items-center justify-center text-[10px] shadow-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}

                    {/* Render Stamp Overlays for this page */}
                    {stampOverlays
                      .filter((s) => s.pageIndex === selectedEditPageIndex)
                      .map((st) => (
                        <div
                          key={st.id}
                          className="absolute border border-dashed border-rose-400 group cursor-move"
                          style={{
                            left: `${st.xRatio * 100}%`,
                            top: `${st.yRatio * 100}%`,
                            width: `${st.widthRatio * 100}%`,
                            height: `${st.heightRatio * 100}%`,
                          }}
                        >
                          <img
                            src={st.pngBase64}
                            alt="Stamp"
                            className="w-full h-full object-contain pointer-events-none"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setStampOverlays((prev) => prev.filter((item) => item.id !== st.id));
                            }}
                            className="hidden group-hover:flex absolute -top-2 -right-2 w-4 h-4 bg-rose-600 text-white rounded-full items-center justify-center text-[10px] shadow-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
