import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Place, Tab, SortOption } from '../types';
import { getPlaces, getTabs } from '../lib/storage';
import { Header } from '../components/layout/Header';
import { Button, Loading } from '../components/ui';
import { PlaceCard } from '../components/PlaceCard';
import { SortSelect } from '../components/SortSelect';

export function HomePage() {
  const navigate = useNavigate();
  const [places, setPlaces] = useState<Place[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState('all');
  const [sortOption, setSortOption] = useState<SortOption>('created-desc');
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(() => {
    setPlaces(getPlaces());
    setTabs(getTabs());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh data when returning to this page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadData]);

  const filteredPlaces = useMemo(() => {
    let result = places;

    if (activeTabId !== 'all') {
      result = result.filter((p) => p.tabId === activeTabId);
    }

    result = [...result].sort((a, b) => {
      switch (sortOption) {
        case 'name-asc':
          return a.name.localeCompare(b.name, 'ja');
        case 'created-asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'created-desc':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return result;
  }, [places, activeTabId, sortOption]);

  const handleEditPlace = useCallback(
    (place: Place) => {
      navigate(`/place/${place.id}`);
    },
    [navigate]
  );

  if (isLoading) {
    return <Loading fullScreen message="読み込み中..." />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header
        title="ここメモ"
      />

      <main className="flex-1 flex flex-col pb-6">
        {/* Action Buttons Section - 横並び */}
        <div className="px-4 py-3 flex gap-2">
          <Button
            variant="primary"
            size="normal"
            onClick={() => navigate('/place/new?useCurrentLocation=true')}
            className="flex-1 whitespace-nowrap text-sm"
          >
            📍 今いる場所を登録
          </Button>

          <Button
            variant="secondary"
            size="normal"
            onClick={() => navigate('/search')}
            className="flex-1 whitespace-nowrap text-sm"
          >
            🗺️ 場所を検索
          </Button>
        </div>

        {/* Places Section - Visually Grouped */}
        <div className="flex-1 mx-4 bg-surface rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
          {/* Section Header */}
          <div className="px-4 py-3 border-b border-border bg-gray-50/50 flex items-center justify-between">
            <h2 className="text-base font-bold text-text">登録した場所</h2>
            <button
              onClick={() => navigate('/calendar')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 active:bg-primary/30 transition-colors"
            >
              <span>📅</span>
              <span>登録日で絞る</span>
            </button>
          </div>

          {/* Category and Sort Selects */}
          <div className="px-4 py-3 border-b border-border flex gap-3">
            {/* Category Dropdown */}
            <div className="flex-1 min-w-0">
              <select
                value={activeTabId}
                onChange={(e) => setActiveTabId(e.target.value)}
                className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-border bg-white text-text cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/30 truncate"
              >
                {tabs.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {`表示: ${tab.name}`}
                  </option>
                ))}
              </select>
            </div>
            {/* Sort Select */}
            <div className="flex-1 min-w-0">
              <SortSelect value={sortOption} onChange={setSortOption} />
            </div>
          </div>

          {/* Place Cards */}
          <div className="flex-1 p-3 overflow-y-auto">
            {filteredPlaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-4xl mb-3">📍</p>
                <p className="text-base text-text-secondary">
                  {activeTabId === 'all'
                    ? 'まだ場所が登録されていません'
                    : 'このカテゴリには場所がありません'}
                </p>
                {activeTabId === 'all' && (
                  <p className="text-sm text-text-secondary mt-1">
                    上のボタンから場所を登録してみましょう
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredPlaces.map((place) => (
                  <PlaceCard key={place.id} place={place} onEdit={handleEditPlace} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
