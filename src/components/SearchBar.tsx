import { useState, useRef, useEffect } from 'react';
import { Input } from './ui';
import { getSearchHistory, addSearchHistory } from '../lib/storage';
import { getCurrentLocation, searchNearbyPlaces } from '../lib/maps';
import type { NearbyPlaceResult } from '../lib/maps';
import { useGoogleMaps, usePlacesAutocomplete } from '../hooks/useGoogleMaps';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface SearchBarProps {
  onPlaceSelected: (place: PlaceResult, action: 'register' | 'navigate' | 'both') => void;
}

interface Suggestion {
  type: 'history' | 'place' | 'nearby';
  text: string;
  description?: string;
  placeId?: string;
  distanceMeters?: number;
}

// 距離表示用フォーマット関数
const formatDistance = (meters: number): string => {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
};

export function SearchBar({ onPlaceSelected }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [historySuggestions, setHistorySuggestions] = useState<Suggestion[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { isLoaded } = useGoogleMaps({ apiKey: GOOGLE_MAPS_API_KEY });
  const { getPlacePredictions, getPlaceDetails, isReady } = usePlacesAutocomplete(isLoaded);

  // マウント時に現在地取得
  useEffect(() => {
    getCurrentLocation()
      .then(loc => setCurrentLocation({ lat: loc.latitude, lng: loc.longitude }))
      .catch(console.error);
  }, []);

  // Load search history
  useEffect(() => {
    const history = getSearchHistory();
    setHistorySuggestions(
      history.slice(0, 5).map((h) => ({
        type: 'history' as const,
        text: h.query,
        placeId: h.placeId,
      }))
    );
  }, []);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // デバウンス付き検索（オートコンプリート + 周辺検索）
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    if (!isReady) return;

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        // 1. オートコンプリート取得
        const predictions = await getPlacePredictions(query, currentLocation || undefined);

        // 2. 周辺検索（現在地がある場合のみ）
        let nearbyResults: NearbyPlaceResult[] = [];
        if (currentLocation && GOOGLE_MAPS_API_KEY) {
          nearbyResults = await searchNearbyPlaces(query, currentLocation, GOOGLE_MAPS_API_KEY);
        }

        // 3. マージ（周辺検索を優先、重複排除）
        const nearbyIds = new Set(nearbyResults.map(r => r.placeId));
        const nearbySuggestions: Suggestion[] = nearbyResults.map(r => ({
          type: 'nearby' as const,
          text: r.name,
          description: r.address,
          placeId: r.placeId,
          distanceMeters: r.distanceMeters,
        }));
        const placeSuggestions: Suggestion[] = predictions
          .filter(p => !nearbyIds.has(p.place_id))
          .map(p => ({
            type: 'place' as const,
            text: p.structured_formatting.main_text,
            description: p.structured_formatting.secondary_text,
            placeId: p.place_id,
            distanceMeters: p.distance_meters,
          }));

        setSuggestions([...nearbySuggestions, ...placeSuggestions]);
      } catch (error) {
        console.error('Search error:', error);
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [query, currentLocation, isReady, getPlacePredictions]);

  const handleInputChange = (value: string) => {
    setQuery(value);
  };

  const handleSelectSuggestion = async (suggestion: Suggestion) => {
    if (!suggestion.placeId) return;

    setIsFocused(false);
    setQuery(suggestion.text);
    setIsSearching(true);

    try {
      const placeDetails = await getPlaceDetails(suggestion.placeId);
      if (placeDetails && placeDetails.geometry?.location) {
        const place: PlaceResult = {
          placeId: suggestion.placeId,
          name: placeDetails.name || suggestion.text,
          address: placeDetails.formatted_address || '',
          latitude: placeDetails.geometry.location.lat(),
          longitude: placeDetails.geometry.location.lng(),
        };

        // Save to search history
        addSearchHistory(suggestion.text, suggestion.placeId);

        // Show action modal
        setSelectedPlace(place);
        setShowActionModal(true);
      }
    } catch (error) {
      console.error('Failed to get place details:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAction = (action: 'register' | 'navigate' | 'both') => {
    if (selectedPlace) {
      onPlaceSelected(selectedPlace, action);
      setShowActionModal(false);
      setSelectedPlace(null);
      setQuery('');
    }
  };

  const closeModal = () => {
    setShowActionModal(false);
    setSelectedPlace(null);
  };

  const showSuggestions = isFocused && (query.length > 0 || historySuggestions.length > 0);
  const displaySuggestions = query.length > 0 ? suggestions : historySuggestions;

  const hasApiKey = !!GOOGLE_MAPS_API_KEY;

  return (
    <>
      <div ref={containerRef} className="relative px-4 py-3">
        <Input
          ref={inputRef}
          type="search"
          placeholder={hasApiKey ? "住所や建物の名前で検索" : "APIキー未設定のため検索機能は利用できません"}
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          disabled={!hasApiKey}
          className="pr-12"
        />
        {isSearching && (
          <div className="absolute right-7 top-1/2 -translate-y-1/2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {showSuggestions && displaySuggestions.length > 0 && (
          <div className="absolute left-4 right-4 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-xl bg-white shadow-lg border border-border">
            {displaySuggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.type}-${suggestion.placeId || index}`}
                onClick={() => handleSelectSuggestion(suggestion)}
                className="w-full px-4 py-3 text-left text-lg hover:bg-gray-50 border-b border-border last:border-b-0 flex items-center gap-3"
              >
                <span className="text-sm text-primary font-medium min-w-[3.5rem] text-right">
                  {suggestion.distanceMeters
                    ? formatDistance(suggestion.distanceMeters)
                    : suggestion.type === 'history' ? '🕐' : '📍'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text truncate">{suggestion.text}</p>
                  {suggestion.description && (
                    <p className="text-sm text-text-secondary truncate">{suggestion.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action Modal */}
      {showActionModal && selectedPlace && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={closeModal}>
          <div
            className="w-full max-w-lg bg-surface rounded-t-3xl p-6 animate-[slideUp_0.3s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6">
              <h2 className="text-xl font-bold text-text mb-2">{selectedPlace.name}</h2>
              <p className="text-base text-text-secondary">{selectedPlace.address}</p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleAction('register')}
                className="w-full min-h-[56px] px-6 py-4 text-xl font-bold rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors"
              >
                📍 この場所を登録
              </button>
              <button
                onClick={() => handleAction('navigate')}
                className="w-full min-h-[56px] px-6 py-4 text-xl font-bold rounded-xl bg-success text-white hover:opacity-90 transition-opacity"
              >
                🚗 ナビを開始
              </button>
              <button
                onClick={() => handleAction('both')}
                className="w-full min-h-[56px] px-6 py-4 text-xl font-bold rounded-xl bg-white text-text border-2 border-border hover:bg-gray-50 transition-colors"
              >
                📍 登録 + 🚗 ナビ開始
              </button>
              <button
                onClick={closeModal}
                className="w-full min-h-[48px] px-6 py-3 text-lg font-medium rounded-xl text-text-secondary hover:bg-gray-100 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(100%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}
