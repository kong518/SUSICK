import React, { useState, useRef, useEffect } from 'react';
import {
  Scissors,
  Upload,
  Download,
  Stamp,
  Sliders,
  CheckCircle2,
  RefreshCw,
  Eye,
  FileCheck,
  Sparkles,
  ArrowRight,
  Eraser,
  Palette,
} from 'lucide-react';
import { bgRemoval } from '../utils/backgroundRemoval';
import { api } from '../services/api';
import { User } from '../types';

interface BackgroundRemovalViewProps {
  currentUser: User | null;
  onSetGeneratedStamp: (pngDataUrl: string) => void;
  onNavigateToPdfEdit: () => void;
}

export const BackgroundRemovalView: React.FC<BackgroundRemovalViewProps> = ({
  currentUser,
  onSetGeneratedStamp,
  onNavigateToPdfEdit,
}) => {
  const [activeMode, setActiveMode] = useState<'stamp' | 'signature' | 'general'>('stamp');
  const [sourceImageSrc, setSourceImageSrc] = useState<string | null>(null);
  const [resultImageSrc, setResultImageSrc] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Settings for Stamp/Signature
  const [redSensitivity, setRedSensitivity] = useState(60);
  const [paperThreshold, setPaperThreshold] = useState(195);
  const [preserveInkStrength, setPreserveInkStrength] = useState(1.2);

  // Settings for General/Eyedropper
  const [sampledColor, setSampledColor] = useState<[number, number, number]>([255, 255, 255]);
  const [tolerance, setTolerance] = useState(25);
  const [feather, setFeather] = useState(8);

  // View split mode
  const [previewStyle, setPreviewStyle] = useState<'checker' | 'split'>('checker');
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceImgRef = useRef<HTMLImageElement>(null);

  // Load sample default stamp if user wants to test quickly
  const loadSampleStamp = () => {
    // Generate a clean institutional sample seal on canvas
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Paper background with slight off-white color
      ctx.fillStyle = '#f6f5f0';
      ctx.fillRect(0, 0, 300, 300);

      // Red official stamp border
      ctx.strokeStyle = '#c5221f';
      ctx.lineWidth = 10;
      ctx.strokeRect(40, 40, 220, 220);

      // Stamp text in Korean
      ctx.fillStyle = '#c5221f';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('기관직인', 150, 110);
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('승인인감', 150, 160);
      ctx.font = 'normal 18px sans-serif';
      ctx.fillText('2026.10.15', 150, 210);

      setSourceImageSrc(canvas.toDataURL('image/png'));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      setSourceImageSrc(event.target?.result as string);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Re-process image when parameters change
  useEffect(() => {
    if (!sourceImageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = sourceImageSrc;
    img.onload = () => {
      setIsProcessing(true);
      try {
        let transparentPng = '';
        if (activeMode === 'stamp') {
          transparentPng = bgRemoval.processStampSeal(img, {
            inkType: 'red_stamp',
            redSensitivity,
            paperThreshold,
            preserveInkStrength,
            smoothEdges: true,
          });
        } else if (activeMode === 'signature') {
          transparentPng = bgRemoval.processStampSeal(img, {
            inkType: 'dark_signature',
            redSensitivity: 50,
            paperThreshold,
            preserveInkStrength,
            smoothEdges: true,
          });
        } else {
          transparentPng = bgRemoval.processGeneralBackground(img, {
            targetRgb: sampledColor,
            tolerance,
            feather,
            invert: false,
          });
        }
        setResultImageSrc(transparentPng);
      } catch (err) {
        console.error('Processing error:', err);
      } finally {
        setIsProcessing(false);
      }
    };
  }, [
    sourceImageSrc,
    activeMode,
    redSensitivity,
    paperThreshold,
    preserveInkStrength,
    sampledColor,
    tolerance,
    feather,
  ]);

  // Click on source image to sample background color (Eyedropper)
  const handleSampleColorClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (activeMode !== 'general' || !sourceImgRef.current) return;
    const img = sourceImgRef.current;
    const rect = img.getBoundingClientRect();
    const scaleX = (img.naturalWidth || img.width) / rect.width;
    const scaleY = (img.naturalHeight || img.height) / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const color = bgRemoval.getPixelColorAt(img, x, y);
    setSampledColor(color);
  };

  // Download Transparent PNG
  const handleDownloadResult = async () => {
    if (!resultImageSrc) return;
    const link = document.createElement('a');
    link.href = resultImageSrc;
    link.download = `누끼제거_${activeMode === 'stamp' ? '기관도장' : '투명이미지'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    await api.logClientAudit({
      userId: currentUser?.id,
      username: currentUser?.username,
      name: currentUser?.name,
      department: currentUser?.department,
      action: 'BG_REMOVE',
      category: 'IMAGE',
      details: `누끼따기 투명 PNG 다운로드 (${activeMode === 'stamp' ? '직인/도장' : '일반 배경제거'})`,
    });
  };

  // Send to PDF tool
  const handleSendToPdfEditor = async () => {
    if (!resultImageSrc) return;
    onSetGeneratedStamp(resultImageSrc);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);

    await api.logClientAudit({
      userId: currentUser?.id,
      username: currentUser?.username,
      name: currentUser?.name,
      department: currentUser?.department,
      action: 'BG_REMOVE',
      category: 'IMAGE',
      details: '누끼 딴 도장을 [PDF 내용 수정] 도장 날인용으로 전달함',
    });

    onNavigateToPdfEdit();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="steep-card-neutral p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-[#979799] font-medium mb-1">
              Seal & Image Studio
            </div>
            <h1 className="font-steep-serif text-3xl sm:text-4xl text-[#17191c]">
              누끼따기 (도장·서명·사진 뒷배경 없애기)
            </h1>
            <p className="text-sm text-[#777b86] mt-2 font-normal max-w-2xl leading-relaxed">
              종이에 찍힌 수원시장애인종합복지관 직인, 도장, 서명 및 사진에서 뒷배경(종이/그림자/배경색)을 깨끗하게 투명화하여 투명 PNG로 즉시 추출합니다.
            </p>
          </div>

          <div className="flex items-center space-x-2.5 shrink-0">
            {!sourceImageSrc && (
              <button
                type="button"
                onClick={loadSampleStamp}
                className="btn-steep-ghost text-xs cursor-pointer"
              >
                샘플 도장 불러오기
              </button>
            )}
            <label className="btn-steep-primary text-xs sm:text-sm cursor-pointer">
              <Upload className="w-4 h-4 mr-1.5" />
              <span>도장/사진 이미지 열기</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Mode Selection & Fine-tuning Sliders */}
        <div className="lg:col-span-1 space-y-4">
          {/* Mode Selector */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h2 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <span>누끼 제거 대상 선택</span>
            </h2>

            <div className="space-y-2">
              <button
                onClick={() => setActiveMode('stamp')}
                className={`w-full p-3 rounded-xl border text-left flex items-start space-x-3 transition-all ${
                  activeMode === 'stamp'
                    ? 'border-rose-500 bg-rose-50/70 shadow-xs'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <Stamp className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-slate-900">1. 붉은색 기관 직인 / 도장 누끼</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    붉은 인주 색상만 보존하고 하얀 종이 및 그림자를 완벽 투명화
                  </div>
                </div>
              </button>

              <button
                onClick={() => setActiveMode('signature')}
                className={`w-full p-3 rounded-xl border text-left flex items-start space-x-3 transition-all ${
                  activeMode === 'signature'
                    ? 'border-blue-500 bg-blue-50/70 shadow-xs'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <FileCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-slate-900">2. 자필 서명 / 결재 싸인 누끼</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    검정 및 파란색 볼펜 잉크를 감지하여 투명 결재 서명으로 변환
                  </div>
                </div>
              </button>

              <button
                onClick={() => setActiveMode('general')}
                className={`w-full p-3 rounded-xl border text-left flex items-start space-x-3 transition-all ${
                  activeMode === 'general'
                    ? 'border-indigo-500 bg-indigo-50/70 shadow-xs'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <Palette className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-slate-900">3. 일반 사진 / 스포이드 배경제거</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    배경색을 클릭하여 해당 색상과 허용치를 투명하게 날리기
                  </div>
                </div>
              </button>
            </div>

            {/* Sliders for Stamp */}
            {activeMode === 'stamp' && (
              <div className="pt-3 border-t border-slate-100 space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>붉은 인주 민감도</span>
                    <span className="text-rose-600 font-bold">{redSensitivity}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={redSensitivity}
                    onChange={(e) => setRedSensitivity(Number(e.target.value))}
                    className="w-full accent-rose-600 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    도장 색이 옅은 경우 수치를 높이세요.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>종이 배경 제거 강도</span>
                    <span className="text-slate-800 font-bold">{paperThreshold}</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="250"
                    value={paperThreshold}
                    onChange={(e) => setPaperThreshold(Number(e.target.value))}
                    className="w-full accent-slate-700 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    어두운 종이나 그림자가 남으면 수치를 낮추세요.
                  </p>
                </div>
              </div>
            )}

            {/* Sliders for Signature */}
            {activeMode === 'signature' && (
              <div className="pt-3 border-t border-slate-100 space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>종이 밝기 기준값</span>
                    <span className="text-blue-600 font-bold">{paperThreshold}</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="250"
                    value={paperThreshold}
                    onChange={(e) => setPaperThreshold(Number(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>잉크 선명도 배율</span>
                    <span className="text-blue-600 font-bold">{preserveInkStrength.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="2.0"
                    step="0.1"
                    value={preserveInkStrength}
                    onChange={(e) => setPreserveInkStrength(Number(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Sliders for General */}
            {activeMode === 'general' && (
              <div className="pt-3 border-t border-slate-100 space-y-4">
                <div className="flex items-center space-x-2 text-xs">
                  <span className="font-semibold text-slate-700">추출할 배경색:</span>
                  <div
                    className="w-6 h-6 rounded border border-slate-300 shadow-2xs"
                    style={{
                      backgroundColor: `rgb(${sampledColor[0]}, ${sampledColor[1]}, ${sampledColor[2]})`,
                    }}
                  />
                  <span className="text-[11px] text-slate-500">
                    (우측 원본 이미지 클릭 시 색상 추출)
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>색상 허용치 (Tolerance)</span>
                    <span className="text-indigo-600 font-bold">{tolerance}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="80"
                    value={tolerance}
                    onChange={(e) => setTolerance(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span>경계 부드러움 (Feather)</span>
                    <span className="text-indigo-600 font-bold">{feather}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    value={feather}
                    onChange={(e) => setFeather(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {resultImageSrc && (
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <button
                  onClick={handleDownloadResult}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.98]"
                >
                  <Download className="w-4 h-4" />
                  <span>투명 PNG 다운로드</span>
                </button>

                <button
                  onClick={handleSendToPdfEditor}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-rose-600/25 transition-all flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.98]"
                >
                  <Stamp className="w-4 h-4" />
                  <span>👉 이 도장을 PDF 수정도구로 바로 보내기</span>
                </button>

                {copiedSuccess && (
                  <div className="text-center text-xs text-emerald-600 font-bold flex items-center justify-center space-x-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>PDF 편집기로 전송되었습니다!</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Visual Comparison & Preview */}
        <div className="lg:col-span-2">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs min-h-[440px] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-800 text-sm">누끼 제거 실시간 미리보기</span>
                {isProcessing && (
                  <span className="text-xs text-indigo-600 flex items-center space-x-1">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>처리 중...</span>
                  </span>
                )}
              </div>

              <div className="text-xs text-slate-500">
                격자무늬(체커보드)는 <strong className="text-indigo-600 font-bold">투명하게 처리된 영역</strong>
                입니다.
              </div>
            </div>

            {!sourceImageSrc ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-slate-400">
                <Scissors className="w-12 h-12 mb-3 text-slate-300" />
                <p className="font-medium text-slate-600 text-sm">
                  도장, 서명 또는 사진 이미지를 불러와주세요.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  휴대폰으로 찍은 종이 도장 사진이나 서명을 올리면 즉시 투명화됩니다.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                {/* Source Original Box */}
                <div className="flex flex-col rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                  <div className="bg-slate-200/80 px-3 py-1.5 text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>원본 이미지</span>
                    {activeMode === 'general' && (
                      <span className="text-[10px] text-indigo-700 font-normal">
                        클릭 시 해당 지점 색상 추출
                      </span>
                    )}
                  </div>
                  <div className="flex-1 p-4 flex items-center justify-center overflow-hidden">
                    <img
                      ref={sourceImgRef}
                      src={sourceImageSrc}
                      alt="Source"
                      onClick={handleSampleColorClick}
                      className={`max-h-72 max-w-full object-contain rounded shadow-2xs ${
                        activeMode === 'general' ? 'cursor-crosshair' : ''
                      }`}
                    />
                  </div>
                </div>

                {/* Result Transparent Checkerboard Box */}
                <div className="flex flex-col rounded-xl border border-indigo-200 overflow-hidden bg-slate-50">
                  <div className="bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white flex items-center justify-between">
                    <span className="flex items-center space-x-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>배경 제거 완료 (투명 PNG)</span>
                    </span>
                    <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded font-normal">
                      투명도 100%
                    </span>
                  </div>

                  <div
                    className="flex-1 p-4 flex items-center justify-center overflow-hidden relative"
                    style={{
                      backgroundImage: `repeating-conic-gradient(#e2e8f0 0% 25%, #ffffff 0% 50%)`,
                      backgroundSize: '16px 16px',
                    }}
                  >
                    {resultImageSrc && (
                      <img
                        src={resultImageSrc}
                        alt="Transparent Result"
                        className="max-h-72 max-w-full object-contain drop-shadow-md"
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
