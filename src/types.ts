export type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export interface Task {
  id: string;
  title: string;
  frequency: Frequency;
  category: string;
  dayOfWeek?: number; // 0-6 (Sunday-Saturday)
  dayOfMonth?: number; // 1-31
  isCustom?: boolean;
  userId?: string;
}

export interface TaskCompletion {
  id?: string;
  taskId: string;
  userId: string;
  completedAt: any;
  date: string; // YYYY-MM-DD
}

export interface Reminder {
  id?: string;
  taskId: string;
  userId: string;
  time: string; // HH:mm
  enabled: boolean;
}

export interface ShoppingItem {
  id?: string;
  userId: string;
  name: string;
  completed: boolean;
  createdAt: any;
}

export type ThemeColor = 'violet' | 'ocean' | 'forest' | 'minimalist' | 'pink' | 'orange';

export interface UserPreferences {
  darkMode: boolean;
  themeColor: ThemeColor;
  location?: {
    city: string;
    lat: number;
    lon: number;
  };
}
