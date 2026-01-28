import { useRef, useEffect } from 'react';
import type { Tab } from '../../types';

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
}

export function TabBar({ tabs, activeTabId, onTabChange }: TabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeButtonRef = useRef<HTMLButtonElement>(null);

  // Scroll active tab into view
  useEffect(() => {
    if (activeButtonRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const button = activeButtonRef.current;
      const scrollLeft = button.offsetLeft - container.clientWidth / 2 + button.clientWidth / 2;
      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }
  }, [activeTabId]);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              ref={isActive ? activeButtonRef : undefined}
              onClick={() => onTabChange(tab.id)}
              className={`
                whitespace-nowrap rounded-full px-5 py-2 text-lg font-bold
                transition-all duration-200
                ${
                  isActive
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-white text-text-secondary border border-border hover:bg-gray-50'
                }
              `}
            >
              {tab.name}
            </button>
          );
        })}
      </div>
      {/* Scroll indicator gradients */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
