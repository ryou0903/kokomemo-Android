import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { Place } from '../types';
import { Card, Button } from './ui';
import { openNavigation } from '../lib/maps';
import { getSettings, getTabs } from '../lib/storage';

interface PlaceCardProps {
  place: Place;
  onEdit: (place: Place) => void;
  onNavigate?: (place: Place) => void;
}

// カテゴリの色を取得
const getCategoryColor = (tabId: string): string => {
  const colors: Record<string, string> = {
    frequent: 'bg-blue-500',
    planned: 'bg-green-500',
    revisit: 'bg-purple-500',
    rest: 'bg-orange-500',
    convenience: 'bg-red-500',
    toilet: 'bg-cyan-500',
    other: 'bg-gray-500',
  };
  return colors[tabId] || 'bg-primary';
};

export function PlaceCard({ place, onEdit, onNavigate }: PlaceCardProps) {
  const handleNavigate = () => {
    if (onNavigate) {
      onNavigate(place);
    }
    const settings = getSettings();
    openNavigation(place.latitude, place.longitude, settings.travelMode);
  };

  const createdDate = new Date(place.createdAt);
  const formattedDate = format(createdDate, 'M月d日', { locale: ja });
  const formattedTime = format(createdDate, 'H:mm', { locale: ja });

  // カテゴリ名を取得
  const tabs = getTabs();
  const category = tabs.find(t => t.id === place.tabId);
  const categoryName = category?.name || '';
  const categoryColor = getCategoryColor(place.tabId);

  return (
    <Card className="relative overflow-hidden">
      {/* 左側のカテゴリ色アクセントライン */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${categoryColor}`} />

      <div className="pl-3 flex flex-col gap-2">
        {/* ヘッダー: 場所名 + 日時 */}
        <div className="flex justify-between items-start gap-2">
          <h3 className="text-base font-bold text-text flex-1 line-clamp-1">{place.name}</h3>
          <span className="text-xs text-text-secondary whitespace-nowrap">
            {formattedDate} {formattedTime}
          </span>
        </div>

        {/* 住所 */}
        {place.address && (
          <p className="text-sm text-text-secondary line-clamp-1">📍 {place.address}</p>
        )}

        {/* カテゴリバッジとメモ */}
        <div className="flex items-center gap-2 flex-wrap">
          {categoryName && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white ${categoryColor}`}>
              {categoryName}
            </span>
          )}
          {place.memo && (
            <span className="text-xs text-text-secondary line-clamp-1 flex-1">💬 {place.memo}</span>
          )}
        </div>

        {/* アクションボタン */}
        <div className="flex gap-2 mt-1">
          <Button
            variant="primary"
            size="small"
            icon="🚗"
            onClick={handleNavigate}
            className="flex-1"
          >
            ナビ開始
          </Button>
          <Button
            variant="secondary"
            size="small"
            icon="✏️"
            onClick={() => onEdit(place)}
            className="flex-none"
          >
            編集
          </Button>
        </div>
      </div>
    </Card>
  );
}

