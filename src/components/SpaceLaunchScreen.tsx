import React, { useRef, useCallback, useState } from 'react';
import { User, LogOut, Pin, Plus, ArrowRight, Folder, Trash2, Pencil, X } from 'lucide-react';
import { motion } from 'motion/react';
import { Space, Page, Task } from '../db';

interface SpaceLaunchScreenProps {
  currentUser: { displayName?: string | null; email?: string | null } | null;
  spaces: Space[];
  allPages: Page[];
  tasks: Task[];
  onSelectSpace: (spaceId: number) => void;
  onTogglePin: (spaceId: number) => void;
  onSignOut: () => void;
  onCreateSpaceClick: () => void;
  onDeleteSpace: (spaceId: number, name: string) => void;
  onRenameSpace: (spaceId: number, newName: string) => void;
}

interface LauncherSpaceCardProps {
  space: Space;
  cardCount: number;
  stageCount: number;
  onSelectSpace: (spaceId: number) => void;
  onTogglePin: (spaceId: number) => void;
  onDeleteSpace: (spaceId: number, name: string) => void;
  onRenameSpaceClick: (space: Space) => void;
  showDelete: boolean;
}

const LauncherSpaceCard: React.FC<LauncherSpaceCardProps> = ({
  space,
  cardCount,
  stageCount,
  onSelectSpace,
  onTogglePin,
  onDeleteSpace,
  onRenameSpaceClick,
  showDelete,
}) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const start = useCallback(() => {
    isLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onDeleteSpace(space.id!, space.name);
    }, 750); // 750ms hold to trigger delete
  }, [space.id, space.name, onDeleteSpace]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onClick = useCallback((e: React.MouseEvent) => {
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressRef.current = false;
    } else {
      onSelectSpace(space.id!);
    }
  }, [space.id, onSelectSpace]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onMouseDown={start}
      onTouchStart={start}
      onMouseUp={stop}
      onTouchEnd={stop}
      onMouseLeave={stop}
      onTouchMove={stop}
      onClick={onClick}
      className="bg-surface hover:bg-background/80 border border-border rounded-2xl p-5 relative cursor-pointer shadow-xs hover:shadow-md group flex flex-col justify-between min-h-[145px] transition-colors select-none"
      id={`space-card-${space.id}`}
    >
      {/* Top bar */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full shrink-0 shadow-xs"
            style={{ backgroundColor: space.color }}
          />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-extrabold text-text-primary text-sm leading-snug truncate max-w-[120px] sm:max-w-[140px]">
                {space.name}
              </span>
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRenameSpaceClick(space);
                }}
                className="p-1 rounded-full text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer shrink-0"
                title="Rename Space"
                id={`rename-space-btn-${space.id}`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              {showDelete && (
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDeleteSpace(space.id!, space.name);
                  }}
                  className="p-1 rounded-full text-zinc-400 hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                  title="Delete Space"
                  id={`delete-space-btn-${space.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <span className="text-[10px] text-zinc-400 font-medium leading-none mt-1">
              (Hold to delete)
            </span>
          </div>
        </div>
        {/* Pin Button */}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin(space.id!);
          }}
          className={`p-1 px-1.5 rounded-lg cursor-pointer flex items-center justify-center transition-colors shadow-2xs ${
            space.pinned 
              ? 'text-indigo-500 hover:text-indigo-650 bg-indigo-50 border border-indigo-100' 
              : 'text-text-secondary hover:text-indigo-500 bg-background hover:bg-background/80 border border-border'
          }`}
          title={space.pinned ? "Unpin this space" : "Pin this space to top"}
          id={`pin-btn-${space.id}`}
        >
          <Pin className={`w-3.5 h-3.5 ${space.pinned ? 'fill-indigo-500' : 'transform group-hover:scale-95 transition-transform'}`} />
        </button>
      </div>

      {/* Stat Counters & Visual Aid */}
      <div className="mt-4 flex items-center justify-between" id={`stat-panel-${space.id}`}>
        <div className="flex items-center gap-2">
          <div className="bg-background border border-border rounded-xl px-2.5 py-1 text-center min-w-[56px]">
            <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider leading-none">Cards</div>
            <div className="text-xs font-black text-text-primary mt-0.5">{cardCount}</div>
          </div>
          <div className="bg-background border border-border rounded-xl px-2.5 py-1 text-center min-w-[56px]">
            <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider leading-none">Stages</div>
            <div className="text-xs font-black text-text-primary mt-0.5">{stageCount}</div>
          </div>
        </div>

        <span className="text-xs font-bold text-indigo-650 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
          {space.pinned ? 'Open' : 'Launch'} <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </motion.div>
  );
};

export const SpaceLaunchScreen: React.FC<SpaceLaunchScreenProps> = ({
  currentUser,
  spaces,
  allPages,
  tasks,
  onSelectSpace,
  onTogglePin,
  onSignOut,
  onCreateSpaceClick,
  onDeleteSpace,
  onRenameSpace,
}) => {
  const [renamingSpace, setRenamingSpace] = useState<Space | null>(null);
  const [renameInput, setRenameInput] = useState<string>('');

  const handleStartRename = (space: Space) => {
    setRenamingSpace(space);
    setRenameInput(space.name);
  };

  // Sort helper: sorted by name alphabetically
  const sortByName = (a: Space, b: Space) => a.name.localeCompare(b.name);

  // Separate pinned and unpinned spaces
  const pinnedSpaces = spaces.filter((sp) => sp.pinned).sort(sortByName);
  const unpinnedSpaces = spaces.filter((sp) => !sp.pinned).sort(sortByName);

  // Helper to find count of stages (pages) for a space
  const getSpacePagesCount = (spaceId: number) => {
    return allPages.filter((p) => p.spaceId === spaceId).length;
  };

  // Helper to find count of tasks (cards) in that space
  const getSpaceTasksCount = (spaceId: number) => {
    const spacePages = allPages.filter((p) => p.spaceId === spaceId);
    const pIds = spacePages.map((p) => p.id!);
    return tasks.filter((t) => pIds.includes(t.pageId)).length;
  };

  return (
    <div className="min-h-screen w-full bg-background flex flex-col font-sans select-none overflow-y-auto" id="launch-screen-container">
      {/* 1. Header Navigation Bar */}
      <header className="shrink-0 bg-surface border-b border-border z-30" id="launch-header">
        <div className="max-w-4xl mx-auto h-16 px-4 md:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3" id="launch-user-info">
            <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <User className="w-4.5 h-4.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider leading-none mb-1">Signed in as</span>
              <span className="text-sm font-bold text-text-primary truncate max-w-[200px] md:max-w-[300px]">
                {currentUser?.displayName || currentUser?.email || 'Workspace User'}
              </span>
            </div>
          </div>

          <button
            onClick={onSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-text-secondary hover:text-rose-500 hover:bg-rose-50/10 border border-border rounded-xl transition-all h-9 cursor-pointer shadow-2xs"
            title="Sign Out of Workspace"
            id="launch-signout-btn"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* 2. Main Content Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 md:px-6 py-8 flex flex-col justify-between" id="launch-main">
        <div className="space-y-8">
          {/* Dashboard Intro */}
          <div className="select-none text-center sm:text-left">
            <h1 className="text-3xl font-black tracking-tight text-text-primary mb-2">
              Select Workspace Space
            </h1>
            <p className="text-sm text-zinc-500 font-medium">
              Pick a contextual space layer to launch your interactive kanban board stage (Long-press/hold a card to delete it)
            </p>
          </div>

          {spaces.length === 0 ? (
            <div className="text-center py-16 bg-surface rounded-3xl border border-border p-8 flex flex-col items-center shadow-xs" id="launch-empty-state">
              <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4 border border-indigo-100 animate-bounce">
                <Folder className="w-8 h-8 stroke-[1.5]" />
              </div>
              <h3 className="font-extrabold text-text-primary text-lg mb-2">No Spaces Created Yet</h3>
              <p className="text-sm text-zinc-500 max-w-md mx-auto leading-relaxed mb-6">
                Organize your tasks, notes, and progress stages. Create a designated Space to build custom workspace tracking boards.
              </p>
              <button
                onClick={onCreateSpaceClick}
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-805 text-white font-bold text-sm px-6 py-3.5 rounded-2xl shadow-md hover:shadow-lg transition-all duration-150 active-bounce cursor-pointer min-h-[44px]"
                id="launch-empty-create-btn"
              >
                <Plus className="w-4.5 h-4.5" />
                <span>Create your first Space</span>
              </button>
            </div>
          ) : (
            <>
              {/* SECTION A: PINNED SPACES */}
              {pinnedSpaces.length > 0 && (
                <div className="space-y-3" id="section-pinned-spaces">
                  <div className="flex items-center gap-2 px-1">
                    <Pin className="w-3.5 h-3.5 text-indigo-500 fill-indigo-500" />
                    <h2 className="text-xs font-extrabold text-zinc-400 uppercase tracking-widest leading-none">
                      Pinned Spaces
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {pinnedSpaces.map((sp) => (
                      <LauncherSpaceCard
                        key={sp.id}
                        space={sp}
                        cardCount={getSpaceTasksCount(sp.id!)}
                        stageCount={getSpacePagesCount(sp.id!)}
                        onSelectSpace={onSelectSpace}
                        onTogglePin={onTogglePin}
                        onDeleteSpace={onDeleteSpace}
                        onRenameSpaceClick={handleStartRename}
                        showDelete={spaces.length > 1}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION B: ALL SPACES / OTHER SPACES */}
              <div className="space-y-3" id="section-all-spaces">
                <div className="px-1">
                  <h2 className="text-xs font-extrabold text-zinc-400 uppercase tracking-widest leading-none">
                    {pinnedSpaces.length > 0 ? 'All Spaces' : 'Spaces'}
                  </h2>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {unpinnedSpaces.map((sp) => (
                    <LauncherSpaceCard
                      key={sp.id}
                      space={sp}
                      cardCount={getSpaceTasksCount(sp.id!)}
                      stageCount={getSpacePagesCount(sp.id!)}
                      onSelectSpace={onSelectSpace}
                      onTogglePin={onTogglePin}
                      onDeleteSpace={onDeleteSpace}
                      onRenameSpaceClick={handleStartRename}
                      showDelete={spaces.length > 1}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 3. New Space Creation Call to Action Button */}
        {spaces.length > 0 && (
          <div className="mt-12 mb-4 flex justify-center" id="launch-cta-panel">
            <button
              onClick={onCreateSpaceClick}
              className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-sm px-6 py-3.5 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-150 active-bounce cursor-pointer min-h-[48px] w-full sm:w-auto"
              id="launch-create-space-btn"
            >
              <Plus className="w-4.5 h-4.5" />
              <span>Launch New Workspace Space</span>
            </button>
          </div>
        )}
      </main>

      {/* OVERLAY SHEET: RENAME SPACE FORM */}
      {renamingSpace && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs flex items-end justify-center z-50 p-0 animate-fade-in" id="rename-space-backdrop">
          <div className="w-full bg-surface rounded-t-3xl border-t border-border shadow-2xl flex flex-col max-h-[80vh]" id="rename-space-sheet" style={{ paddingBottom: 'env(keyboard-inset-height, 0px)' }}>
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface" id="rename-space-header">
              <h3 className="font-extrabold text-sm text-text-primary">Rename Space</h3>
              <button 
                onClick={() => setRenamingSpace(null)}
                className="p-2 text-zinc-400 hover:text-zinc-650 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (renameInput.trim()) {
                  onRenameSpace(renamingSpace.id!, renameInput.trim());
                  setRenamingSpace(null);
                }
              }}
              className="p-6 space-y-5 bg-surface"
              id="rename-space-form"
            >
              <div className="flex gap-3 pb-4 border-b border-border" id="sheet-rename-space-actions">
                <button
                  type="button"
                  onClick={() => setRenamingSpace(null)}
                  className="flex-1 bg-background hover:bg-background/80 text-text-primary font-bold text-xs py-3 rounded-xl active-bounce cursor-pointer min-h-[44px]"
                  id="btn-sheet-rename-space-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl shadow-md active-bounce cursor-pointer min-h-[44px]"
                  id="btn-sheet-rename-space-submit"
                >
                  Confirm Rename
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Space Name</label>
                <input 
                  type="text"
                  ref={(input) => input && input.focus()}
                  placeholder="e.g., Household Errands, Client Work..."
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-surface border border-border focus:outline-hidden focus:border-indigo-500 focus:bg-surface text-sm text-text-primary"
                  id="input-sheet-rename-space-name"
                />
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
};
