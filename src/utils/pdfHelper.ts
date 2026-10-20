import { PDFDocument, rgb, degrees } from 'pdf-lib';

export interface RedactionBox {
  id: string;
  pageIndex: number;
  xRatio: number; // 0 to 1 relative to page width
  yRatio: number; // 0 to 1 relative to page height
  widthRatio: number;
  heightRatio: number;
  fillColor: 'white' | 'black' | 'red';
}

export interface TextOverlay {
  id: string;
  pageIndex: number;
  xRatio: number;
  yRatio: number;
  text: string;
  fontSize: number;
  color: 'black' | 'red' | 'blue';
}

export interface StampOverlay {
  id: string;
  pageIndex: number;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
  pngBase64: string; // transparent PNG
}

export const pdfHelper = {
  /**
   * Get metadata and page count of a PDF file
   */
  async getPdfInfo(file: File | ArrayBuffer): Promise<{ pageCount: number; pages: { index: number; width: number; height: number }[] }> {
    const buffer = file instanceof File ? await file.arrayBuffer() : file;
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const count = pdfDoc.getPageCount();
    const pages = [];
    for (let i = 0; i < count; i++) {
      const page = pdfDoc.getPage(i);
      const { width, height } = page.getSize();
      pages.push({ index: i, width, height });
    }
    return { pageCount: count, pages };
  },

  /**
   * Merge multiple PDFs into one
   */
  async mergePdfs(files: { name: string; buffer: ArrayBuffer }[]): Promise<Uint8Array> {
    if (files.length === 0) throw new Error('파일이 없습니다.');

    const mergedDoc = await PDFDocument.create();

    // Add pages from all files
    for (let i = 0; i < files.length; i++) {
      try {
        const srcDoc = await PDFDocument.load(files[i].buffer, { ignoreEncryption: true });
        const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
        copiedPages.forEach((page) => mergedDoc.addPage(page));
      } catch (err) {
        console.error(`Failed to merge ${files[i].name}:`, err);
        throw err;
      }
    }

    return await mergedDoc.save({ useObjectStreams: false });
  },

  /**
   * Split PDF by extracting selected page indices (0-indexed)
   */
  async extractPages(sourceBuffer: ArrayBuffer, pageIndices: number[]): Promise<Uint8Array> {
    const srcDoc = await PDFDocument.load(sourceBuffer);
    const newDoc = await PDFDocument.create();

    const validIndices = pageIndices.filter((idx) => idx >= 0 && idx < srcDoc.getPageCount());
    const copiedPages = await newDoc.copyPages(srcDoc, validIndices);
    copiedPages.forEach((page) => newDoc.addPage(page));

    return await newDoc.save({ useObjectStreams: false });
  },

  /**
   * Parse human range string like "1, 3-5, 8" into 0-indexed numbers
   */
  parsePageRangeString(rangeStr: string, maxPages: number): number[] {
    const pages = new Set<number>();
    const parts = rangeStr.split(/[,;\s]+/).filter(Boolean);

    for (const part of parts) {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const s = Math.max(1, Math.min(start, end));
          const e = Math.min(maxPages, Math.max(start, end));
          for (let p = s; p <= e; p++) {
            pages.add(p - 1);
          }
        }
      } else {
        const p = parseInt(part, 10);
        if (!isNaN(p) && p >= 1 && p <= maxPages) {
          pages.add(p - 1);
        }
      }
    }

    return Array.from(pages).sort((a, b) => a - b);
  },

  /**
   * Comprehensive PDF Editing:
   * - Keep specific page order
   * - Delete deleted page indices
   * - Rotate pages
   * - Redaction boxes (whiteout/blackout over sensitive info or deleted text)
   * - Text annotations
   * - Stamp png overlays
   */
  async editPdf(
    sourceBuffer: ArrayBuffer,
    options: {
      pageOrder: number[]; // Array of source 0-indexed page indices
      rotations?: Record<number, number>; // targetIndex -> degrees (0, 90, 180, 270)
      redactions?: RedactionBox[];
      textOverlays?: TextOverlay[];
      stampOverlays?: StampOverlay[];
    }
  ): Promise<Uint8Array> {
    const srcDoc = await PDFDocument.load(sourceBuffer, { ignoreEncryption: true });
    const newDoc = await PDFDocument.create();

    const { pageOrder, rotations = {}, redactions = [], textOverlays = [], stampOverlays = [] } = options;

    // 1. Copy pages in target order
    const copiedPages = await newDoc.copyPages(srcDoc, pageOrder);
    copiedPages.forEach((page, newIndex) => {
      // apply rotation if any
      const deg = rotations[newIndex] || 0;
      if (deg !== 0) {
        page.setRotation(degrees(deg));
      }
      newDoc.addPage(page);
    });

    // 2. Draw Redaction Boxes (화이트아웃 / 블랙아웃 내용 삭제)
    for (const box of redactions) {
      if (box.pageIndex >= 0 && box.pageIndex < newDoc.getPageCount()) {
        const page = newDoc.getPage(box.pageIndex);
        const { width, height } = page.getSize();

        // PDF coordinates start at bottom-left
        const boxW = box.widthRatio * width;
        const boxH = box.heightRatio * height;
        const boxX = box.xRatio * width;
        const boxY = height - (box.yRatio * height + boxH);

        const colorMap = {
          white: rgb(1, 1, 1),
          black: rgb(0, 0, 0),
          red: rgb(0.9, 0.2, 0.2),
        };

        page.drawRectangle({
          x: Math.max(0, boxX),
          y: Math.max(0, boxY),
          width: Math.min(width, boxW),
          height: Math.min(height, boxH),
          color: colorMap[box.fillColor] || colorMap.white,
        });
      }
    }

    // 3. Draw Text Overlays
    for (const item of textOverlays) {
      if (item.pageIndex >= 0 && item.pageIndex < newDoc.getPageCount()) {
        const page = newDoc.getPage(item.pageIndex);
        const { width, height } = page.getSize();

        const x = item.xRatio * width;
        const y = height - item.yRatio * height;

        const colorMap = {
          black: rgb(0.1, 0.1, 0.1),
          red: rgb(0.85, 0.1, 0.1),
          blue: rgb(0.1, 0.2, 0.8),
        };

        try {
          page.drawText(item.text, {
            x,
            y,
            size: item.fontSize || 12,
            color: colorMap[item.color] || colorMap.black,
          });
        } catch (e) {
          console.warn('Text drawing fallback:', e);
        }
      }
    }

    // 4. Draw Stamp Overlays (누끼 딴 직인/도장/서명 PNG 날인)
    for (const stamp of stampOverlays) {
      if (stamp.pageIndex >= 0 && stamp.pageIndex < newDoc.getPageCount()) {
        try {
          const page = newDoc.getPage(stamp.pageIndex);
          const { width, height } = page.getSize();

          // Convert base64 png to bytes
          const base64Data = stamp.pngBase64.split(',')[1] || stamp.pngBase64;
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          const pngImage = await newDoc.embedPng(bytes);
          const stampW = stamp.widthRatio * width;
          const stampH = stamp.heightRatio * height;
          const stampX = stamp.xRatio * width;
          const stampY = height - (stamp.yRatio * height + stampH);

          page.drawImage(pngImage, {
            x: stampX,
            y: stampY,
            width: stampW,
            height: stampH,
          });
        } catch (err) {
          console.error('Failed to embed stamp:', err);
        }
      }
    }

    return await newDoc.save();
  },

  /**
   * Helper to trigger browser download of Uint8Array as file
   */
  downloadBytes(bytes: Uint8Array, filename: string, mimeType = 'application/pdf') {
    const blob = new Blob([bytes as any], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  },
};
