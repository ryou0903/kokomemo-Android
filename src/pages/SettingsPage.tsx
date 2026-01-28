import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppSettings } from '../types';
import { getSettings, updateSettings } from '../lib/storage';
import { Header } from '../components/layout/Header';
import { Button, Card } from '../components/ui';
import { useToast } from '../contexts/ToastContext';

const TRAVEL_MODES = [
  { value: 'driving', label: '🚗 車', description: '車でのルートを表示' },
  { value: 'transit', label: '🚃 電車・バス', description: '公共交通機関のルートを表示' },
  { value: 'walking', label: '🚶 徒歩', description: '徒歩のルートを表示' },
] as const;

export function SettingsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    setSettings(getSettings());
  }, []);

  const handleTravelModeChange = (mode: AppSettings['travelMode']) => {
    const newSettings = updateSettings({ travelMode: mode });
    setSettings(newSettings);
    showToast('設定を保存しました');
  };

  if (!settings) return null;

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="設定" showBack />

      <main className="flex-1 px-4 py-6">
        <div className="flex flex-col gap-6">
          {/* Travel mode setting */}
          <section>
            <h2 className="text-xl font-bold text-text mb-4">ナビの移動手段</h2>
            <div className="flex flex-col gap-3">
              {TRAVEL_MODES.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => handleTravelModeChange(mode.value)}
                  className={`
                    w-full p-4 rounded-xl text-left transition-all
                    ${settings.travelMode === mode.value
                      ? 'bg-primary/10 border-2 border-primary'
                      : 'bg-white border-2 border-border hover:bg-gray-50'
                    }
                  `}
                >
                  <p className="text-xl font-bold text-text">{mode.label}</p>
                  <p className="text-base text-text-secondary">{mode.description}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Custom tabs management */}
          <section>
            <h2 className="text-xl font-bold text-text mb-4">カテゴリの管理</h2>
            <Card>
              <Button
                variant="secondary"
                size="large"
                onClick={() => navigate('/settings/tabs')}
                className="w-full justify-between"
              >
                <span>カテゴリを追加・編集</span>
                <span>▶</span>
              </Button>
            </Card>
          </section>

          {/* Help section */}
          <section>
            <h2 className="text-xl font-bold text-text mb-4">使い方</h2>
            <Card className="flex flex-col gap-4">
              <div>
                <h3 className="text-lg font-bold text-text mb-2">📍 場所を登録する</h3>
                <p className="text-base text-text-secondary leading-relaxed">
                  「今いる場所を登録」ボタンを押すと、現在地を登録できます。
                  名前とメモを入力して保存しましょう。
                </p>
              </div>
              <div>
                <h3 className="text-lg font-bold text-text mb-2">🚗 ナビを開始する</h3>
                <p className="text-base text-text-secondary leading-relaxed">
                  登録した場所の「ナビ開始」ボタンを押すと、
                  Googleマップが開いてナビゲーションが始まります。
                </p>
              </div>
              <div>
                <h3 className="text-lg font-bold text-text mb-2">📅 カレンダーで振り返る</h3>
                <p className="text-base text-text-secondary leading-relaxed">
                  カレンダー画面では、いつどこに行ったかを確認できます。
                  日付をタップすると、その日に登録した場所が表示されます。
                </p>
              </div>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}
