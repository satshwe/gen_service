import React, { useRef, useEffect, useState } from 'react';
import { Eraser, Check } from 'lucide-react';

interface SignaturePadProps {
  label: string;
  signerName: string;
  onSignerNameChange: (name: string) => void;
  signDate: string;
  onSignDateChange: (date: string) => void;
  signatureDataUrl: string;
  onSignatureChange: (dataUrl: string) => void;
  placeholderName?: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  label,
  signerName,
  onSignerNameChange,
  signDate,
  onSignDateChange,
  signatureDataUrl,
  onSignatureChange,
  placeholderName = 'Enter full name',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (signatureDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = signatureDataUrl;
    }
  }, [signatureDataUrl]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      onSignatureChange(canvas.toDataURL('image/png'));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onSignatureChange('');
  };

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{label}</h4>
          <p className="text-xs text-slate-500">Draw signature inside the pad below</p>
        </div>
        <div className="flex items-center gap-2">
          {signatureDataUrl && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
              <Check className="w-3.5 h-3.5" /> Signed
            </span>
          )}
          <button
            type="button"
            onClick={clearCanvas}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors whitespace-nowrap shrink-0"
          >
            <Eraser className="w-3.5 h-3.5" />
            Clear Pad
          </button>
        </div>
      </div>

      <div className="relative border border-dashed border-slate-300 rounded bg-slate-50/70 mb-3 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={360}
          height={110}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-[110px] cursor-crosshair touch-none"
        />
        {!signatureDataUrl && !isDrawing && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">
            Sign here (Mouse or Touch)
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
          <input
            type="text"
            value={signerName}
            onChange={(e) => onSignerNameChange(e.target.value)}
            placeholder={placeholderName}
            className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Sign Date</label>
          <input
            type="date"
            value={signDate}
            onChange={(e) => onSignDateChange(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white font-mono tabular-nums"
          />
        </div>
      </div>
    </div>
  );
};
