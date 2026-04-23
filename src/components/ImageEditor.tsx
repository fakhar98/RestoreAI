import type React from 'react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, RotateCcw, Sliders, Loader2, ChevronLeft, Image as ImageIcon } from 'lucide-react';
import BeforeAfterSlider from './BeforeAfterSlider';
import { processImage, ProcessingOptions, ProcessingMode, imageDataToCanvas, canvasToDataURL } from '../utils/imageProcessing';

export default function ImageEditor() {
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [processedSrc, setProcessedSrc] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [options, setOptions] = useState<ProcessingOptions>({
    mode: 'both',
    denoiseStrength: 50,
    deblurStrength: 50,
    sharpness: 30,
    aiEnabled: true,
    aiModelUrl: 'https://cdn.jsdelivr.net/npm/@upscalerjs/maxim-deblurring@0.1.0/models/model.json',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const originalImageDataRef = useRef<ImageData | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(options.aiModelUrl || 'https://cdn.jsdelivr.net/npm/@upscalerjs/maxim-deblurring@0.1.0/models/model.json');
  const [customModelUrl, setCustomModelUrl] = useState<string>('');

  const loadImageData = useCallback((src: string): Promise<ImageData> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
      };
      img.src = src;
    });
  }, []);

  const runProcessing = useCallback(async (opts: ProcessingOptions, imgData?: ImageData) => {
    const data = imgData || originalImageDataRef.current;
    if (!data) return;

    setProcessing(true);
    setProgress(10);

    await new Promise(r => setTimeout(r, 30));
    setProgress(30);

    await new Promise(r => setTimeout(r, 30));
    setProgress(60);

    const result = await processImage(data, opts);
    setProgress(90);

    const canvas = imageDataToCanvas(result);
    const dataUrl = canvasToDataURL(canvas);
    setProcessedSrc(dataUrl);
    setProgress(100);

    setTimeout(() => {
      setProcessing(false);
      setProgress(0);
    }, 300);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const src = e.target!.result as string;
      setOriginalSrc(src);
      setProcessedSrc(null);

      const imageData = await loadImageData(src);
      originalImageDataRef.current = imageData;
      await runProcessing(options, imageData);
    };
    reader.readAsDataURL(file);
  }, [loadImageData, runProcessing, options]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleOptionChange = useCallback(<K extends keyof ProcessingOptions>(
    key: K,
    value: ProcessingOptions[K]
  ) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    if (!originalImageDataRef.current) return;
    const timer = setTimeout(() => runProcessing(options), 200);
    return () => clearTimeout(timer);
  }, [options, runProcessing]);

  const downloadImage = useCallback(() => {
    if (!processedSrc) return;
    const a = document.createElement('a');
    a.href = processedSrc;
    a.download = 'restored-image.jpg';
    a.click();
  }, [processedSrc]);

  const reset = useCallback(() => {
    setOriginalSrc(null);
    setProcessedSrc(null);
    originalImageDataRef.current = null;
  }, []);

  const modes: { value: ProcessingMode; label: string; description: string }[] = [
    { value: 'denoise', label: 'Noise Removal', description: 'Remove grain and noise' },
    { value: 'deblur', label: 'Blur Removal', description: 'Sharpen blurry images' },
    { value: 'both', label: 'Full Restore', description: 'Both noise & blur' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-gray-950/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">ClearPixel</span>
          </div>

          {originalSrc && (
            <div className="flex items-center gap-3">
              <button
                onClick={reset}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
              >
                <ChevronLeft className="w-4 h-4" />
                New Image
              </button>
              {processedSrc && (
                <button
                  onClick={downloadImage}
                  className="flex items-center gap-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 transition-colors px-4 py-1.5 rounded-lg"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {!originalSrc ? (
          /* Upload Area */
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <h1 className="text-4xl font-bold tracking-tight mb-3">Restore Your Images</h1>
              <p className="text-gray-400 text-lg">Remove noise, eliminate blur, and sharpen details — all in your browser.</p>
            </div>

            <div
              className={`
                relative border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-200 cursor-pointer
                ${dragOver
                  ? 'border-blue-400 bg-blue-950/30'
                  : 'border-white/20 hover:border-white/40 hover:bg-white/5'
                }
              `}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center gap-5">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${dragOver ? 'bg-blue-600' : 'bg-white/10'}`}>
                  <Upload className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-xl font-medium mb-1">
                    {dragOver ? 'Drop your image' : 'Upload an image'}
                  </p>
                  <p className="text-gray-500 text-sm">Drag & drop or click to browse — JPG, PNG, WebP</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
              />
            </div>

            <div className="mt-10 grid grid-cols-3 gap-4">
              {[
                { title: 'Noise Removal', desc: 'Eliminate grain and digital noise from photos shot in low light.' },
                { title: 'Blur Removal', desc: 'Recover detail and sharpness from blurry or out-of-focus shots.' },
                { title: 'Edge Sharpening', desc: 'Enhance fine details and textures for crisp, vivid results.' },
              ].map((f) => (
                <div key={f.title} className="bg-white/5 rounded-xl p-5 border border-white/10">
                  <h3 className="font-semibold text-sm mb-2">{f.title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Editor Layout */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            {/* Canvas Area */}
            <div className="space-y-4">
              <div className="bg-gray-900 rounded-2xl border border-white/10 overflow-hidden">
                {processing && (
                  <div className="relative">
                    <div className="h-1 bg-gray-800">
                      <div
                        className="h-1 bg-blue-500 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="p-4">
                  {processedSrc ? (
                    <BeforeAfterSlider beforeSrc={originalSrc!} afterSrc={processedSrc!} />
                  ) : (
                    <div className="flex items-center justify-center aspect-video">
                      <div className="flex flex-col items-center gap-3 text-gray-500">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                        <span className="text-sm">Processing image...</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {processedSrc && (
                <p className="text-center text-xs text-gray-600">
                  Drag the slider to compare original vs restored
                </p>
              )}
            </div>

            {/* Controls Panel */}
            <div className="space-y-4">
              {/* Processing Mode */}
              <div className="bg-gray-900 rounded-2xl border border-white/10 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sliders className="w-4 h-4 text-blue-400" />
                  <h2 className="font-semibold text-sm">Restoration Mode</h2>
                </div>

                <div className="space-y-2">
                  {modes.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => handleOptionChange('mode', m.value)}
                      className={`
                        w-full text-left px-4 py-3 rounded-xl border transition-all duration-150
                        ${options.mode === m.value
                          ? 'border-blue-500 bg-blue-950/50 text-white'
                          : 'border-white/10 hover:border-white/20 text-gray-400 hover:text-white'
                        }
                      `}
                    >
                      <div className="font-medium text-sm">{m.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{m.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Restore */}
              <div className="bg-gray-900 rounded-2xl border border-white/10 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-400" />
                    <h3 className="font-semibold text-sm">AI Restore (Beta)</h3>
                  </div>
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={options.aiEnabled}
                      onChange={(e) => handleOptionChange('aiEnabled', e.target.checked)}
                      className="form-checkbox h-4 w-4"
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <select
                    value={selectedModel}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedModel(val);
                      if (val !== 'custom') {
                        handleOptionChange('aiModelUrl', val);
                      }
                    }}
                    className="w-full bg-gray-800 rounded-md px-3 py-2 text-sm text-white border border-white/10"
                  >
                    <option value="">Packaged MAXIM (local)</option>
                    <option value="https://cdn.jsdelivr.net/npm/@upscalerjs/maxim-deblurring@0.1.0/models/model.json">MAXIM Deblurring (recommended)</option>
                    <option value="https://cdn.jsdelivr.net/npm/@upscalerjs/default-model@1.0.0-beta.17/models/model.json">Upscaler Default Model (ESRGAN)</option>
                    <option value="custom">Custom model URL...</option>
                  </select>

                  {selectedModel === 'custom' && (
                    <input
                      type="text"
                      placeholder="Paste model.json URL"
                      value={customModelUrl}
                      onChange={(e) => setCustomModelUrl(e.target.value)}
                      className="w-full bg-gray-800 rounded-md px-3 py-2 text-sm text-white placeholder-gray-400 border border-white/10"
                    />
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const modelUrl = selectedModel === 'custom' ? customModelUrl : selectedModel || '';
                        handleOptionChange('aiModelUrl', modelUrl);
                        if (originalImageDataRef.current) runProcessing({ ...options, aiEnabled: true, aiModelUrl: modelUrl }, originalImageDataRef.current);
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-sm font-medium py-2 rounded-md"
                    >
                      Run AI Restore
                    </button>
                    <button
                      onClick={() => {
                        setSelectedModel('https://cdn.jsdelivr.net/npm/@upscalerjs/maxim-deblurring@0.1.0/models/model.json');
                        setCustomModelUrl('');
                        handleOptionChange('aiModelUrl', 'https://cdn.jsdelivr.net/npm/@upscalerjs/maxim-deblurring@0.1.0/models/model.json');
                      }}
                      className="bg-white/5 hover:bg-white/10 text-sm text-gray-300 px-3 py-2 rounded-md"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              {/* Sliders */}
              <div className="bg-gray-900 rounded-2xl border border-white/10 p-5 space-y-5">
                <h2 className="font-semibold text-sm">Adjustment Controls</h2>

                {(options.mode === 'denoise' || options.mode === 'both') && (
                  <SliderControl
                    label="Noise Reduction"
                    value={options.denoiseStrength}
                    onChange={(v) => handleOptionChange('denoiseStrength', v)}
                    color="blue"
                  />
                )}

                {(options.mode === 'deblur' || options.mode === 'both') && (
                  <SliderControl
                    label="Blur Reduction"
                    value={options.deblurStrength}
                    onChange={(v) => handleOptionChange('deblurStrength', v)}
                    color="cyan"
                  />
                )}

                <SliderControl
                  label="Sharpness"
                  value={options.sharpness}
                  onChange={(v) => handleOptionChange('sharpness', v)}
                  color="sky"
                />
              </div>

              {/* Actions */}
              <div className="space-y-2">
                {processedSrc && (
                  <button
                    onClick={downloadImage}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 transition-colors text-sm font-medium py-3 rounded-xl"
                  >
                    <Download className="w-4 h-4" />
                    Download Restored Image
                  </button>
                )}
                <button
                  onClick={() => originalImageDataRef.current && runProcessing(options)}
                  disabled={processing}
                  className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 transition-colors text-sm text-gray-300 py-3 rounded-xl border border-white/10"
                >
                  {processing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  {processing ? 'Processing...' : 'Reprocess'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SliderControl({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: 'blue' | 'cyan' | 'sky';
}) {
  const trackColor = {
    blue: 'accent-blue-500',
    cyan: 'accent-cyan-500',
    sky: 'accent-sky-500',
  }[color];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">{label}</span>
        <span className="text-sm font-mono text-white tabular-nums w-8 text-right">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full h-1.5 rounded-full appearance-none bg-white/10 cursor-pointer ${trackColor}`}
      />
      <div className="flex justify-between text-xs text-gray-700">
        <span>Off</span>
        <span>Max</span>
      </div>
    </div>
  );
}
