import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { 
  ChevronLeft, 
  Bold, 
  Italic, 
  Heading1, 
  Heading2, 
  List, 
  CheckSquare, 
  Trash2
} from 'lucide-react';
import { Task, Page, db } from '../db';

interface NoteViewProps {
  task: Task;
  pages: Page[];
  onClose: () => void;
  handleDeleteTask: (id: number) => void;
  scheduleSync: () => void;
}

export default function NoteView({
  task,
  pages,
  onClose,
  handleDeleteTask,
  scheduleSync
}: NoteViewProps) {
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | null>(task.priority);
  const [editorContent, setEditorContent] = useState<string>(task.notes || '');

  // Load content only once on mount to prevent reset while typing
  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: (() => {
      if (!task.notes) return '';
      try {
        return JSON.parse(task.notes);
      } catch (e) {
        return task.notes; // fallback to string if not JSON
      }
    })(),
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[300px] max-w-none text-zinc-800 leading-relaxed px-6 py-4 pb-20 prose prose-sm focus:ring-0',
        style: 'outline: none; -webkit-user-select: text; user-select: text;',
      },
      handleDOMEvents: {
        contextmenu: () => true,
      },
    },
  });

  // Track editor changes
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      const jsonStr = JSON.stringify(editor.getJSON());
      setEditorContent(jsonStr);
    };

    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
    };
  }, [editor]);

  // Debounced auto-save effect
  useEffect(() => {
    const timer = setTimeout(async () => {
      const dbTask = await db.entries.get(task.id!);
      if (!dbTask) return;

      // Only write if some core values actually changed
      if (
        dbTask.title !== title ||
        dbTask.notes !== editorContent ||
        dbTask.priority !== priority
      ) {
        await db.entries.update(task.id!, {
          title,
          notes: editorContent,
          priority,
          updatedAt: Date.now(),
        });
        scheduleSync();
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [title, editorContent, priority, task.id, scheduleSync]);

  const handlePriorityChange = async (newPrio: 'low' | 'medium' | 'high' | null) => {
    setPriority(newPrio);
    
    let newPriorityOrder: number | null = null;
    if (newPrio !== null) {
      const allExisting = await db.entries.toArray();
      const countInNewPrio = allExisting.filter(
        t => t.pageId === task.pageId && t.priority === newPrio
      ).length;

      // "append it at the end of the new priority section (count of existing cards in that priority + 1)"
      newPriorityOrder = countInNewPrio + 1;
    }

    await db.entries.update(task.id!, {
      priority: newPrio,
      priorityOrder: newPriorityOrder,
      updatedAt: Date.now()
    });

    scheduleSync();
  };

  const handleDelete = async () => {
    if (confirm('Permanently delete this card note?')) {
      await handleDeleteTask(task.id!);
      onClose();
    }
  };

  const handleClose = async () => {
    const finalTitle = title.trim() || 'Untitled';
    await db.entries.update(task.id!, {
      title: finalTitle,
      notes: editorContent,
      priority,
      updatedAt: Date.now(),
    });
    scheduleSync();
    onClose();
  };

  const pageName = pages.find(p => p.id === task.pageId)?.name || 'Default';

  return (
    <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-0 md:p-4 select-none">
      <div className="absolute inset-0" onClick={handleClose} />

      <motion.div
        layoutId={`task-card-container-${task.id}`}
        layoutDependency={task.id}
        className="w-full h-full md:max-w-2xl md:h-[90vh] bg-white rounded-none md:rounded-3xl border border-zinc-200 shadow-2xl relative flex flex-col overflow-hidden z-10"
        id={`note-view-panel-${task.id}`}
      >
        <style>{`
          /* Custom stylish TipTap styling */
          .ProseMirror {
            outline: none !important;
          }
          .ProseMirror p {
            margin-bottom: 0.75rem;
          }
          .ProseMirror h1 {
            font-size: 1.5rem;
            font-weight: 800;
            color: #18181b;
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
          }
          .ProseMirror h2 {
            font-size: 1.25rem;
            font-weight: 700;
            color: #18181b;
            margin-top: 1.25rem;
            margin-bottom: 0.5rem;
          }
          .ProseMirror ul {
            list-style-type: disc;
            padding-left: 1.5rem;
            margin-bottom: 0.75rem;
          }
          .ProseMirror ol {
            list-style-type: decimal;
            padding-left: 1.5rem;
            margin-bottom: 0.75rem;
          }
          /* TipTap Checklist styling */
          .ProseMirror ul[data-type="taskList"] {
            list-style: none;
            padding: 0;
          }
          .ProseMirror li[data-type="taskItem"] {
            display: flex;
            align-items: flex-start;
            gap: 0.5rem;
            margin-bottom: 0.35rem;
          }
          .ProseMirror li[data-type="taskItem"] > label {
            margin-top: 0.15rem;
            user-select: none;
          }
          .ProseMirror li[data-type="taskItem"] input[type="checkbox"] {
            appearance: none;
            background-color: #fff;
            margin: 0;
            font: inherit;
            color: currentColor;
            width: 1.15em;
            height: 1.15em;
            border: 2px solid #d1d5db;
            border-radius: 0.25rem;
            transform: translateY(-0.075em);
            display: grid;
            place-content: center;
            cursor: pointer;
          }
          .ProseMirror li[data-type="taskItem"] input[type="checkbox"]::before {
            content: "";
            width: 0.65em;
            height: 0.65em;
            transform: scale(0);
            transition: 120ms transform ease-in-out;
            box-shadow: inset 1em 1em #4f46e5;
            transform-origin: bottom left;
            clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
          }
          .ProseMirror li[data-type="taskItem"] input[type="checkbox"]:checked {
            border-color: #4f46e5;
          }
          .ProseMirror li[data-type="taskItem"] input[type="checkbox"]:checked::before {
            transform: scale(1);
          }
          .ProseMirror li[data-type="taskItem"][data-checked="true"] > div {
            text-decoration: line-through;
            color: #a1a1aa;
          }
        `}</style>

        {/* 1. Header Area: Closed Chevron Left + Subtle Lane Name Right */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-white select-none shrink-0" id="note-header-bar">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex items-center justify-center p-2 rounded-xl text-zinc-500 hover:text-zinc-850 hover:bg-zinc-100 min-w-[44px] min-h-[44px] cursor-pointer"
              id="note-back-button"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center justify-center p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 min-w-[44px] min-h-[44px] cursor-pointer"
              title="Delete Note"
              id="note-delete-button"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
          <div className="text-xs font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50/80 px-2.5 py-1 rounded-lg">
            {pageName}
          </div>
        </header>

        {/* 2. Editable Title Input (Prominent, large font size) */}
        <div className="px-6 pt-6 shrink-0 relative select-text">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-2xl font-extrabold text-zinc-800 placeholder-zinc-300 border-none outline-none focus:outline-none focus:ring-0 p-0"
            placeholder="Untitled"
            id="note-title-input"
          />
        </div>

        {/* 3. TipTap Editor Area with Overflow scroll */}
        <div 
          className="flex-1 overflow-y-auto select-text min-h-0 bg-white" 
          id="note-editor-canvas"
          onContextMenu={(e) => e.preventDefault()}
        >
          <EditorContent editor={editor} />
        </div>

        {/* Bubble Menu selection pops up over selection */}
        {editor && (
          <BubbleMenu editor={editor}>
            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 shadow-xl rounded-2xl p-1 text-white select-none z-50">
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-2 rounded-xl transition-colors hover:bg-zinc-805 cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center ${
                  editor.isActive('bold') ? 'text-indigo-400 bg-zinc-800' : 'text-zinc-350'
                }`}
                title="Bold"
                id="bubble-btn-bold"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-2 rounded-xl transition-colors hover:bg-zinc-805 cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center ${
                  editor.isActive('italic') ? 'text-indigo-400 bg-zinc-800' : 'text-zinc-350'
                }`}
                title="Italic"
                id="bubble-btn-italic"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`p-2 rounded-xl transition-colors hover:bg-zinc-805 cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center ${
                  editor.isActive('heading', { level: 1 }) ? 'text-indigo-400 bg-zinc-800' : 'text-zinc-350'
                }`}
                title="Heading 1"
                id="bubble-btn-h1"
              >
                <Heading1 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-2 rounded-xl transition-colors hover:bg-zinc-805 cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center ${
                  editor.isActive('heading', { level: 2 }) ? 'text-indigo-400 bg-zinc-800' : 'text-zinc-350'
                }`}
                title="Heading 2"
                id="bubble-btn-h2"
              >
                <Heading2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-2 rounded-xl transition-colors hover:bg-zinc-805 cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center ${
                  editor.isActive('bulletList') ? 'text-indigo-400 bg-zinc-800' : 'text-zinc-350'
                }`}
                title="Bullet List"
                id="bubble-btn-bullet"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                className={`p-2 rounded-xl transition-colors hover:bg-zinc-805 cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center ${
                  editor.isActive('taskList') ? 'text-indigo-400 bg-zinc-800' : 'text-zinc-350'
                }`}
                title="Task List (Checkboxes)"
                id="bubble-btn-checklist"
              >
                <CheckSquare className="w-4 h-4" />
              </button>
            </div>
          </BubbleMenu>
        )}

        {/* 4. Fixed Priority Selector Footer */}
        <footer className="shrink-0 p-4 bg-zinc-50 border-t border-zinc-150 flex items-center justify-between select-none" id="note-view-footer">
          <div className="text-xs font-extrabold uppercase tracking-widest text-zinc-400">Priority Core</div>
          <div className="flex gap-1.5 w-[75%] max-w-[320px]">
            {(['high', 'medium', 'low', null] as const).map((prio) => (
              <button
                key={prio ?? 'none'}
                type="button"
                onClick={() => handlePriorityChange(prio)}
                className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center border ${
                  priority === prio
                    ? prio === 'high'
                      ? 'border-rose-600 bg-rose-50 text-rose-700 shadow-xs'
                      : prio === 'medium'
                      ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-xs'
                      : prio === 'low'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-xs'
                      : 'border-zinc-500 bg-zinc-100 text-zinc-800 shadow-xs'
                    : 'border-zinc-200 text-zinc-400 bg-white hover:bg-zinc-50'
                }`}
                id={`note-prio-opt-${prio ?? 'none'}`}
              >
                {prio ?? 'None'}
              </button>
            ))}
          </div>
        </footer>
      </motion.div>
    </div>
  );
}
