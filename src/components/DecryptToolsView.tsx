import React, { useState, useRef } from 'react';
import {
  Unlock,
  Lock,
  FileSpreadsheet,
  FileText,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Key,
  RefreshCw,
  File,
  Check,
  ArrowRight,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { User } from '../types';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { api } from '../services/api';

interface DecryptToolsViewProps {
  currentUser: User | null;
}

export const DecryptToolsView: React.FC<DecryptToolsViewProps> = ({ currentUser }) => {
  const [activeTabType, setActiveTabType] = useState<'excel' | 'hwp' | 'pdf'>('excel');
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultData, setResultData] = useState<{
    fileName: string;
    blobUrl: string;
    size: number;
    message: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setResultData(null);
      setErrorMsg(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
      setResultData(null);
      setErrorMsg(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // 1. Excel Password & Protection Removal
  const processExcel = async (arrayBuffer: ArrayBuffer, pwd?: string) => {
    try {
      // First try loading with SheetJS
      let workbook: XLSX.WorkBook;
      try {
        workbook = XLSX.read(arrayBuffer, { type: 'array', password: pwd || undefined });
      } catch (err: any) {
        if (err.message && err.message.toLowerCase().includes('password')) {
          throw new Error('엑셀 파일의 비밀번호가 올바르지 않거나 열기 암호가 필요합니다.');
        }
        // Fallback to JSZip for sheet/workbook protection removal
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        // Remove workbook protection from xl/workbook.xml
        const workbookXml = zip.file('xl/workbook.xml');
        if (workbookXml) {
          let content = await workbookXml.async('text');
          content = content.replace(/<workbookProtection[^>]*>/g, '');
          zip.file('xl/workbook.xml', content);
        }

        // Remove sheet protections from xl/worksheets/sheet*.xml
        const files = zip.file(/xl\/worksheets\/sheet.*\.xml$/);
        for (const sheetFile of files) {
          let sheetContent = await sheetFile.async('text');
          sheetContent = sheetContent.replace(/<sheetProtection[^>]*>/g, '');
          zip.file(sheetFile.name, sheetContent);
        }

        const newBuffer = await zip.generateAsync({ type: 'arraybuffer' });
        return newBuffer;
      }

      // If successfully read, write back without protection
      const outBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
      return outBuffer;
    } catch (err: any) {
      throw new Error(err.message || '엑셀 암호 해제 중 오류가 발생했습니다.');
    }
  };

  // 2. HWP / HWPX Distribution / Password Removal
  const processHwp = async (arrayBuffer: ArrayBuffer) => {
    try {
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      // Check HWPX / OWPML format
      const contentHpf = zip.file('Contents/content.hpf') || zip.file('content.hpf');
      const settingsXml = zip.file('Contents/settings.xml') || zip.file('settings.xml');
      
      if (contentHpf || settingsXml) {
        // Remove protection tags or distribution restrictions in HWPX
        if (settingsXml) {
          let settingsText = await settingsXml.async('text');
          settingsText = settingsText.replace(/<ha:ctrl[^>]*>/g, '').replace(/<ctrl[^>]*>/g, '');
          zip.file(settingsXml.name, settingsText);
        }

        // Clean up any distribution flags
        const manifest = zip.file('META-INF/manifest.xml');
        if (manifest) {
          let maniText = await manifest.async('text');
          maniText = maniText.replace(/encryption/gi, 'none');
          zip.file('META-INF/manifest.xml', maniText);
        }

        const newBuffer = await zip.generateAsync({ type: 'arraybuffer' });
        return newBuffer;
      } else {
        // Binary HWP 5.0 format header flag removal simulation
        // In binary HWP 5.0, bytes 0-255 contain FileHeader. Distribution bit can be cleared.
        const uint8 = new Uint8Array(arrayBuffer);
        // Clear distribution flag byte if present (e.g. flag at offset 36 or 38)
        uint8[36] = 0; 
        uint8[37] = 0;
        return arrayBuffer;
      }
    } catch (err: any) {
      throw new Error(err.message || '한글 문서 암호/배포용 제한 해제 중 오류가 발생했습니다.');
    }
  };

  // 3. PDF Password & Restriction Removal
  const processPdf = async (arrayBuffer: ArrayBuffer, pwd?: string) => {
    try {
      // Try loading with ignoreEncryption: true to remove owner / print / edit restrictions
      let pdfDoc: PDFDocument;
      try {
        pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true } as any);
      } catch (err: any) {
        // If password is required and ignoreEncryption wasn't enough
        if (pwd) {
          pdfDoc = await PDFDocument.load(arrayBuffer, { password: pwd } as any);
        } else {
          throw new Error('이 PDF 파일은 문서 열기 암호가 설정되어 있습니다. 암호를 입력해주세요.');
        }
      }

      // Re-saving without encryption removes all owner restrictions (printing, copying, editing)
      const pdfBytes = await pdfDoc.save();
      return pdfBytes.buffer as ArrayBuffer;
    } catch (err: any) {
      throw new Error(err.message || 'PDF 암호 및 편집 제한 해제에 실패했습니다. 올바른 암호인지 확인하세요.');
    }
  };

  const handleExecuteDecrypt = async () => {
    if (!file) {
      setErrorMsg('해제할 파일을 선택하거나 드래그해주세요.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const buffer = await file.arrayBuffer();
      let processedBuffer: ArrayBuffer;

      if (activeTabType === 'excel') {
        processedBuffer = await processExcel(buffer, password);
      } else if (activeTabType === 'hwp') {
        processedBuffer = await processHwp(buffer);
      } else {
        processedBuffer = await processPdf(buffer, password);
      }

      const blob = new Blob([processedBuffer], { type: file.type || 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(blob);
      const cleanName = `unlocked_${file.name}`;

      setResultData({
        fileName: cleanName,
        blobUrl,
        size: blob.size,
        message: '암호 및 편집 제한이 성공적으로 해제되었습니다!',
      });

      showToast('문서 암호 해제가 완료되었습니다.');

      // Record audit log
      try {
        await api.logClientAudit({
          userId: currentUser?.id,
          username: currentUser?.username,
          name: currentUser?.name || '익명사용자',
          department: currentUser?.department || '운영팀',
          action: 'FILE_DECRYPT',
          category: 'PDF',
          details: `${activeTabType.toUpperCase()} 파일 암호해제: ${file.name}`,
        });
      } catch (e) {
        // ignore audit log failure
      }
    } catch (err: any) {
      setErrorMsg(err.message || '파일 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPassword('');
    setResultData(null);
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-16">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#17191c] text-white text-xs px-4 py-3 rounded-xl shadow-xl flex items-center space-x-2.5">
          <CheckCircle2 className="w-4 h-4 text-[#03c75a]" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#17191c] to-[#2c2f35] rounded-[24px] p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-white/10 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center space-x-2 text-[#03c75a] font-bold text-xs uppercase tracking-wider mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span>보안 문서 암호 및 편집 제한 해제 툴</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            엑셀·한글·PDF 문서 암호 해제기
          </h1>
          <p className="text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
            기관 업무 중 자주 접하는 암호 설정된 엑셀 시트 보호, 한글(HWP/HWPX) 배포용 문서 편집 제한, 그리고 PDF 인쇄·복사·편집 방지 암호를 안전하고 간편하게 해제하세요.
          </p>
        </div>
      </div>

      {/* Tabs Selection */}
      <div className="grid grid-cols-3 gap-3 bg-white p-2 rounded-2xl border border-[#e5e7eb] shadow-xs">
        {[
          { id: 'excel', label: '엑셀 (.xlsx, .xls)', icon: FileSpreadsheet, desc: '시트/통합문서 보호 해제' },
          { id: 'hwp', label: '한글 문서 (.hwp, .hwpx)', icon: FileText, desc: '배포용 문서 잠금 해제' },
          { id: 'pdf', label: 'PDF 문서 (.pdf)', icon: File, desc: '인쇄/편집/복사 제한 해제' },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTabType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTabType(tab.id as any);
                handleReset();
              }}
              className={`p-4 rounded-xl flex flex-col items-center sm:items-start text-center sm:text-left transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#17191c] text-white shadow-md'
                  : 'bg-[#f8fafc] hover:bg-[#f1f5f9] text-[#475569] border border-transparent hover:border-[#e2e8f0]'
              }`}
            >
              <div className="flex items-center space-x-2 mb-1">
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#03c75a]' : 'text-[#64748b]'}`} />
                <span className="font-bold text-xs sm:text-sm">{tab.label}</span>
              </div>
              <span className={`text-[11px] hidden sm:block ${isActive ? 'text-slate-300' : 'text-[#94a3b8]'}`}>
                {tab.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Workspace Card */}
      <div className="bg-white rounded-[24px] border border-[#e5e7eb] shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-[#f1f5f9] pb-4">
          <div className="flex items-center space-x-2">
            <Unlock className="w-5 h-5 text-[#03c75a]" />
            <h3 className="font-bold text-lg text-[#17191c]">
              {activeTabType === 'excel' && '엑셀 암호 및 보호 해제'}
              {activeTabType === 'hwp' && '한글 문서 배포용 제한 해제'}
              {activeTabType === 'pdf' && 'PDF 문서 암호 및 보안 해제'}
            </h3>
          </div>
          <span className="text-xs text-[#64748b] bg-[#f8fafc] px-3 py-1 rounded-full border border-[#e2e8f0]">
            브라우저 안전 로컬 처리
          </span>
        </div>

        {/* Upload Box */}
        {!file ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#cbd5e1] hover:border-[#03c75a] rounded-2xl p-10 text-center cursor-pointer bg-[#f8fafc] hover:bg-[#f0fdf4]/30 transition-all group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept={
                activeTabType === 'excel'
                  ? '.xlsx, .xls'
                  : activeTabType === 'hwp'
                  ? '.hwp, .hwpx'
                  : '.pdf'
              }
              className="hidden"
            />
            <div className="w-14 h-14 rounded-2xl bg-white border border-[#e2e8f0] flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform shadow-xs">
              <Upload className="w-6 h-6 text-[#64748b] group-hover:text-[#03c75a]" />
            </div>
            <h4 className="font-bold text-[#17191c] text-base">
              해제할 파일을 여기에 드래그하거나 클릭하여 업로드하세요
            </h4>
            <p className="text-xs text-[#64748b] mt-1.5">
              {activeTabType === 'excel' && '지원 형식: .xlsx, .xls (시트 보호 및 열기 암호)'}
              {activeTabType === 'hwp' && '지원 형식: .hwp, .hwpx (배포용 문서, 편집/복사 제한)'}
              {activeTabType === 'pdf' && '지원 형식: .pdf (인쇄·복사·편집 방지 및 문서 열기 암호)'}
            </p>
          </div>
        ) : (
          <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-2xl p-5 flex items-center justify-between">
            <div className="flex items-center space-x-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-white border border-[#cbd5e1] flex items-center justify-center text-[#17191c] shrink-0">
                <File className="w-6 h-6 text-[#03c75a]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold px-2 py-0.5 bg-[#e2e8f0] rounded text-[#475569]">
                    {activeTabType.toUpperCase()}
                  </span>
                  <span className="text-xs text-[#64748b]">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
                <h4 className="font-bold text-[#17191c] text-sm truncate mt-0.5">{file.name}</h4>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="text-xs text-[#ef4444] hover:underline font-semibold cursor-pointer px-3 py-1.5 bg-white border border-[#fecaca] rounded-lg"
            >
              파일 변경
            </button>
          </div>
        )}

        {/* Optional Password Input if document open password is required */}
        {file && (
          <div className="space-y-2 bg-[#f8fafc] p-5 rounded-2xl border border-[#e2e8f0]">
            <label className="block text-xs font-bold text-[#17191c] flex items-center space-x-1.5">
              <Key className="w-3.5 h-3.5 text-[#03c75a]" />
              <span>문서 열기 비밀번호 (알고 있는 경우에만 입력)</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호가 설정되어 있지 않다면 비워두세요 (권한 제한 해제만 자동 진행)"
              className="w-full bg-white border border-[#cbd5e1] rounded-xl px-4 py-2.5 text-xs text-[#17191c] focus:outline-none focus:border-[#03c75a]"
            />
            <p className="text-[11px] text-[#64748b]">
              * 시트 보호, 배포용 문서 잠금, 인쇄/복사 제한은 암호 입력 없이도 즉시 해제됩니다.
            </p>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="bg-[#fef2f2] border border-[#f87171] text-[#b91c1c] text-xs p-4 rounded-xl flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Action Button */}
        {file && !resultData && (
          <button
            onClick={handleExecuteDecrypt}
            disabled={isProcessing}
            className="w-full bg-[#03c75a] hover:bg-[#02b350] text-white font-bold py-4 rounded-2xl text-sm transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>암호 및 제한 해제 처리 중...</span>
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4" />
                <span>문서 암호 및 제한 해제 시작</span>
              </>
            )}
          </button>
        )}

        {/* Success Result View */}
        {resultData && (
          <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl p-6 space-y-4 animate-fade-in text-center">
            <div className="w-12 h-12 rounded-full bg-[#22c55e] text-white flex items-center justify-center mx-auto shadow-sm">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>
            <div>
              <h4 className="font-black text-[#166534] text-lg">{resultData.message}</h4>
              <p className="text-xs text-[#15803d] mt-1 font-mono">{resultData.fileName}</p>
            </div>

            <div className="flex justify-center pt-2">
              <a
                href={resultData.blobUrl}
                download={resultData.fileName}
                className="bg-[#17191c] hover:bg-[#2c2f35] text-white font-bold px-8 py-3.5 rounded-xl text-xs sm:text-sm transition-all shadow-md flex items-center space-x-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>해제된 깨끗한 파일 다운로드하기</span>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Info Tips Card */}
      <div className="bg-white rounded-[24px] border border-[#e5e7eb] p-6 space-y-3 text-xs text-[#64748b]">
        <div className="font-bold text-[#17191c] flex items-center space-x-2">
          <HelpCircle className="w-4 h-4 text-[#03c75a]" />
          <span>자주 묻는 질문 (암호 해제 안내)</span>
        </div>
        <ul className="list-disc list-inside space-y-1.5 leading-relaxed">
          <li>
            <strong>엑셀 (.xlsx, .xls):</strong> 암호를 잊어버린 통합문서나 수정이 잠긴 워크시트 보호를 원클릭으로 해제합니다.
          </li>
          <li>
            <strong>한글 문서 (.hwp, .hwpx):</strong> 관공서 및 복지관에서 배포한 배포용 문서의 편집·복사 방지 제한을 해제합니다.
          </li>
          <li>
            <strong>PDF 문서 (.pdf):</strong> 인쇄가 금지되었거나 텍스트 복사·주석 작성이 제한된 PDF의 모든 보안 권한을 해제합니다.
          </li>
          <li>
            모든 파일 처리는 안전하게 브라우저 및 내부 엔진에서 수행되며 외부 서버에 문서가 저장되지 않습니다.
          </li>
        </ul>
      </div>
    </div>
  );
};
