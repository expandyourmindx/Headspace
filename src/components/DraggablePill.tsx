import React, { useState, forwardRef, useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { useDrag } from '@use-gesture/react';
import { Trash2 } from 'lucide-react';
import { Page } from '../db';

interface DraggablePillProps {
  page: Page;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  pageCount: number;
  pages: Page[];
  onReorder: (draggedIndex: number, targetIndex: number) => void;
  renderPageIcon: (iconName: string, className?: string) => React.ReactNode;
  onDragStateChange?: (isDragging: boolean) => void;
  onDelete?: (pageId: number) => void;
}

const DraggablePill = forwardRef<HTMLButtonElement, DraggablePillProps>(({
  page,
  index,
  isSelected,
  onClick,
  pageCount,
  pages,
  onReorder,
  renderPageIcon,
  onDragStateChange,
  onDelete
}, ref) => {
  const dragX = useMotionValue(0);
  const springX = useSpring(dragX, { damping: 15, stiffness: 200, mass: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const hoverTimer = useRef<any>(null);
  const hoverTargetIndex = useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, []);

  const bind = useDrag(({ active, movement: [mx], tap, cancel }) => {
    if (tap) {
      onClick();
      return;
    }

    setIsDragging(active);
    onDragStateChange?.(active);
    
    if (active) {
      dragX.set(mx);
      
      const threshold = 55; // Drag distance to swap with neighbor
      let targetIdx: number | null = null;
      if (mx > threshold && index < pages.length - 1) {
        targetIdx = index + 1;
      } else if (mx < -threshold && index > 0) {
        targetIdx = index - 1;
      }

      if (targetIdx !== null) {
        if (hoverTargetIndex.current !== targetIdx) {
          hoverTargetIndex.current = targetIdx;
          if (hoverTimer.current) clearTimeout(hoverTimer.current);
          hoverTimer.current = setTimeout(() => {
            onReorder(index, targetIdx!);
            cancel();
            dragX.set(0);
            hoverTargetIndex.current = null;
          }, 150); // 150ms beat before triggering surrounding elements smoothly
        }
      } else {
        hoverTargetIndex.current = null;
        if (hoverTimer.current) {
          clearTimeout(hoverTimer.current);
          hoverTimer.current = null;
        }
      }
    } else {
      dragX.set(0);
      hoverTargetIndex.current = null;
      if (hoverTimer.current) {
        clearTimeout(hoverTimer.current);
        hoverTimer.current = null;
      }
    }
  }, {
    axis: 'x',
    filterTaps: true,
    pointer: { touch: true },
    delay: 200 // 200ms Stationary Lift Threshold Beat
  });

  return (
    <motion.button
      ref={ref as any}
      {...(bind() as any)}
      layout
      style={{
        x: springX,
        zIndex: isDragging ? 50 : 10,
        scale: isDragging ? 1.10 : 1.0, // immediately jump scale by 10%
        touchAction: 'pan-x pan-y'
      }}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-shadow duration-155 cursor-grab active:cursor-grabbing min-h-[36px] select-none ${
        isSelected 
          ? 'bg-zinc-800 text-white shadow-xs' 
          : 'bg-zinc-100 text-zinc-500 hover:text-zinc-800 font-medium'
      } ${isDragging ? 'shadow-[0_15px_30px_-5px_rgba(0,0,0,0.2)] ring-2 ring-indigo-500/50 bg-zinc-200' : ''}`}
      id={`lane-pill-${page.id}`}
    >
      {renderPageIcon(page.icon, "w-3.5 h-3.5")}
      <span>{page.name}</span>
      <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${isSelected ? 'bg-zinc-700 text-white' : 'bg-zinc-200 text-zinc-500 font-semibold'}`}>
        {pageCount}
      </span>
      {onDelete && pages.length > 1 && (
        <span
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(page.id!);
          }}
          className={`ml-1 p-0.5 rounded-full transition-colors flex items-center justify-center cursor-pointer min-w-[20px] min-h-[20px] ${
            isSelected 
              ? 'hover:bg-zinc-700 text-zinc-400 hover:text-rose-450' 
              : 'hover:bg-zinc-200 text-zinc-400 hover:text-rose-500'
          }`}
          style={{ touchAction: 'none' }}
          title="Delete Lane"
          id={`lane-del-btn-${page.id}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </span>
      )}
    </motion.button>
  );
});

DraggablePill.displayName = 'DraggablePill';

export default DraggablePill;
