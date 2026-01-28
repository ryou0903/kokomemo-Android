import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import type { Tab } from '../types';
import {
  getPlaceById,
  getTabs,
  savePlace,
  updatePlace,
  deletePlace,
} from '../lib/storage';
import { getCurrentLocation, reverseGeocode } from '../lib/maps';
import { Header } from '../components/layout/Header';
import { Button, Input, Textarea, Loading, ConfirmDialog } from '../components/ui';
import { useToast } from '../contexts/ToastContext';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// 住所から国名を削除し、郵便番号を分離
const parseAddress = (fullAddress: string): { address: string; postalCode: string } => {
  let address = fullAddress;
  let postalCode = '';

  // 郵便番号を抽出（日本形式: 〒XXX-XXXX または XXX-XXXX）
  const postalMatch = address.match(/〒?\s*(\d{3}-?\d{4})/);
  if (postalMatch) {
    postalCode = postalMatch[1].includes('-') ? postalMatch[1] : postalMatch[1].slice(0, 3) + '-' + postalMatch[1].slice(3);
    address = address.replace(postalMatch[0], '').trim();
  }

  // 国名を削除（日本、Japan、JPなど）
  address = address.replace(/^(日本、?|Japan,?\s*)/i, '').trim();

  // 先頭のカンマやスペースを削除
  address = address.replace(/^[,、\s]+/, '').trim();

  return { address, postalCode };
};

export function PlacePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const isNew = id === 'new';
  const useCurrentLocation = searchParams.get('useCurrentLocation') === 'true';

  // Pre-filled data from search
  const prefillName = searchParams.get('name');
  const prefillAddress = searchParams.get('address');
  const prefillLat = searchParams.get('lat');
  const prefillLng = searchParams.get('lng');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [name, setName] = useState('');
  const [memo, setMemo] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);
  const [tabId, setTabId] = useState('frequent');

  const [errors, setErrors] = useState<{ name?: string }>({});

  useEffect(() => {
    const loadData = async () => {
      setTabs(getTabs().filter((t) => t.id !== 'all'));

      if (!isNew && id) {
        const place = getPlaceById(id);
        if (place) {
          setName(place.name);
          setMemo(place.memo);
          setAddress(place.address);
          setLatitude(place.latitude);
          setLongitude(place.longitude);
          setTabId(place.tabId);
        } else {
          showToast('場所が見つかりませんでした', 'error');
          navigate('/');
          return;
        }
      } else if (isNew && useCurrentLocation) {
        try {
          const location = await getCurrentLocation();
          setLatitude(location.latitude);
          setLongitude(location.longitude);

          if (GOOGLE_MAPS_API_KEY) {
            const geocodeResult = await reverseGeocode(
              location.latitude,
              location.longitude,
              GOOGLE_MAPS_API_KEY
            );

            // 住所を設定
            setAddress(geocodeResult.address);

            // 郵便番号を設定（reverseGeocodeから直接取得）
            if (geocodeResult.postalCode) {
              setPostalCode(geocodeResult.postalCode);
            }

            // placeNameも国名・郵便番号を除去
            if (geocodeResult.placeName) {
              const parsedName = parseAddress(geocodeResult.placeName);
              setName(parsedName.address || geocodeResult.address);
            }
          } else {
            setAddress(`${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
          }
        } catch (error) {
          showToast(
            error instanceof Error ? error.message : '現在地を取得できませんでした',
            'error'
          );
        }
      } else if (isNew && prefillName && prefillLat && prefillLng) {
        // Pre-filled from search
        setName(prefillName);
        if (prefillAddress) {
          const parsed = parseAddress(prefillAddress);
          setAddress(parsed.address);
          setPostalCode(parsed.postalCode);
        }
        setLatitude(parseFloat(prefillLat));
        setLongitude(parseFloat(prefillLng));
      }

      setIsLoading(false);
    };

    loadData();
  }, [id, isNew, useCurrentLocation, prefillName, prefillAddress, prefillLat, prefillLng, navigate, showToast]);

  const validate = useCallback(() => {
    const newErrors: { name?: string } = {};
    if (!name.trim()) {
      newErrors.name = '場所の登録名を入力してください';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name]);

  const handleSave = useCallback(async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      if (isNew) {
        savePlace({
          name: name.trim(),
          memo: memo.trim(),
          address,
          latitude,
          longitude,
          tabId,
        });
        showToast('場所を登録しました');
      } else if (id) {
        updatePlace(id, {
          name: name.trim(),
          memo: memo.trim(),
          address,
          latitude,
          longitude,
          tabId,
        });
        showToast('場所を更新しました');
      }
      navigate('/');
    } catch (error) {
      showToast('保存に失敗しました', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [isNew, id, name, memo, address, latitude, longitude, tabId, navigate, showToast, validate]);

  const handleDelete = useCallback(() => {
    if (!id) return;
    deletePlace(id);
    showToast('場所を削除しました');
    navigate('/');
  }, [id, navigate, showToast]);

  if (isLoading) {
    return (
      <Loading
        fullScreen
        message={useCurrentLocation ? '現在地を取得中...' : '読み込み中...'}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header
        title={isNew ? '新しい場所を登録' : '場所を編集'}
        showBack
      />

      <main className="flex-1 px-4 py-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="flex flex-col gap-5"
        >
          <Input
            label="場所の登録名（必須）"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 〇〇駅前のコンビニ"
            error={errors.name}
          />

          {/* 住所 */}
          <Input
            label="住所"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="例: 千葉県大網白里市永田186-5"
          />

          {/* 郵便番号 */}
          <Input
            label="郵便番号"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            placeholder="例: 299-3233"
          />

          <Textarea
            label="メモ（任意）"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="例: 駐車場は裏手にあり"
          />

          <div className="flex flex-col gap-2">
            <p className="text-base font-bold text-text">カテゴリ</p>
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTabId(tab.id)}
                  className={`
                    min-w-[5rem] px-3 py-2 rounded-lg text-sm font-medium transition-all text-center
                    ${tabId === tab.id
                      ? 'bg-primary text-white'
                      : 'bg-white text-text border border-border hover:bg-gray-50'
                    }
                  `}
                >
                  {tab.name}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex gap-3">
            {!isNew && (
              <Button
                type="button"
                variant="danger"
                size="normal"
                icon="🗑️"
                onClick={() => setShowDeleteDialog(true)}
                className="flex-none"
              >
                削除
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              size="normal"
              icon="💾"
              loading={isSaving}
              className="flex-1"
            >
              保存する
            </Button>
          </div>
        </form>
      </main>

      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="場所を削除"
        message="この場所を削除します。この操作は取り消せません。"
        confirmLabel="🗑️ 削除する"
        cancelLabel="やめる"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </div>
  );
}
