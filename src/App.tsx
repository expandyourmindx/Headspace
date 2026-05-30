/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDrag } from '@use-gesture/react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import TaskCard from './components/TaskCard';
import DraggablePill from './components/DraggablePill';
import NoteView from './components/NoteView';
import { 
  db, 
  seedDatabase, 
  Space, 
  Page, 
  Task, 
  getPageIcon 
} from './db';
import { 
  Plus, 
  Trash2, 
  Folder, 
  Zap, 
  PlayCircle, 
  CheckCircle2, 
  ArrowRightCircle, 
  Search, 
  FileText,
  PlusCircle,
  FolderPlus,
  ArrowRight,
  ArrowLeft,
  X,
  AlertTriangle,
  ChevronDown,
  Inbox,
  CheckCircle,
  LogOut,
  Loader2
} from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { SpaceLaunchScreen } from './components/SpaceLaunchScreen';
import { coldPullFromFirestore, createSyncEngine, deleteFromFirestore, deleteSpaceCascadingFromFirestore } from './sync/firestoreSync';
import { useTheme } from './contexts/ThemeContext';
import { ThemeId, THEME_LIST, PALETTES } from './themes/palettes';


export default function App() {
  const { currentUser, authLoading, signOut } = useAuth();
  const { currentThemeId, setThemeId, applyTheme } = useTheme();

  // Active state of launch screen home dashboard
  const [launchScreenActive, setLaunchScreenActive] = useState<boolean>(false);
  const [syncLoading, setSyncLoading] = useState<boolean>(true);
  const [hasPulled, setHasPulled] = useState<boolean>(false);

  const syncEngineRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (currentUser?.uid) {
      syncEngineRef.current = createSyncEngine(currentUser.uid);
    } else {
      syncEngineRef.current = null;
    }
  }, [currentUser?.uid]);

  const scheduleSync = () => {
    if (syncEngineRef.current) {
      syncEngineRef.current();
    }
  };

  useEffect(() => {
    if (currentUser?.uid && !hasPulled) {
      const pull = async () => {
        setSyncLoading(true);
        try {
          await coldPullFromFirestore(currentUser.uid);
        } catch (e) {
          console.error("Cold pull sync error:", e);
        } finally {
          setSyncLoading(false);
          setHasPulled(true);
          setLaunchScreenActive(true);
        }
      };
      pull();
    }
  }, [currentUser?.uid, hasPulled]);

  useEffect(() => {
    if (!currentUser) {
      setHasPulled(false);
      setSyncLoading(true);
    }
  }, [currentUser]);

  // Active tab state removed for clean shell structure

  
  // Selected Space
  const [selectedSpaceId, setSelectedSpaceId] = useState<number | null>(null);
  
  // Selected Page stage (within Tasks board view)
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);

  // Search input
  const [searchQuery, setSearchQuery] = useState('');

  // Mobile Bottom Sheet overlays
  const [showSpacePickerSheet, setShowSpacePickerSheet] = useState(false);
  const [showNewSpaceSheet, setShowNewSpaceSheet] = useState(false);
  const [showNewPageSheet, setShowNewPageSheet] = useState(false);

  // Deleting page state for move-or-delete-all flow
  const [deletingPageId, setDeletingPageId] = useState<number | null>(null);
  const [moveToPageId, setMoveToPageId] = useState<number | null>(null);

  // Renaming page state
  const [renamingPageId, setRenamingPageId] = useState<number | null>(null);
  const [renamePageInput, setRenamePageInput] = useState<string>('');

  // Deleting space state for state-driven confirmation
  const [pendingDeleteSpaceId, setPendingDeleteSpaceId] = useState<number | null>(null);
  const [pendingDeleteSpaceName, setPendingDeleteSpaceName] = useState<string>('');

  // Form states
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceColor, setNewSpaceColor] = useState('#6366f1'); // Royal Indigo
  const [newSpaceIcon, setNewSpaceIcon] = useState('Folder');
  const [newSpaceThemeId, setNewSpaceThemeId] = useState<ThemeId>('default');

  const [newPageName, setNewPageName] = useState('');

  // Note view task state
  const [activeNoteTask, setActiveNoteTask] = useState<Task | null>(null);
  const [isNoteClosing, setIsNoteClosing] = useState(false);

  useEffect(() => {
    if (!activeNoteTask) {
      setIsNoteClosing(false);
    }
  }, [activeNoteTask]);

  // Gesture state lock
  const [isDraggingElement, setIsDraggingElement] = useState(false);

  // Dragged overlay metadata for high-tactility screen boundary cross-over performance
  const [draggedCardInfo, setDraggedCardInfo] = useState<{
    id: number;
    title: string;
    description?: string;
    priority: 'low' | 'medium' | 'high' | null;
    rect: { top: number; left: number; width: number; height: number };
    dropRect?: { top: number; left: number; width: number; height: number } | null;
    dropTargetLeft?: number;
    dropTargetTop?: number;
    dropTargetWidth?: number;
    dropTargetHeight?: number;
  } | null>(null);

  // IndexedDB sync
  const spaces = useLiveQuery(() => db.spaces.toArray()) || [];
  const tasks = useLiveQuery(() => db.entries.toArray()) || []; // Instantly read reactive entries table
  const allPages = useLiveQuery(() => db.pages.toArray()) || [];

  // Currently viewing space
  const currentSpace = spaces.find(s => s.id === selectedSpaceId) || spaces[0];

  // Load pages of currently selected space
  const pages = useLiveQuery(() => {
    if (!currentSpace) return Promise.resolve([]);
    return db.pages.where('spaceId').equals(currentSpace.id!).sortBy('order');
  }, [currentSpace]) || [];

  // Run the seeding logic once on first ever load when no spaces exist
  useEffect(() => {
    const initDb = async () => {
      const spaceCount = await db.spaces.count();
      if (spaceCount === 0) {
        const result = await seedDatabase();
        if (!selectedSpaceId && result.spaceId) {
          setSelectedSpaceId(result.spaceId);
        }
      }
    };
    initDb();
  }, []);

  // Set default selected space & page
  useEffect(() => {
    if (spaces.length > 0 && !selectedSpaceId) {
      setSelectedSpaceId(spaces[0].id!);
    }
  }, [spaces, selectedSpaceId]);

  // Push changes on space selection transition
  useEffect(() => {
    if (selectedSpaceId) {
      scheduleSync();
    }
  }, [selectedSpaceId]);

  // Space Load Trigger: Apply theme based on active space or fallback to default
  useEffect(() => {
    const space = spaces.find(s => s.id === selectedSpaceId);
    if (space && space.themeId) {
      applyTheme(space.themeId as any);
    } else {
      applyTheme('default');
    }
  }, [selectedSpaceId, spaces, applyTheme]);

  // Validate and sync selectedPageId relative to current space pages on space transition
  useEffect(() => {
    if (pages.length > 0) {
      const isValidPage = pages.some(p => p.id === selectedPageId);
      if (!isValidPage) {
        // Automatically default to "Current" page or the first available page of the space
        const defaultPage = pages.find(p => p.name.toLowerCase() === 'current') || pages[0];
        setSelectedPageId(defaultPage.id!);
      }
    } else {
      setSelectedPageId(null);
    }
  }, [pages, selectedPageId]);

  // Measure container and gesture swiping values
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(window.innerWidth);

  // Scrolling tab bar centering refs
  const pillsContainerRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({});

  useEffect(() => {
    if (!selectedPageId || !pillsContainerRef.current) return;
    const container = pillsContainerRef.current;
    const pill = pillRefs.current[selectedPageId];
    if (!pill) return;
    const containerCenter = container.offsetWidth / 2;
    const pillCenter = pill.offsetLeft + pill.offsetWidth / 2;
    container.scrollTo({
      left: pillCenter - containerCenter,
      behavior: 'smooth'
    });
  }, [selectedPageId]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerWidth(entry.contentRect.width || window.innerWidth);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const activePageIndex = pages.findIndex(p => p.id === selectedPageId);
  const currentPageIndex = activePageIndex >= 0 ? activePageIndex : 0;

  // Horizontal continuous track motion offset and springs
  const x = useMotionValue(0);
  const springX = useSpring(x, { damping: 30, stiffness: 280, mass: 0.9 });

  // Update alignment when active index or container size reflows
  useEffect(() => {
    x.set(-currentPageIndex * containerWidth);
  }, [currentPageIndex, containerWidth, x]);

  // Handle continuous swiping gesture using @use-gesture
  const bindSwipe = useDrag(
    ({ active, movement: [mx], direction: [xDir], cancel, velocity: [vx] }) => {
      if (isDraggingElement) {
        cancel();
        return;
      }
      // Prevent swiping if there are no pages
      if (pages.length === 0) return;

      if (active) {
        // Continuous tactile follow-finger offset
        x.set(-currentPageIndex * containerWidth + mx);
      } else {
        // Drag released: calculate snap trajectory with springs
        const threshold = containerWidth * 0.25;
        const speedThreshold = Math.abs(vx) > 0.45;
        let nextIndex = currentPageIndex;

        if (Math.abs(mx) > threshold || speedThreshold) {
          if (mx < 0 && currentPageIndex < pages.length - 1) {
            nextIndex = currentPageIndex + 1;
          } else if (mx > 0 && currentPageIndex > 0) {
            nextIndex = currentPageIndex - 1;
          }
        }

        if (nextIndex !== currentPageIndex) {
          setSelectedPageId(pages[nextIndex].id!);
        } else {
          // Animate back to original alignment
          x.set(-currentPageIndex * containerWidth);
        }
      }
    },
    {
      axis: 'x',
      filterTaps: true,
      pointer: { touch: true },
      enabled: !isDraggingElement,
    }
  );

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-zinc-50 font-sans animate-fade-in" id="app-loading-screen">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-sm font-semibold text-zinc-500">Loading your workspace...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen />;
  }

  if (syncLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-zinc-50 font-sans animate-fade-in" id="app-sync-loading-screen">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <p className="text-sm font-semibold text-zinc-500">Synchronizing cloud documents...</p>
      </div>
    );
  }

  // Directly move a task card from one board stage/page to another
  const handleMoveTaskToPage = async (taskId: number, targetPageId: number) => {
    const currentTask = await db.entries.get(taskId);
    if (!currentTask) return;

    const existingCount = tasks.filter(
      t => t.pageId === targetPageId && t.priority === currentTask.priority
    ).length;

    const updates = {
      pageId: targetPageId,
      priorityOrder: currentTask.priority !== null ? existingCount : null,
      updatedAt: Date.now()
    };
    await db.entries.update(taskId, updates);
    scheduleSync();
  };

  // Reorder task cards within their respective priority sections
  const handleReorderWithinSection = async (
    taskId: number,
    priority: 'low' | 'medium' | 'high' | null,
    pageId: number,
    clientY: number
  ) => {
    if (priority === null) return; // Unprioritized is strictly sorted by createdAt

    const sectionTasks = tasks
      .filter(t => t.pageId === pageId && t.priority === priority)
      .sort((a, b) => (a.priorityOrder ?? 0) - (b.priorityOrder ?? 0));

    const midpoints = sectionTasks
      .map(t => {
        const el = document.getElementById(`task-card-wrapper-${t.id}`);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          id: t.id!,
          midY: rect.top + rect.height / 2,
        };
      })
      .filter((m): m is { id: number; midY: number } => m !== null);

    if (midpoints.length <= 1) return;

    const others = midpoints.filter(m => m.id !== taskId);

    let insertIndex = 0;
    for (let i = 0; i < others.length; i++) {
      if (clientY > others[i].midY) {
        insertIndex = i + 1;
      }
    }

    const otherIds = others.map(o => o.id);
    const reorderedIds = [...otherIds];
    reorderedIds.splice(insertIndex, 0, taskId);

    await db.transaction('rw', db.entries, async () => {
      for (let index = 0; index < reorderedIds.length; index++) {
        const id = reorderedIds[index];
        await db.entries.update(id, { priorityOrder: index, updatedAt: Date.now() });
      }
    });

    scheduleSync();
  };

  // Reorder database pages horizontally
  const handleReorderPages = async (activeIndex: number, targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= pages.length) return;
    const activePage = pages[activeIndex];
    const targetPage = pages[targetIndex];
    
    await db.transaction('rw', db.pages, async () => {
      await db.pages.update(activePage.id!, { order: targetPage.order });
      await db.pages.update(targetPage.id!, { order: activePage.order });
    });
    scheduleSync();
  };

  const handleCardTap = (task: Task) => {
    setActiveNoteTask(task);
  };

  const handleCloseNoteView = () => {
    setIsNoteClosing(true);
    requestAnimationFrame(() => {
      setActiveNoteTask(null);
      setIsNoteClosing(false);
    });
  };

  const currentActiveNoteTask = activeNoteTask
    ? tasks.find(t => t.id === activeNoteTask.id) || activeNoteTask
    : null;

  const handleDragRelease = (dropRect?: { top: number; left: number; width: number; height: number } | null) => {
    if (!draggedCardInfo) return;

    // Use a next-frame deferral so React/IndexedDB state fully commits to the DOM first
    setDraggedCardInfo(prev => {
      if (!prev) return null;
      return {
        ...prev,
        dropRect: dropRect || prev.rect,
        dropTargetLeft: dropRect?.left || prev.rect.left,
        dropTargetTop: dropRect?.top || prev.rect.top,
        dropTargetWidth: dropRect?.width || prev.rect.width,
        dropTargetHeight: dropRect?.height || prev.rect.height,
      };
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        let destRect = document.getElementById(`task-card-wrapper-${draggedCardInfo.id}`)?.getBoundingClientRect();
        if (!destRect) {
          const pageId = selectedPageId || pages[0]?.id;
          const pKey = draggedCardInfo.priority || 'unprioritized';
          const fallbackEl = document.getElementById(`lane-tasks-list-${pageId}-${pKey}`) ||
                             document.getElementById(`lane-unprioritized-section-${pageId}`) ||
                             document.getElementById(`lane-priority-section-${pageId}-${pKey}`) ||
                             document.getElementById(`priority-divider-${pageId}-${pKey}`);
          if (fallbackEl) {
            destRect = fallbackEl.getBoundingClientRect();
          }
        }

        const finalDestRect = destRect || draggedCardInfo.rect;

        setDraggedCardInfo(prev => {
          if (!prev) return null;
          return {
            ...prev,
            dropTargetLeft: finalDestRect.left,
            dropTargetTop: finalDestRect.top,
            dropTargetWidth: finalDestRect.width,
            dropTargetHeight: finalDestRect.height,
          };
        });
      });
    });

    setTimeout(() => {
      setDraggedCardInfo(null);
    }, 330); // 330ms to fully cover the 300ms transition and ensure smooth handover
  };

  // Render high-contrast colored icon maps
  const renderPageIcon = (iconName: string, className = "w-5 h-5") => {
    switch (iconName) {
      case 'CheckCircle2':
        return <CheckCircle2 className={`${className} text-emerald-500`} />;
      case 'PlayCircle':
        return <PlayCircle className={`${className} text-indigo-500`} />;
      case 'Zap':
        return <Zap className={`${className} text-amber-500`} />;
      case 'ArrowRightCircle':
        return <ArrowRightCircle className={`${className} text-blue-500`} />;
      default:
        return <FileText className={`${className} text-zinc-400`} />;
    }
  };

  // Actions
  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpaceName.trim()) return;

    const newId = await db.spaces.add({
      name: newSpaceName,
      icon: newSpaceIcon,
      color: newSpaceColor,
      themeId: newSpaceThemeId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    // Automatically seed default single-lane pipeline
    const defaultPageNames = ['Start'];
    for (let i = 0; i < defaultPageNames.length; i++) {
      const pageName = defaultPageNames[i];
      await db.pages.add({
        spaceId: newId,
        name: pageName,
        order: i,
        icon: getPageIcon(pageName),
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    setSelectedSpaceId(newId);
    setNewSpaceName('');
    setNewSpaceThemeId('default');
    setShowNewSpaceSheet(false);
    setShowSpacePickerSheet(false);
    setLaunchScreenActive(false);
    scheduleSync();
  };

  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPageName.trim() || !currentSpace) return;

    const newPageId = await db.pages.add({
      spaceId: currentSpace.id!,
      name: newPageName,
      order: pages.length,
      icon: getPageIcon(newPageName),
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    setSelectedPageId(newPageId);
    setNewPageName('');
    setShowNewPageSheet(false);
    scheduleSync();
  };

  const handleInitiateDeletePage = (pageId: number) => {
    const otherPages = pages.filter(p => p.id !== pageId);
    setDeletingPageId(pageId);
    if (otherPages.length > 0) {
      setMoveToPageId(otherPages[0].id!);
    } else {
      setMoveToPageId(null);
    }
  };

  const handleConfirmDeletePage = async (deleteCards: boolean) => {
    if (!deletingPageId) return;

    // 1. Delete all entries where pageId === deletingPageId from db.entries
    if (deleteCards) {
      const cardsInLane = await db.entries.where('pageId').equals(deletingPageId).toArray();
      await db.entries.where('pageId').equals(deletingPageId).delete();
      if (currentUser?.uid) {
        for (const card of cardsInLane) {
          if (card.id) {
            await deleteFromFirestore(currentUser.uid, 'entries', card.id);
          }
        }
      }
    } else if (moveToPageId) {
      // Migrate cards to target page
      const cardsInLane = await db.entries.where('pageId').equals(deletingPageId).toArray();
      for (const card of cardsInLane) {
        if (card.id) {
          await db.entries.update(card.id, { pageId: moveToPageId });
        }
      }
    }

    // 2. Delete the page itself from db.pages
    await db.pages.delete(deletingPageId);
    if (currentUser?.uid) {
      await deleteFromFirestore(currentUser.uid, 'pages', deletingPageId);
    }

    // 3. Call scheduleSync()
    scheduleSync();

    // 4. If selectedPageId was the deleted page, set selectedPageId to the first remaining page
    if (selectedPageId === deletingPageId) {
      const remainingPages = pages.filter(p => p.id !== deletingPageId);
      if (remainingPages.length > 0) {
        setSelectedPageId(remainingPages[0].id!);
      } else {
        setSelectedPageId(null);
      }
    }

    // 5. Close the sheet by setting deletingPageId to null
    setDeletingPageId(null);
    setMoveToPageId(null);
  };

  const handleCreateBlankTaskInstant = async () => {
    if (!currentSpace) return;
    if (pages.length === 0) {
      setShowNewPageSheet(true);
      return;
    }

    const targetPageId = selectedPageId || pages[0].id!;
    const tasksInPage = tasks.filter(t => t.pageId === targetPageId);

    const newTaskData = {
      spaceId: currentSpace.id!,
      pageId: targetPageId,
      title: "",
      description: "",
      notes: "",
      status: 'todo' as const,
      priority: null,
      priorityOrder: null,
      order: tasksInPage.length,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const newId = await db.entries.add(newTaskData);
    const createdTask = { id: newId, ...newTaskData };
    setActiveNoteTask(createdTask);
    scheduleSync();
  };

  const handleDeleteTask = async (taskId: number) => {
    await db.entries.delete(taskId);
    if (currentUser?.uid) {
      await deleteFromFirestore(currentUser.uid, 'entries', taskId);
    }
    scheduleSync();
  };

  const handleDeleteSpace = (spaceId: number, name: string) => {
    setPendingDeleteSpaceId(spaceId);
    setPendingDeleteSpaceName(name);
  };

  const handleConfirmDeleteSpace = async () => {
    if (pendingDeleteSpaceId === null) return;
    const spaceId = pendingDeleteSpaceId;

    // Explicitly delete all pages and entries (tasks) belonging to that space
    await db.transaction('rw', [db.spaces, db.pages, db.entries], async () => {
      await db.entries.where('spaceId').equals(spaceId).delete();
      await db.pages.where('spaceId').equals(spaceId).delete();
      await db.spaces.delete(spaceId);
    });

    // Fire direct Firestore cascading deletes for all affected records in a batch write
    if (currentUser?.uid) {
      await deleteSpaceCascadingFromFirestore(currentUser.uid, spaceId);
    }

    const remainingSpaces = await db.spaces.toArray();
    if (remainingSpaces.length === 0) {
      setSelectedSpaceId(null);
      setLaunchScreenActive(true);
    } else {
      setSelectedSpaceId(remainingSpaces[0]?.id || null);
    }
    setPendingDeleteSpaceId(null);
    setPendingDeleteSpaceName('');
    setShowSpacePickerSheet(false);
    scheduleSync();
  };

  const handleToggleSpacePin = async (spaceId: number) => {
    const space = spaces.find(s => s.id === spaceId);
    if (space) {
      const isPinned = !!space.pinned;
      await db.spaces.update(spaceId, { pinned: !isPinned, updatedAt: Date.now() });
      scheduleSync();
    }
  };

  const handleRenameSpace = async (spaceId: number, newName: string) => {
    await db.spaces.update(spaceId, { name: newName, updatedAt: Date.now() });
    scheduleSync();
  };

  const handleInitiateRenamePage = (pageId: number, pageName: string) => {
    setRenamingPageId(pageId);
    setRenamePageInput(pageName);
  };

  const handleRenamePage = async (pageId: number, newName: string) => {
    await db.pages.update(pageId, { name: newName, updatedAt: Date.now() });
    scheduleSync();
  };

  const handleMoveTaskStage = async (task: Task, direction: 'left' | 'right') => {
    const currentIndex = pages.findIndex(p => p.id === task.pageId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex >= 0 && targetIndex < pages.length) {
      const targetPage = pages[targetIndex];
      
      const existingCount = tasks.filter(
        t => t.pageId === targetPage.id! && t.priority === task.priority
      ).length;

      const updates = {
        pageId: targetPage.id!,
        priorityOrder: task.priority !== null ? existingCount : null,
        updatedAt: Date.now()
      };
      await db.entries.update(task.id!, updates);
      scheduleSync();
    }
  };

  // Filter computations
  const getPriorityClasses = (prio: 'low' | 'medium' | 'high' | null) => {
    switch (prio) {
      case 'high':
        return 'bg-rose-50 text-rose-700 border-rose-100';
      case 'medium':
        return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'low':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      default:
        return 'bg-zinc-50 text-zinc-500 border-zinc-200';
    }
  };

  // Safe search match with case-insensitivity and Rich-Text plain-text JSON stripping
  const matchesSearch = (task: Task) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();

    // Helper to extract nested plain text from Tiptap JSON structure
    const extractPlainText = (notesStr?: string): string => {
      if (!notesStr) return '';
      const trimmed = notesStr.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const obj = JSON.parse(trimmed);
          const extract = (node: any): string => {
            if (!node) return '';
            if (typeof node === 'string') return node;
            if (node.text) return node.text;
            if (Array.isArray(node)) {
              return node.map(extract).join(' ');
            }
            if (typeof node === 'object') {
              return Object.values(node).map(extract).join(' ');
            }
            return '';
          };
          return extract(obj);
        } catch {
          // fallback
        }
      }
      return trimmed.replace(/<[^>]*>/g, ' ');
    };

    const notesPlain = extractPlainText(task.notes);

    return (task.title || '').toLowerCase().includes(query) || 
           (task.description || '').toLowerCase().includes(query) ||
           notesPlain.toLowerCase().includes(query);
  };

  // Filter tasks reactively based on currently active spaceId and page tab's pageId
  const activePageTasks = tasks.filter(t => t.spaceId === currentSpace?.id && t.pageId === selectedPageId && matchesSearch(t));

  return (
    <motion.div layout layoutRoot className="flex flex-col h-screen w-screen bg-zinc-50 select-none overflow-hidden keyboard-aware" id="app-viewport">
      
      {launchScreenActive ? (
        <SpaceLaunchScreen
          currentUser={currentUser}
          spaces={spaces}
          allPages={allPages}
          tasks={tasks}
          onSelectSpace={(spaceId) => {
            setSelectedSpaceId(spaceId);
            setLaunchScreenActive(false);
          }}
          onTogglePin={handleToggleSpacePin}
          onSignOut={signOut}
          onCreateSpaceClick={() => setShowNewSpaceSheet(true)}
          onDeleteSpace={handleDeleteSpace}
          onRenameSpace={handleRenameSpace}
        />
      ) : (
        <>
          {/* 1. Header Navigation Bar (Locked Height: 14 / h-[56px] + Safe notch top) */}
          <header 
        className="shrink-0 bg-surface border-b border-border/85 z-30" 
        style={{ paddingTop: 'var(--safe-top)' }} 
        id="app-header-bar"
      >
        <div className="h-14 px-4 flex items-center justify-between">
          
          {/* Back to Launcher Trigger */}
          <button 
            onClick={() => setLaunchScreenActive(true)}
            className="flex items-center gap-2.5 max-w-[65%] text-left p-1.5 px-2.5 bg-surface border border-border/60 rounded-xl active-bounce hover:bg-background/95 duration-100 cursor-pointer min-h-[44px]"
            id="trigger-back-to-launcher"
          >
            <ArrowLeft className="w-4 h-4 text-text-secondary shrink-0 mb-0.5" />
            <div className="truncate">
              <div className="text-[9px] text-zinc-405 font-bold uppercase tracking-widest leading-none">Launcher</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div 
                  className="w-2 h-2 rounded-full shrink-0" 
                  style={{ backgroundColor: currentSpace?.color || '#6366f1' }} 
                />
                <span className="text-xs font-extrabold text-text-primary truncate">{currentSpace?.name || 'Personal'}</span>
              </div>
            </div>
          </button>

          {/* Quick-Stats & Global Search */}
          <div className="flex items-center gap-2">
            <div className="relative min-w-[120px] max-w-[170px]">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-8 pr-2.5 rounded-xl bg-surface border border-border focus:outline-hidden focus:border-indigo-500 focus:bg-surface text-xs text-text-primary placeholder-zinc-400"
                id="search-input"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5"
                >
                  <X className="w-3 h-3 text-zinc-400" />
                </button>
              )}
            </div>

            <button
              onClick={() => signOut()}
              className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all h-9 w-9 flex items-center justify-center cursor-pointer"
              title="Sign Out"
              id="app-signout-btn"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      {/* 2. Main Scrollable Container (flex-1 overflow-y-auto) */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative" id="app-view-container">
        
        {/* --- TAB VIEW 1: BOARD WORKSPACE --- */}
        <div className="flex flex-col h-full" id="view-board-workspace">
            
            {/* Top Swapping Tab lane header (Height: 48px) */}
            <div 
              ref={pillsContainerRef}
              className={`bg-surface border-b border-border shrink-0 px-4 py-2 flex items-center gap-2 no-scrollbar scroll-smooth ${isDraggingElement ? 'overflow-hidden pointer-events-none' : 'overflow-x-auto'}`}
              id="lanes-tab-container"
              style={{ overscrollBehaviorX: 'contain' }}
            >
              {pages.map((page, index) => {
                const isSelected = page.id === selectedPageId;
                const pageCount = tasks.filter(t => t.spaceId === currentSpace?.id && t.pageId === page.id).length;
                return (
                  <DraggablePill
                    ref={(el) => {
                      if (el) pillRefs.current[page.id!] = el;
                    }}
                    key={page.id}
                    page={page}
                    index={index}
                    isSelected={isSelected}
                    onClick={() => setSelectedPageId(page.id!)}
                    pageCount={pageCount}
                    pages={pages}
                    onReorder={handleReorderPages}
                    renderPageIcon={renderPageIcon}
                    onDragStateChange={setIsDraggingElement}
                    onDelete={handleInitiateDeletePage}
                    onLongPress={handleInitiateRenamePage}
                  />
                );
              })}

              <button
                onClick={() => setShowNewPageSheet(true)}
                className="flex items-center justify-center p-2 rounded-full bg-surface border border-dashed border-border text-text-secondary hover:text-indigo-600 hover:border-indigo-400 transition-colors cursor-pointer min-w-[36px] min-h-[36px]"
                title="Add Stage / Column"
                id="btn-add-lane"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Horizontal Swipable Track Container */}
            <div 
              ref={containerRef}
              className="flex-1 overflow-hidden relative w-full h-full bg-background"
              id="horizontal-swipable-track-container"
              {...bindSwipe()}
              style={{ touchAction: 'pan-y', overscrollBehaviorX: 'contain' }}
            >
              <motion.div
                className="flex h-full select-none"
                style={{ x: springX, width: `${pages.length * 100}%` }}
                id="internal-horizontal-track"
              >
                {pages.map((page, pIdx) => {
                  const pageTasks = tasks.filter(
                    t => t.spaceId === currentSpace?.id && t.pageId === page.id && matchesSearch(t)
                  );

                  return (
                    <div
                      key={page.id}
                      className="h-full px-4 py-4 overflow-y-auto shrink-0 flex flex-col pb-6"
                      style={{ width: `${100 / pages.length}%` }}
                      id={`horizontal-lane-page-${page.id}`}
                    >
                      {(['high', 'medium', 'low'] as const).map(prio => {
                        const prioTasks = pageTasks
                          .filter(t => t.priority === prio)
                          .sort((a, b) => (a.priorityOrder ?? 0) - (b.priorityOrder ?? 0));

                        if (prioTasks.length === 0) return null;

                        return (
                          <div key={prio} className="flex flex-col mb-4 shrink-0" id={`lane-priority-section-${page.id}-${prio}`}>
                            {/* Priority Header/Divider */}
                            <div className={`flex items-center justify-between py-2 px-3 border-l-4 rounded-r-xl select-none ${
                              prio === 'high' ? 'border-rose-500 bg-rose-50/50 text-rose-800' :
                              prio === 'medium' ? 'border-amber-500 bg-amber-50/50 text-amber-805' :
                              'border-emerald-500 bg-emerald-50/50 text-emerald-800'
                            } my-2`} id={`priority-divider-${page.id}-${prio}`}>
                              <span className="text-[10px] font-black tracking-widest uppercase">{prio} Priority</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                prio === 'high' ? 'bg-rose-100 text-rose-700' :
                                prio === 'medium' ? 'bg-amber-100 text-amber-700' :
                                'bg-emerald-100 text-emerald-700'
                              }`}>{prioTasks.length}</span>
                            </div>

                            {/* Cards Grid */}
                            <div className="grid grid-cols-2 gap-3" id={`lane-tasks-list-${page.id}-${prio}`}>
                              {prioTasks.map(task => (
                                <TaskCard
                                  key={task.id}
                                  task={task}
                                  pages={pages}
                                  currentPageIndex={pIdx}
                                  setSelectedPageId={setSelectedPageId}
                                  handleDeleteTask={handleDeleteTask}
                                  handleMoveTaskToPage={handleMoveTaskToPage}
                                  handleMoveTaskStage={handleMoveTaskStage}
                                  getPriorityClasses={getPriorityClasses}
                                  onCardTap={handleCardTap}
                                  onDragStateChange={setIsDraggingElement}
                                  onReorderWithinSection={handleReorderWithinSection}
                                  draggedCardInfo={draggedCardInfo}
                                  onDragLift={setDraggedCardInfo}
                                  onDragRelease={handleDragRelease}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      {/* Unprioritized Stack */}
                      {(() => {
                        const unprioTasks = pageTasks
                          .filter(t => t.priority === null)
                          .sort((a, b) => a.createdAt - b.createdAt);

                        if (unprioTasks.length === 0) return null;

                        return (
                          <div className="flex flex-col mb-4 shrink-0" id={`lane-unprioritized-section-${page.id}`}>
                            <div className="grid grid-cols-2 gap-3" id={`lane-tasks-list-${page.id}-unprioritized`}>
                              {unprioTasks.map(task => (
                                <TaskCard
                                  key={task.id}
                                  task={task}
                                  pages={pages}
                                  currentPageIndex={pIdx}
                                  setSelectedPageId={setSelectedPageId}
                                  handleDeleteTask={handleDeleteTask}
                                  handleMoveTaskToPage={handleMoveTaskToPage}
                                  handleMoveTaskStage={handleMoveTaskStage}
                                  getPriorityClasses={getPriorityClasses}
                                  onCardTap={handleCardTap}
                                  onDragStateChange={setIsDraggingElement}
                                  onReorderWithinSection={handleReorderWithinSection}
                                  draggedCardInfo={draggedCardInfo}
                                  onDragLift={setDraggedCardInfo}
                                  onDragRelease={handleDragRelease}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {pageTasks.length === 0 && (
                        <div className="py-10 px-4 text-center mt-auto" id={`empty-tasks-fallback-${page.id}`}>
                          <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center mx-auto mb-4 text-text-secondary border border-border">
                            <Inbox className="w-6 h-6 text-zinc-300" />
                          </div>
                          <h3 className="font-bold text-text-primary text-sm leading-tight">Quiet Board Stage</h3>
                          <p className="text-xs text-zinc-400 mt-1.5 max-w-xs mx-auto">
                            No items in this lane. Touch the floating action indicator below to secure tasks.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            </div>

            {/* Fixed Floating Action Button */}
            <div className="fixed bottom-6 right-4 z-40" id="fab-container">
              <motion.button
                layoutId="add-task-morph-container"
                onClick={handleCreateBlankTaskInstant}
                className="w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-200/80 cursor-pointer"
                title="Create task"
                id="fab-add-task"
              >
                <Plus className="w-6 h-6" />
              </motion.button>
            </div>

          </div>

      </main>

      {/* FIXED HIGH-TACTILITY ACTIVE CARD DRAG OVERLAY */}
      {draggedCardInfo && (
        <div
          id="drag-overlay"
          style={{
            position: 'fixed',
            left: `${draggedCardInfo.dropRect ? draggedCardInfo.dropTargetLeft ?? draggedCardInfo.dropRect.left : draggedCardInfo.rect.left}px`,
            top: `${draggedCardInfo.dropRect ? draggedCardInfo.dropTargetTop ?? draggedCardInfo.dropRect.top : draggedCardInfo.rect.top}px`,
            width: `${draggedCardInfo.dropRect ? draggedCardInfo.dropTargetWidth ?? draggedCardInfo.dropRect.width : draggedCardInfo.rect.width}px`,
            height: `${draggedCardInfo.dropRect ? draggedCardInfo.dropTargetHeight ?? draggedCardInfo.dropRect.height : draggedCardInfo.rect.height}px`,
            zIndex: 9999,
            pointerEvents: 'none',
            transform: draggedCardInfo.dropRect
              ? 'translate3d(0px, 0px, 0px) scale(1) rotate(0deg)'
              : 'translate3d(0px, 0px, 0px) scale(1.04) rotate(1.5deg)',
            transition: draggedCardInfo.dropRect
              ? 'all 300ms cubic-bezier(0.2, 0.8, 0.2, 1)'
              : 'none',
            willChange: 'transform, left, top',
          }}
          className="bg-surface rounded-2xl border border-indigo-500 shadow-2xl p-4 flex flex-col select-none border-t-4 border-t-indigo-600 font-sans"
        >
          <div className="flex items-start justify-between gap-3 mb-1.5 font-sans">
            <h4 className="font-bold text-text-primary tracking-tight text-sm leading-snug break-words">
              {draggedCardInfo.title}
            </h4>
          </div>
          {draggedCardInfo.description && (
            <p className="text-text-secondary text-xs leading-relaxed mb-4 break-words line-clamp-2">
              {draggedCardInfo.description}
            </p>
          )}
          <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider border ${getPriorityClasses(draggedCardInfo.priority)}`}>
              {draggedCardInfo.priority || 'None'}
            </span>
            <span className="text-[10px] text-indigo-600 font-mono font-bold tracking-tight bg-indigo-50 px-1.5 py-0.5 rounded-md">
              MOVING
            </span>
          </div>
        </div>
      )}

        </>
      )}


      {/* ================= BOTTOM SHEET OVERLAYS ================= */}

      {/* OVERLAY SHEET A: SPACE PICKER BOTTOM LIST */}
      {showSpacePickerSheet && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs flex items-end justify-center z-50 p-0 animate-fade-in" id="space-picker-backdrop">
          <div className="w-full bg-surface rounded-t-3xl border-t border-border shadow-2xl flex flex-col max-h-[75vh]" id="space-picker-sheet">
            
            {/* Grab drag handle */}
            <div className="flex flex-col items-center py-3 border-b border-border" id="space-sheet-handle">
              <div className="w-12 h-1 rounded-full bg-border" />
              <h3 className="font-extrabold text-sm text-text-primary mt-2.5">Switch Project Space</h3>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2" id="space-sheet-scrollable">
              {spaces.map(sp => {
                const isActive = sp.id === currentSpace?.id;
                return (
                  <button
                    key={sp.id}
                    onClick={() => {
                      setSelectedSpaceId(sp.id!);
                      setShowSpacePickerSheet(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl active-bounce cursor-pointer ${
                      isActive ? 'bg-background font-bold text-text-primary' : 'hover:bg-background/50 text-text-secondary'
                    }`}
                    id={`picker-space-${sp.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: sp.color }} />
                      <span className="text-text-primary text-sm">{sp.name}</span>
                    </div>
                    {isActive && <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0" />}
                  </button>
                );
              })}

              <button
                onClick={() => {
                  setShowNewSpaceSheet(true);
                }}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-indigo-650 bg-indigo-50/50 hover:bg-indigo-50 active-bounce cursor-pointer font-bold text-sm mt-4 min-h-[44px]"
                id="picker-btn-add-space"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Launch New Workspace...</span>
              </button>
            </div>

            <div className="p-4 border-t border-border shrink-0" id="space-sheet-footer">
              <button
                onClick={() => setShowSpacePickerSheet(false)}
                className="w-full bg-background hover:bg-background/80 text-text-primary font-bold text-sm py-3 rounded-2xl active-bounce cursor-pointer min-h-[44px]"
                id="btn-close-space-picker"
              >
                Close View
              </button>
            </div>

          </div>
        </div>
      )}


      {/* OVERLAY SHEET B: CREATE NEW SPACE FORM */}
      {showNewSpaceSheet && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs flex items-end justify-center z-50 p-0 animate-fade-in" id="new-space-backdrop">
          <div className="w-full bg-surface rounded-t-3xl border-t border-border shadow-2xl flex flex-col max-h-[85vh]" id="new-space-sheet" style={{ paddingBottom: 'env(keyboard-inset-height, 0px)' }}>
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-border" id="new-space-header">
              <h3 className="font-extrabold text-sm text-text-primary">Launch Workspace Space</h3>
              <button 
                onClick={() => setShowNewSpaceSheet(false)}
                className="p-2 text-zinc-400 hover:text-zinc-650 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSpace} className="flex-1 overflow-y-auto p-6 space-y-5" id="new-space-form">
              <div className="flex gap-3 pb-4 border-b border-border" id="sheet-space-actions">
                <button
                  type="button"
                  onClick={() => setShowNewSpaceSheet(false)}
                  className="flex-1 bg-background text-text-primary font-bold text-xs py-3 rounded-xl active-bounce cursor-pointer min-h-[44px]"
                  id="btn-sheet-space-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl shadow-md active-bounce cursor-pointer min-h-[44px]"
                  id="btn-sheet-space-submit"
                >
                  Create Space
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Space Title</label>
                <input 
                  type="text"
                  placeholder="e.g., Household Errands, Client Work..."
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-surface border border-border focus:outline-hidden focus:border-indigo-500 focus:bg-surface text-sm text-text-primary"
                  required
                  autoFocus
                  id="input-sheet-space-name"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Workspace Accent Tone</label>
                <div className="grid grid-cols-4 gap-3" id="sheet-color-grid">
                  {['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#06b6d4'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewSpaceColor(color)}
                      className={`h-11 rounded-xl border-2 transition-transform cursor-pointer flex items-center justify-center ${
                        newSpaceColor === color ? 'border-zinc-940 scale-102 font-bold' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                      id={`choice-color-${color.replace('#', '')}`}
                    >
                      {newSpaceColor === color && <span className="text-white text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Space Theme Palette</label>
                <div className="grid grid-cols-2 gap-3.5" id="sheet-theme-grid">
                  {THEME_LIST.map(theme => {
                    const palette = PALETTES[theme.id];
                    const isSelected = newSpaceThemeId === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => {
                          setNewSpaceThemeId(theme.id);
                          setNewSpaceColor(palette['--color-accent']);
                        }}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between text-left ${
                          isSelected ? 'border-indigo-500 bg-background shadow-xs' : 'border-border hover:border-zinc-305 bg-surface'
                        }`}
                        id={`choice-theme-${theme.id}`}
                      >
                        <span className="text-xs font-extrabold text-text-primary truncate mr-2">{theme.name}</span>
                        <div className="flex shrink-0 border border-border/50 rounded-md overflow-hidden h-4 w-9">
                          <div 
                            className="w-1/2 h-full" 
                            style={{ backgroundColor: palette['--color-accent'] }} 
                          />
                          <div 
                            className="w-1/2 h-full" 
                            style={{ backgroundColor: palette['--color-background'] }} 
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </form>

          </div>
        </div>
      )}


      {/* OVERLAY SHEET C: CREATE ACTIVE LANE LANE / PAGE */}
      {showNewPageSheet && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs flex items-end justify-center z-50 p-0 animate-fade-in" id="new-page-backdrop">
          <div className="w-full bg-surface rounded-t-3xl border-t border-border shadow-2xl flex flex-col max-h-[80vh]" id="new-page-sheet" style={{ paddingBottom: 'env(keyboard-inset-height, 0px)' }}>
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-border" id="new-page-header">
              <h3 className="font-extrabold text-sm text-text-primary">Add Board Stage Lane</h3>
              <button 
                onClick={() => setShowNewPageSheet(false)}
                className="p-2 text-zinc-400 hover:text-zinc-650 rounded-lg cursor-pointer animate-duration-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePage} className="p-6 space-y-5" id="new-page-form">
              <div className="flex gap-3 pb-4 border-b border-border" id="sheet-page-actions">
                <button
                  type="button"
                  onClick={() => setShowNewPageSheet(false)}
                  className="flex-1 bg-background text-text-primary font-bold text-xs py-3 rounded-xl active-bounce cursor-pointer min-h-[44px]"
                  id="btn-sheet-page-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl shadow-md active-bounce cursor-pointer min-h-[44px]"
                  id="btn-sheet-page-submit"
                >
                  Launch Stage
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Stage Title Name</label>
                <input 
                  type="text"
                  placeholder="e.g., Icebox, Testing, Blocked..."
                  value={newPageName}
                  onChange={(e) => setNewPageName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-surface border border-border focus:outline-hidden focus:border-indigo-500 focus:bg-surface text-sm text-text-primary"
                  required
                  autoFocus
                  id="input-sheet-page-name"
                />
              </div>
            </form>

          </div>
        </div>
      )}
      {currentActiveNoteTask && (
        <NoteView
          task={currentActiveNoteTask}
          pages={pages}
          onClose={handleCloseNoteView}
          handleDeleteTask={handleDeleteTask}
          scheduleSync={scheduleSync}
        />
      )}

      {/* OVERLAY SHEET E / MOVE-OR-DELETE-ALL LANE DELETION WINDOW */}
      {deletingPageId && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="delete-lane-backdrop">
          <div className="absolute inset-0" onClick={() => setDeletingPageId(null)} />
          
          <div className="w-full max-w-md bg-surface rounded-3xl border border-border shadow-2xl flex flex-col relative z-10 overflow-hidden" id="delete-lane-sheet">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-rose-50/10" id="delete-lane-header">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-4.5 h-4.5" />
                <h3 className="font-extrabold text-sm text-text-primary">Delete Board Stage Lane</h3>
              </div>
              <button 
                onClick={() => setDeletingPageId(null)}
                className="p-2 text-zinc-400 hover:text-zinc-650 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest leading-none">TARGET LANE</span>
                <h4 className="text-lg font-black text-text-primary leading-snug">"{pages.find(p => p.id === deletingPageId)?.name}"</h4>
              </div>

              {tasks.filter(t => t.spaceId === currentSpace?.id && t.pageId === deletingPageId).length > 0 ? (
                <>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    This lane currently holds <strong className="text-text-primary font-extrabold">{tasks.filter(t => t.spaceId === currentSpace?.id && t.pageId === deletingPageId).length} cards</strong>. Choose how to handle these active records:
                  </p>

                  {/* Option 1: Move Logic */}
                  <div className="p-4 bg-background border border-border/60 rounded-2xl space-y-3" id="delete-lane-move-option">
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
                        <span className="text-[10px] font-black">1</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-bold text-text-primary text-xs">Migrate Cards to Alternative Lane</h5>
                        <p className="text-[11px] text-zinc-450 mt-0.5">Move all cards into another page column before deleting this column.</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 relative">
                        <select
                          value={moveToPageId || ''}
                          onChange={(e) => setMoveToPageId(Number(e.target.value))}
                          className="w-full h-11 pl-3.5 pr-8 rounded-xl bg-surface border border-border text-xs font-bold text-text-primary focus:outline-hidden focus:border-indigo-500 appearance-none shadow-2xs"
                          id="delete-lane-select"
                        >
                          {pages.filter(p => p.id !== deletingPageId).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </div>

                      <button
                        onClick={() => handleConfirmDeletePage(false)}
                        className="h-11 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors active-bounce cursor-pointer whitespace-nowrap"
                        id="delete-lane-btn-move"
                      >
                        Migrate & Delete
                      </button>
                    </div>
                  </div>

                  {/* Option 2: Destroy Logic */}
                  <div className="p-4 bg-rose-50/40 border border-rose-100 rounded-2xl space-y-3" id="delete-lane-purge-option">
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0 mt-0.5">
                        <span className="text-[10px] font-black">2</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-bold text-rose-805 text-xs">Destroy All Internal Cards</h5>
                        <p className="text-[11px] text-rose-600/70 mt-0.5">This permanently purges all the card records inside this column.</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleConfirmDeletePage(true)}
                      className="w-full h-11 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors active-bounce cursor-pointer flex items-center justify-center gap-1"
                      id="delete-lane-btn-purge"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Purge Cards & Delete Lane</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    This lane is empty. Are you sure you want to remove it from this workspace board stages?
                  </p>

                  <div className="flex gap-3 pt-4" id="delete-lane-empty-actions">
                    <button
                      onClick={() => setDeletingPageId(null)}
                      className="flex-1 bg-background hover:bg-background/80 text-text-primary font-bold text-xs py-3 rounded-xl active-bounce cursor-pointer min-h-[44px]"
                      id="delete-lane-empty-cancel"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleConfirmDeletePage(false)}
                      className="flex-1 bg-rose-605 hover:bg-rose-705 text-white bg-rose-600 hover:bg-rose-700 font-bold text-xs py-3 rounded-xl shadow-md active-bounce cursor-pointer min-h-[44px]"
                      id="delete-lane-empty-confirm"
                    >
                      Remove Empty Lane
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY SHEET F / SPACE DELETION CONFIRMATION WINDOW */}
      {pendingDeleteSpaceId !== null && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs flex items-end justify-center z-50 p-0 animate-fade-in" id="delete-space-backdrop">
          <div className="absolute inset-0" onClick={() => setPendingDeleteSpaceId(null)} />
          
          <div className="w-full bg-surface rounded-t-3xl border-t border-border shadow-2xl flex flex-col relative z-50 max-h-[85vh]" id="delete-space-sheet">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-rose-50/10" id="delete-space-header">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-4.5 h-4.5" />
                <h3 className="font-extrabold text-sm text-text-primary">Delete Workspace Space</h3>
              </div>
              <button 
                onClick={() => setPendingDeleteSpaceId(null)}
                className="p-2 text-zinc-400 hover:text-zinc-650 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 bg-surface">
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-405 font-bold uppercase tracking-widest leading-none">TARGET SPACE</span>
                <h4 className="text-lg font-black text-text-primary leading-snug">"{pendingDeleteSpaceName}"</h4>
              </div>

              <p className="text-xs text-zinc-500 leading-relaxed">
                Are you absolutely sure you want to delete this workspace? All pages, board lanes, and card records inside <strong className="text-text-primary font-extrabold">{pendingDeleteSpaceName}</strong> will be permanently deleted across all devices. This action cannot be undone.
              </p>

              <div className="flex gap-3 pt-4 border-t border-border" id="delete-space-actions">
                <button
                  type="button"
                  onClick={() => setPendingDeleteSpaceId(null)}
                  className="flex-1 bg-background hover:bg-background/85 text-text-primary font-bold text-xs py-3 rounded-xl active-bounce cursor-pointer min-h-[44px]"
                  id="delete-space-cancel"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteSpace}
                  className="flex-1 text-white bg-rose-600 hover:bg-rose-700 font-bold text-xs py-3 rounded-xl shadow-md active-bounce cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5"
                  id="delete-space-confirm"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Space</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY SHEET G / RENAME LANE / PAGE WINDOW */}
      {renamingPageId !== null && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs flex items-end justify-center z-50 p-0 animate-fade-in" id="rename-lane-backdrop">
          <div className="absolute inset-0" onClick={() => setRenamingPageId(null)} />
          
          <div className="w-full bg-surface rounded-t-3xl border-t border-border shadow-2xl flex flex-col relative z-50 max-h-[85vh]" id="rename-lane-sheet" style={{ paddingBottom: 'env(keyboard-inset-height, 0px)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border" id="rename-lane-header">
              <h3 className="font-extrabold text-sm text-text-primary">Rename Board Stage Lane</h3>
              <button 
                onClick={() => setRenamingPageId(null)}
                className="p-2 text-zinc-400 hover:text-zinc-650 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (renamePageInput.trim()) {
                  handleRenamePage(renamingPageId, renamePageInput.trim());
                  setRenamingPageId(null);
                }
              }}
              className="p-6 space-y-5 bg-surface"
              id="rename-lane-form"
            >
              <div className="flex gap-3 pb-4 border-b border-border" id="sheet-rename-lane-actions">
                <button
                  type="button"
                  onClick={() => setRenamingPageId(null)}
                  className="flex-1 bg-background hover:bg-background/85 text-text-primary font-bold text-xs py-3 rounded-xl active-bounce cursor-pointer min-h-[44px]"
                  id="btn-sheet-rename-lane-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl shadow-md active-bounce cursor-pointer min-h-[44px]"
                  id="btn-sheet-rename-lane-submit"
                >
                  Confirm Rename
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Stage Title Name</label>
                <input 
                  type="text"
                  ref={(input) => input && input.focus()}
                  placeholder="e.g., Icebox, Testing, Blocked..."
                  value={renamePageInput}
                  onChange={(e) => setRenamePageInput(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-surface border border-border focus:outline-hidden focus:border-indigo-500 focus:bg-surface text-sm text-text-primary"
                  id="input-sheet-rename-lane-name"
                />
              </div>
            </form>
          </div>
        </div>
      )}


    </motion.div>
  );
}
