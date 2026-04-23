import { useState, useRef, useCallback, useEffect } from 'react';

interface Props {
  beforeSrc: string;
  afterSrc: string;
}

export default function BeforeAfterSlider({ beforeSrc, afterSrc }: Props) {
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    setPosition(pct);
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;
    updatePosition(e.clientX);
  }, [dragging, updatePosition]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!dragging) return;
    updatePosition(e.touches[0].clientX);
  }, [dragging, updatePosition]);

  useEffect(() => {
    const handleEnd = () => setDragging(false);

    if (dragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', onTouchMove);
      window.addEventListener('touchend', handleEnd);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [dragging, onMouseMove, onTouchMove]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl select-none cursor-col-resize"
      style={{ aspectRatio: 'auto' }}
      onMouseDown={(e) => { setDragging(true); updatePosition(e.clientX); }}
      onTouchStart={(e) => { setDragging(true); updatePosition(e.touches[0].clientX); }}
    >
      {/* After (full width) */}
      <img
        src={afterSrc}
        alt="After processing"
        className="block w-full h-full object-contain"
        draggable={false}
      />

      {/* Before (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${position}%` }}
      >
        <img
          src={beforeSrc}
          alt="Before processing"
          className="block h-full object-contain"
          style={{ width: containerRef.current ? `${containerRef.current.offsetWidth}px` : '100%' }}
          draggable={false}
        />
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
        style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-xl flex items-center justify-center">
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l-4 3 4 3M16 9l4 3-4 3" />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-3 left-3 z-10 pointer-events-none">
        <span className="px-2 py-1 rounded-md text-xs font-semibold bg-black/60 text-white backdrop-blur-sm">
          Original
        </span>
      </div>
      <div className="absolute top-3 right-3 z-10 pointer-events-none">
        <span className="px-2 py-1 rounded-md text-xs font-semibold bg-blue-600/90 text-white backdrop-blur-sm">
          Restored
        </span>
      </div>
    </div>
  );
}
