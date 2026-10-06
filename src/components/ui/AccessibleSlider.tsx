import React, { useRef, useCallback } from 'react';

interface AccessibleSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (nextValue: number) => void;
  formatValue?: (val: number) => string;
  accentColor?: string;
  disabled?: boolean;
  showMarkers?: boolean;
  className?: string;
}

export const AccessibleSlider: React.FC<AccessibleSliderProps> = ({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  formatValue,
  accentColor = '#F59E0B',
  disabled = false,
  showMarkers = false,
  className = '',
}) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const clampAndSnap = useCallback(
    (raw: number) => {
      const clamped = Math.max(min, Math.min(max, raw));
      const steps = Math.round((clamped - min) / step);
      const snapped = min + steps * step;
      return Number(Math.max(min, Math.min(max, snapped)).toFixed(4));
    },
    [min, max, step]
  );

  const updateFromClientX = useCallback(
    (clientX: number) => {
      if (disabled || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const nextVal = clampAndSnap(min + ratio * (max - min));
      onChange(nextVal);
    },
    [disabled, min, max, clampAndSnap, onChange]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      updateFromClientX(e.clientX);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  /**
   * Full WCAG 2.1.1 Keyboard Contract for role="slider":
   * ArrowRight/ArrowUp, ArrowLeft/ArrowDown, PageUp, PageDown, Home, End
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const range = max - min;
    const largeStep = Math.max(step * 5, range * 0.1);

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault();
        onChange(clampAndSnap(value + step));
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault();
        onChange(clampAndSnap(value - step));
        break;
      case 'PageUp':
        e.preventDefault();
        onChange(clampAndSnap(value + largeStep));
        break;
      case 'PageDown':
        e.preventDefault();
        onChange(clampAndSnap(value - largeStep));
        break;
      case 'Home':
        e.preventDefault();
        onChange(min);
        break;
      case 'End':
        e.preventDefault();
        onChange(max);
        break;
      default:
        break;
    }
  };

  const percent = max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0;
  const displayValue = formatValue ? formatValue(value) : String(value);

  return (
    <div className={`select-none ${className}`}>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Number(value.toFixed(2))}
        aria-valuetext={displayValue}
        aria-disabled={disabled}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`group relative flex items-center h-7 cursor-pointer rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F17] ${
          disabled ? 'opacity-40 cursor-not-allowed' : ''
        }`}
      >
        {/* High-contrast Track (WCAG 1.4.11 >= 3:1 contrast against #0B0F17) */}
        <div className="relative w-full h-2 rounded-full bg-slate-800 border border-slate-600/80 overflow-hidden">
          {showMarkers && (
            <div
              aria-hidden="true"
              className="absolute inset-0 flex justify-between items-center px-1 pointer-events-none"
            >
              <span className="w-px h-1.5 bg-slate-500/60" />
              <span className="w-px h-1.5 bg-slate-400/90" />
              <span className="w-px h-1.5 bg-slate-500/60" />
            </div>
          )}
          <div
            className="h-full rounded-full"
            style={{
              width: `${percent}%`,
              backgroundColor: accentColor,
            }}
          />
        </div>

        {/* High-contrast Thumb (WCAG 1.4.11 >= 3:1 contrast) */}
        <div
          aria-hidden="true"
          className="absolute w-4 h-4 rounded-full bg-slate-100 border-2 border-slate-900 shadow-md pointer-events-none group-hover:scale-110 group-focus-visible:scale-110 transition-transform duration-150"
          style={{
            left: `calc(${percent}% - 8px)`,
            boxShadow: `0 0 0 2px ${accentColor}`,
          }}
        />
      </div>
    </div>
  );
};
