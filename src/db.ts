import Dexie, { type Table } from 'dexie';

// Define entities interfaces
export interface Space {
  id?: number;
  name: string;
  icon: string; // lucide-react icon name e.g., "Folder", "Briefcase", "Home"
  color: string; // hex color string e.g., "#3b82f6"
  themeId?: string; // custom color theme ID (maps to ThemePalette)
  pinned?: boolean; // track if a space is pinned to launcher home
  createdAt: number;
  updatedAt: number;
}

export interface Page {
  id?: number;
  spaceId: number;
  name: string;
  order: number;
  icon: string; // lucide shadow icon name e.g., "CheckCircle", "Play", "Zap", "ArrowRight"
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id?: number;
  spaceId?: number; // Added to support direct spaceId query filter
  pageId: number;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'low' | 'medium' | 'high' | null;
  order: number;
  dueDate?: number;
  notes?: string; // Tiptap JSON content as stringified object
  priorityOrder?: number | null; // tracks the manual sort position within a priority group
  createdAt: number;
  updatedAt: number;
}

// Extends Dexie to hold tables
export class WorkspaceDatabase extends Dexie {
  spaces!: Table<Space>;
  pages!: Table<Page>;
  tasks!: Table<Task>;
  entries!: Table<Task>; // Support entries table

  constructor() {
    super('WorkspaceDatabase');
    
    // Define database tables and index mappings including entries
    this.version(4).stores({
      spaces: '++id, name, createdAt',
      pages: '++id, spaceId, name, order, createdAt',
      tasks: '++id, pageId, spaceId, status, priority, order, createdAt, notes, priorityOrder',
      entries: '++id, pageId, spaceId, status, priority, order, createdAt, notes, priorityOrder',
    });

    this.version(5).stores({
      spaces: '++id, name, createdAt',
      pages: '++id, spaceId, name, order, createdAt',
      tasks: '++id, pageId, spaceId, status, priority, order, createdAt, notes, priorityOrder',
      entries: '++id, pageId, spaceId, status, priority, order, createdAt, notes, priorityOrder',
    });
  }
}

// Instantiate the database
export const db = new WorkspaceDatabase();

/**
 * Returns a suitable default Lucide icon name based on page name
 */
export function getPageIcon(pageName: string): string {
  switch (pageName.toLowerCase()) {
    case 'start':
      return 'PlayCircle';
    case 'done':
      return 'CheckCircle2';
    case 'current':
      return 'PlayCircle';
    case 'active':
      return 'Zap';
    case 'next':
      return 'ArrowRightCircle';
    default:
      return 'FileText';
  }
}

/**
 * Seed function to initialize a default 'Personal' Space 
 * with one default page: 'Start'
 */
export async function seedDatabase(): Promise<{ spaceId: number; pageIds: number[] }> {
  return await db.transaction('rw', [db.spaces, db.pages], async () => {
    // 1. Create default space if it doesn't exist
    const defaultSpace = await db.spaces.where('name').equalsIgnoreCase('Personal').first();
    
    let spaceId: number;
    if (!defaultSpace) {
      spaceId = await db.spaces.add({
        name: 'Personal',
        icon: 'User',
        color: '#3b82f6', // Premium Indigo Blue
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    } else {
      spaceId = defaultSpace.id!;
    }

    // 2. Identify existing pages for the space to avoid duplicates
    const existingPages = await db.pages.where('spaceId').equals(spaceId).toArray();
    const existingNames = new Set(existingPages.map(p => p.name.toLowerCase()));

    const defaultPageNames = ['Start'];
    const pageIds: number[] = [];

    for (let i = 0; i < defaultPageNames.length; i++) {
      const pageName = defaultPageNames[i];
      if (!existingNames.has(pageName.toLowerCase())) {
        const pageId = await db.pages.add({
          spaceId,
          name: pageName,
          order: i,
          icon: getPageIcon(pageName),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        pageIds.push(pageId);
      } else {
        const found = existingPages.find(p => p.name.toLowerCase() === pageName.toLowerCase());
        if (found) pageIds.push(found.id!);
      }
    }

    return { spaceId, pageIds };
  });
}

// Automatically seed when the database is created
db.on('populate', async () => {
  await seedDatabase();
});
