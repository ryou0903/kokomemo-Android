import { v4 as uuidv4 } from 'uuid';
import type { Place, Tab, SearchHistory, AppSettings } from '../types';
import { DEFAULT_TABS, DEFAULT_SETTINGS } from '../types';

const STORAGE_KEYS = {
  PLACES: 'kokomemo_places',
  TABS: 'kokomemo_tabs',
  SEARCH_HISTORY: 'kokomemo_search_history',
  SETTINGS: 'kokomemo_settings',
} as const;

// Helper to safely parse JSON from localStorage
function safeJsonParse<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

// Places
export function getPlaces(): Place[] {
  return safeJsonParse<Place[]>(STORAGE_KEYS.PLACES, []);
}

export function savePlace(place: Omit<Place, 'id' | 'createdAt' | 'updatedAt'>): Place {
  const places = getPlaces();
  const now = new Date().toISOString();
  const newPlace: Place = {
    ...place,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
  };
  places.push(newPlace);
  localStorage.setItem(STORAGE_KEYS.PLACES, JSON.stringify(places));
  return newPlace;
}

export function updatePlace(
  id: string,
  updates: Partial<Omit<Place, 'id' | 'createdAt'>>
): Place | null {
  const places = getPlaces();
  const index = places.findIndex((p) => p.id === id);
  if (index === -1) return null;

  const updatedPlace: Place = {
    ...places[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  places[index] = updatedPlace;
  localStorage.setItem(STORAGE_KEYS.PLACES, JSON.stringify(places));
  return updatedPlace;
}

export function deletePlace(id: string): boolean {
  const places = getPlaces();
  const filtered = places.filter((p) => p.id !== id);
  if (filtered.length === places.length) return false;

  localStorage.setItem(STORAGE_KEYS.PLACES, JSON.stringify(filtered));
  return true;
}

export function getPlaceById(id: string): Place | undefined {
  return getPlaces().find((p) => p.id === id);
}

// Tabs
export function getTabs(): Tab[] {
  const storedTabs = safeJsonParse<Tab[]>(STORAGE_KEYS.TABS, []);

  if (storedTabs.length === 0) {
    localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify(DEFAULT_TABS));
    return DEFAULT_TABS;
  }

  // 新しいデフォルトタブを既存データにマージ
  const existingIds = new Set(storedTabs.map(t => t.id));
  const newDefaultTabs = DEFAULT_TABS.filter(t => !existingIds.has(t.id));

  if (newDefaultTabs.length > 0) {
    const mergedTabs = [...storedTabs, ...newDefaultTabs].sort((a, b) => a.order - b.order);
    localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify(mergedTabs));
    return mergedTabs;
  }

  return storedTabs;
}

export function getCustomTabs(): Tab[] {
  return getTabs().filter((t) => t.isCustom);
}

export function addCustomTab(name: string): Tab | null {
  const tabs = getTabs();
  const customTabs = tabs.filter((t) => t.isCustom);
  if (customTabs.length >= 5) return null;

  const maxOrder = Math.max(...tabs.map((t) => t.order));
  const newTab: Tab = {
    id: uuidv4(),
    name,
    isCustom: true,
    order: maxOrder + 1,
  };
  tabs.push(newTab);
  localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify(tabs));
  return newTab;
}

export function updateTab(id: string, name: string): Tab | null {
  const tabs = getTabs();
  const index = tabs.findIndex((t) => t.id === id && t.isCustom);
  if (index === -1) return null;

  tabs[index] = { ...tabs[index], name };
  localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify(tabs));
  return tabs[index];
}

export function deleteTab(id: string): boolean {
  const tabs = getTabs();
  const tab = tabs.find((t) => t.id === id);
  if (!tab || !tab.isCustom) return false;

  const filtered = tabs.filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify(filtered));

  // Move places from deleted tab to 'frequent'
  const places = getPlaces();
  const updatedPlaces = places.map((p) =>
    p.tabId === id ? { ...p, tabId: 'frequent', updatedAt: new Date().toISOString() } : p
  );
  localStorage.setItem(STORAGE_KEYS.PLACES, JSON.stringify(updatedPlaces));

  return true;
}

// Search History
export function getSearchHistory(): SearchHistory[] {
  return safeJsonParse<SearchHistory[]>(STORAGE_KEYS.SEARCH_HISTORY, []);
}

export function addSearchHistory(query: string, placeId?: string): void {
  const history = getSearchHistory();
  const newEntry: SearchHistory = {
    query,
    placeId,
    timestamp: new Date().toISOString(),
  };

  // Remove duplicate queries and keep only last 20
  const filtered = history.filter((h) => h.query !== query);
  filtered.unshift(newEntry);
  const limited = filtered.slice(0, 20);

  localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(limited));
}

export function clearSearchHistory(): void {
  localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify([]));
}

// Settings
export function getSettings(): AppSettings {
  return safeJsonParse<AppSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
}

export function updateSettings(updates: Partial<AppSettings>): AppSettings {
  const settings = getSettings();
  const newSettings = { ...settings, ...updates };
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
  return newSettings;
}
