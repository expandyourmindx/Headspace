import React, { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { useDrag } from '@use-gesture/react';
import { 
  Trash2, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  MoreVertical, 
  Clock
} from 'lucide-react';
import { Task, Page } from '../db';

function getPlainTextFromTipTapJson(notesStr: string | undefined): string {
  if (!notesStr) return '';
  try {
    const obj = JSON.parse(notesStr);
    
    function extract(node: any): string {
      if (!node) return '';
      if (node.type === 'text' && typeof node.text === 'string') {
        return node.text;
      }
      let childTexts: string[] = [];
      if (Array.isArray(node.content)) {
        for (const child of node.content) {
          childTexts.push(extract(child));
        }
      }
      return childTexts.join(' ');
    }
    
    return extract(obj).trim();
  } catch (e) {
    return '';
  }
}

interface TaskCardProps {
  key?: any;
  task: Task;
  pages: Page[];
  currentPageIndex: number;
  setSelectedPageId: (id: number | null) => void;
  handleDeleteTask: (id: number) => void;
  handleMoveTaskToPage: (taskId: number, targetPageId: number) => Promise<void>;
  handleMoveTaskStage: (task: Task, direction: 'left' | 'right') => Promise<void> | void;
  getPriorityClasses: (priority: 'low' | 'medium' | 'high' | null) => string;
  onCardTap: (task: Task) => void;
  onDragStateChange?: (isDragging: boolean) => void;
  onReorderWithinSection?: (taskId: number, priority: 'low' | 'medium' | 'high' | null, pageId: number, clientY: number) => void;
  
  // Visual Overlay Mechanics
  draggedCardInfo: any;
  onDragLift: (info: { 
    id: number; 
    title: string; 
    description?: string; 
    priority: 'low' | 'medium' | 'high' | null; 
    rect: { top: number; left: number; width: number; height: number } 
  }) => void;
  onDragRelease: (dropRect?: { top: number; left: number; width: number; height: number } | null) => void;
}

export default function TaskCard({
  task,
  pages,
  currentPageIndex,
  setSelectedPageId,
  handleDeleteTask,
  handleMoveTaskToPage,
  handleMoveTaskStage,
  getPriorityClasses,
  onCardTap,
  onDragStateChange,
  onReorderWithinSection,
  draggedCardInfo,
  onDragLift,
  onDragRelease
}: TaskCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFlyingToDone, setIsFlyingToDone] = useState(false);
  
  // Motion values for local/fly animations
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const dragSpringX = useSpring(dragX, { damping: 15, stiffness: 180, mass: 1 });
  const dragSpringY = useSpring(dragY, { damping: 15, stiffness: 180, mass: 1 });
  
  const cardScale = useMotionValue(1);
  const cardOpacity = useMotionValue(1);
  
  const autoSwipeTimer = useRef<any>(null);
  const boundaryDirection = useRef<'left' | 'right' | null>(null);
  const provisionalPageId = useRef<number | null>(null);

  const domRef = useRef<HTMLDivElement>(null);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (autoSwipeTimer.current) {
        clearTimeout(autoSwipeTimer.current);
      }
    };
  }, []);

  // Close dropdown context menu on outside clicks
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function clickOutside(e: MouseEvent) {
      if (isMenuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, [isMenuOpen]);

  // COMPLETE FLIGHT ANIMATION ("Fly-to-Done")
  const handleMarkDone = () => {
    setIsMenuOpen(false);
    setIsFlyingToDone(true);
    
    // Custom physical flight path pulling card up and off-screen toward top Done tab pill
    import('motion/react').then(({ animate }) => {
      Promise.all([
        animate(dragX, -window.innerWidth * 0.9, { duration: 0.55, ease: [0.4, 0, 0.2, 1] }),
        animate(dragY, -250, { duration: 0.55, ease: [0.4, 0, 0.2, 1] }),
        animate(cardScale, 0.1, { duration: 0.5 }),
        animate(cardOpacity, 0, { duration: 0.5 })
      ]).then(async () => {
        const donePage = pages.find(p => p.name.toLowerCase() === 'done');
        if (donePage) {
          await handleMoveTaskToPage(task.id!, donePage.id!);
        }
      });
    });
  };

  // Tactile touch dragging core with continuous pointer element capture
  const bindCardDrag = useDrag(
    ({ active, first, movement: [mx, my], xy, event }) => {
      if (isFlyingToDone) return;
      
      if (active) {
        if (first) {
          const e = event as PointerEvent;
          if (e.pointerId !== undefined && (event.target as Element).setPointerCapture) {
            (event.target as Element).setPointerCapture(e.pointerId);
          }
          provisionalPageId.current = task.pageId;
 
          // Lift-off: trigger parent state update to mount overlay and hide original
          if (domRef.current) {
            const rect = domRef.current.getBoundingClientRect();
            onDragLift({
              id: task.id!,
              title: task.title,
              description: task.description,
              priority: task.priority,
              rect: {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
              }
            });
            onDragStateChange?.(true);
          }
        }
 
        // Direct, high-speed style translation update bypasses React re-render lags entirely
        const overlayEl = document.getElementById('drag-overlay');
        if (overlayEl) {
          overlayEl.style.transition = 'none';
          overlayEl.style.transform = `translate3d(${mx}px, ${my}px, 0) scale(1.04) rotate(1.5deg)`;
        }
        
        // Horizontal boundary checking via viewport metrics
        const isLeftBoundary = xy[0] < window.innerWidth * 0.10;
        const isRightBoundary = xy[0] > window.innerWidth * 0.90;
        
        const currentVisiblePageIndex = pages.findIndex(p => p.id === (provisionalPageId.current ?? task.pageId));
        const actualIndex = currentVisiblePageIndex >= 0 ? currentVisiblePageIndex : currentPageIndex;
 
        if (isLeftBoundary && actualIndex > 0) {
          if (boundaryDirection.current !== 'left') {
            boundaryDirection.current = 'left';
            if (autoSwipeTimer.current) clearTimeout(autoSwipeTimer.current);
            autoSwipeTimer.current = setTimeout(() => {
              const targetPage = pages[actualIndex - 1];
              provisionalPageId.current = targetPage.id!;
              setSelectedPageId(targetPage.id!);
            }, 350); // Steady 350ms boundary hold beat
          }
        } else if (isRightBoundary && actualIndex < pages.length - 1) {
          if (boundaryDirection.current !== 'right') {
            boundaryDirection.current = 'right';
            if (autoSwipeTimer.current) clearTimeout(autoSwipeTimer.current);
            autoSwipeTimer.current = setTimeout(() => {
              const targetPage = pages[actualIndex + 1];
              provisionalPageId.current = targetPage.id!;
              setSelectedPageId(targetPage.id!);
            }, 350); // Steady 350ms boundary hold beat
          }
        } else {
          boundaryDirection.current = null;
          if (autoSwipeTimer.current) {
            clearTimeout(autoSwipeTimer.current);
            autoSwipeTimer.current = null;
          }
        }
      } else {
        // Drop lifecycle triggered
        boundaryDirection.current = null;
        if (autoSwipeTimer.current) {
          clearTimeout(autoSwipeTimer.current);
          autoSwipeTimer.current = null;
        }

        const andMoveToPageId = provisionalPageId.current;
        provisionalPageId.current = null;

        const overlayEl = document.getElementById('drag-overlay');
        let dropRect: { top: number; left: number; width: number; height: number } | null = null;
        if (overlayEl) {
          const r = overlayEl.getBoundingClientRect();
          dropRect = {
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height
          };
        }
        
        // Handle physical landing snap outcomes
        if (andMoveToPageId && andMoveToPageId !== task.pageId) {
          // Card moved pages: immediately persist to indexDB, then unmount overlay immediately
          handleMoveTaskToPage(task.id!, andMoveToPageId).then(() => {
            onDragStateChange?.(false);
            onDragRelease(dropRect);
          });
        } else {
          // Trigger the internal section reordering logic
          if (onReorderWithinSection) {
            onReorderWithinSection(task.id!, task.priority, task.pageId, xy[1]);
          }

          onDragStateChange?.(false);
          onDragRelease(dropRect);
        }
      }
    },
    {
      pointer: { touch: true, mouse: true, capture: true },
      filterTaps: true,
      delay: 200, // 200ms stationary hold threshold
    }
  );

  const isThisCardDragged = draggedCardInfo?.id === task.id;
  const activeIndex = pages.findIndex(p => p.id === task.pageId);
  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex < pages.length - 1;

  // Visual card specs
  const renderCardContent = (
    <>
      <div className="flex items-start justify-between gap-3 mb-1.5 pointer-events-none">
        <h4 className={`tracking-tight text-sm leading-snug break-words pr-6 ${task.title ? 'text-zinc-800 font-bold' : 'text-zinc-405 italic font-medium text-zinc-400'}`}>
          {task.title || 'Untitled'}
        </h4>
      </div>

      {task.notes && (() => {
        const plainText = getPlainTextFromTipTapJson(task.notes);
        if (!plainText) return null;
        const truncated = plainText.length > 60 ? plainText.slice(0, 60) + '...' : plainText;
        return (
          <p className="text-zinc-400 text-xs mb-3 line-clamp-2 break-words pointer-events-none">
            {truncated}
          </p>
        );
      })()}

      {/* manual command launcher controller */}
      <div className="absolute right-2 top-2 hover:opacity-100 z-10" ref={menuRef}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMenuOpen(!isMenuOpen);
          }}
          className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-400 hover:text-zinc-700 min-h-[32px] min-w-[32px] cursor-pointer"
          id={`btn-menu-trigger-${task.id}`}
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {isMenuOpen && (
          <div 
            className="absolute right-0 top-9 w-48 bg-white rounded-2xl border border-zinc-200/90 shadow-lg py-2 z-50 text-left"
            id={`context-menu-${task.id}`}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMarkDone();
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50 cursor-pointer text-left min-h-[40px]"
              id={`context-btn-complete-${task.id}`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Mark Done / Complete</span>
            </button>

            {hasPrev && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMoveTaskStage(task, 'left');
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-zinc-600 hover:bg-zinc-50 cursor-pointer text-left min-h-[40px]"
                id={`context-btn-left-${task.id}`}
              >
                <ArrowLeft className="w-4 h-4 text-zinc-400" />
                <span>Move Left</span>
              </button>
            )}

            {hasNext && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleMoveTaskStage(task, 'right');
                  setIsMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-zinc-600 hover:bg-zinc-50 cursor-pointer text-left min-h-[40px]"
                id={`context-btn-right-${task.id}`}
              >
                <ArrowRight className="w-4 h-4 text-zinc-400" />
                <span>Move Right</span>
              </button>
            )}

            <div className="border-t border-zinc-100 my-1" />

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteTask(task.id!);
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 cursor-pointer text-left min-h-[40px]"
              id={`context-btn-delete-${task.id}`}
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>Delete Card</span>
            </button>
          </div>
        )}
      </div>

      {task.description && (
        <p className="text-zinc-500 text-xs leading-relaxed mb-4 break-words pointer-events-none line-clamp-2">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-zinc-100 pointer-events-none mt-auto" id={`task-card-meta-${task.id}`}>
        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border ${getPriorityClasses(task.priority)}`}>
          {task.priority || 'None'}
        </span>
        <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono">
          <Clock className="w-3 h-3 text-zinc-300" />
          <span>Tactile</span>
        </div>
      </div>
    </>
  );

  return (
    <div
      ref={domRef}
      {...bindCardDrag()}
      style={{
        touchAction: 'pan-y pan-x',
        visibility: isThisCardDragged ? 'hidden' : 'visible'
      }}
      className="relative shrink-0 select-none cursor-pointer"
      id={`task-card-wrapper-${task.id}`}
    >
      <motion.div
        layoutId={`task-card-container-${task.id}`}
        layoutDependency={task.id}
        style={{
          x: dragSpringX,
          y: dragSpringY,
          scale: cardScale,
          opacity: cardOpacity,
          zIndex: 10,
        }}
        className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4 hover:border-zinc-300 transition-shadow flex flex-col relative select-none h-full min-h-[135px]"
        onClick={(e) => {
          if (!isThisCardDragged) {
            onCardTap(task);
          }
        }}
        id={`task-card-${task.id}`}
      >
        {renderCardContent}
      </motion.div>
    </div>
  );
}
