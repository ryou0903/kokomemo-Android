import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NativeMap } from '../components/NativeMap';
import type { NativeMapRef } from '../components/NativeMap';
import { Geolocation } from '@capacitor/geolocation';
import { openNavigation, searchNearbyPlaces, searchAutocomplete, getPlaceDetailsRest, reverseGeocode } from '../lib/maps';
import type { NearbyPlaceResult, AutocompleteResult } from '../lib/maps';
import { savePlace, getSettings, addSearchHistory } from '../lib/storage';
import { useToast } from '../contexts/ToastContext';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Default position (Tokyo Station)
const DEFAULT_POSITION = { lat: 35.6812, lng: 139.7671 };

interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  postalCode?: string;
  latitude: number;
  longitude: number;
}

// 住所から国名と郵便番号を分離
const parseAddress = (fullAddress: string): { address: string; postalCode?: string } => {
  // 郵便番号を抽出（日本形式: 〒XXX-XXXX または XXX-XXXX）
  const postalMatch = fullAddress.match(/〒?\s*(\d{3}-?\d{4})/);
  let postalCode: string | undefined;
  if (postalMatch) {
    postalCode = postalMatch[1].includes('-')
      ? postalMatch[1]
      : postalMatch[1].slice(0, 3) + '-' + postalMatch[1].slice(3);
  }

  // 住所から「日本、」と郵便番号を除去
  const address = fullAddress
    .replace(/^日本、?\s*/, '')
    .replace(/〒?\s*\d{3}-?\d{4}\s*/, '')
    .replace(/^[,、\s]+/, '')
    .trim();

  return { address, postalCode };
};

interface Suggestion {
  text: string;
  description?: string;
  placeId: string;
  distanceMeters?: number;
}

// Format distance for display
const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
};

export function SearchPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<NativeMapRef>(null);

  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isFixingTypos, setIsFixingTypos] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [mapPosition, setMapPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoadingInitialLocation, setIsLoadingInitialLocation] = useState(true);

  const debounceRef = useRef<number | null>(null);
  const queryRef = useRef(query);
  const mapPositionRef = useRef(mapPosition);

  // Get current location on mount using Capacitor Geolocation
  useEffect(() => {
    let isMounted = true;
    let positionSet = false;

    // 3秒でタイムアウト - デフォルト位置を使用
    const timeoutId = setTimeout(() => {
      if (isMounted && !positionSet) {
        positionSet = true;
        setMapPosition(DEFAULT_POSITION);
        setIsLoadingInitialLocation(false);
      }
    }, 3000);

    const getCurrentPosition = async () => {
      try {
        // Check permission
        const permission = await Geolocation.checkPermissions();
        if (permission.location !== 'granted') {
          const request = await Geolocation.requestPermissions();
          if (request.location !== 'granted') {
            throw new Error('Location permission denied');
          }
        }

        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
        });

        if (isMounted && !positionSet) {
          positionSet = true;
          setMapPosition({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          clearTimeout(timeoutId);
          setIsLoadingInitialLocation(false);
        }
      } catch (error) {
        console.error('Geolocation error:', error);
        if (isMounted && !positionSet) {
          positionSet = true;
          setMapPosition(DEFAULT_POSITION);
          clearTimeout(timeoutId);
          setIsLoadingInitialLocation(false);
        }
      }
    };

    getCurrentPosition();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, []);

  // Keep refs in sync
  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    mapPositionRef.current = mapPosition;
  }, [mapPosition]);

  // Voice input using Web Speech API
  const startVoiceInput = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      showToast('お使いのブラウザは音声入力に対応していません', 'error');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      handleInputChange(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        showToast('マイクの使用が許可されていません', 'error');
      } else {
        showToast('音声認識に失敗しました', 'error');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }, [showToast]);

  // Fix typos using Gemini API
  const fixTypos = useCallback(async () => {
    if (!query.trim() || !GEMINI_API_KEY) {
      if (!GEMINI_API_KEY) {
        showToast('Gemini APIキーが設定されていません', 'error');
      }
      return;
    }

    setIsFixingTypos(true);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `以下の日本語テキストの誤字脱字を修正してください。場所や住所の検索クエリとして使用されます。修正後のテキストのみを返してください。余計な説明は不要です。

入力: ${query}

修正後:`
              }]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 100,
            }
          }),
        }
      );

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      const correctedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (correctedText && correctedText !== query) {
        setQuery(correctedText);
        handleInputChange(correctedText);
        showToast('誤字を修正しました');
      } else {
        showToast('修正の必要はありませんでした', 'info');
      }
    } catch (error) {
      console.error('Gemini API error:', error);
      showToast('誤字修正に失敗しました', 'error');
    } finally {
      setIsFixingTypos(false);
    }
  }, [query, showToast]);

  // 検索実行関数（共通処理）- REST APIを使用（古いデバイスでも動作）
  const executeSearch = useCallback(async (searchQuery: string) => {
    if (!GOOGLE_MAPS_API_KEY) {
      setIsSearching(false);
      return;
    }

    try {
      const origin = mapPositionRef.current || undefined;

      // 1. オートコンプリート取得（REST API）
      let autocompleteResults: AutocompleteResult[] = [];
      try {
        autocompleteResults = await searchAutocomplete(searchQuery, GOOGLE_MAPS_API_KEY, origin);
      } catch (autocompleteError) {
        console.warn('Autocomplete error:', autocompleteError);
      }
      if (queryRef.current !== searchQuery) return;

      // 2. 周辺検索（オプション - 失敗しても続行）
      let nearbyResults: NearbyPlaceResult[] = [];
      if (origin) {
        try {
          nearbyResults = await searchNearbyPlaces(searchQuery, origin, GOOGLE_MAPS_API_KEY);
        } catch (nearbyError) {
          console.warn('Nearby search error (continuing with autocomplete only):', nearbyError);
        }
      }
      if (queryRef.current !== searchQuery) return;

      // 3. マージ（周辺検索を優先、重複排除）
      const nearbyIds = new Set(nearbyResults.map(r => r.placeId));
      const nearbySuggestions: Suggestion[] = nearbyResults.map(r => ({
        text: r.name,
        description: r.address,
        placeId: r.placeId,
        distanceMeters: r.distanceMeters,
      }));
      const autocompleteSuggestions: Suggestion[] = autocompleteResults
        .filter(r => !nearbyIds.has(r.placeId))
        .map((r) => ({
          text: r.mainText,
          description: r.secondaryText,
          placeId: r.placeId,
          distanceMeters: r.distanceMeters,
        }));

      // 4. 周辺検索結果を先頭に、その後にオートコンプリート結果
      setSuggestions([...nearbySuggestions, ...autocompleteSuggestions]);
    } catch (error) {
      console.error('Place search error:', error);
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle input change with debounce
  const handleInputChange = (value: string) => {
    setQuery(value);
    setSelectedPlace(null);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!value.trim()) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = window.setTimeout(() => {
      executeSearch(value);
    }, 800);
  };

  // クイック検索（即時実行、デバウンスなし）
  const handleQuickSearch = useCallback((searchTerm: string) => {
    setQuery(searchTerm);
    setSelectedPlace(null);
    setSuggestions([]);
    setIsSearching(true);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    executeSearch(searchTerm);
  }, [executeSearch]);

  // Handle suggestion selection
  const handleSelectSuggestion = async (suggestion: Suggestion) => {
    setIsSearching(true);
    setSuggestions([]);
    try {
      // REST APIを使用
      const placeDetails = await getPlaceDetailsRest(suggestion.placeId, GOOGLE_MAPS_API_KEY);
      if (placeDetails) {
        const parsed = parseAddress(placeDetails.address || '');
        const place: PlaceResult = {
          placeId: placeDetails.placeId,
          name: placeDetails.name || suggestion.text,
          address: parsed.address,
          postalCode: parsed.postalCode,
          latitude: placeDetails.latitude,
          longitude: placeDetails.longitude,
        };
        addSearchHistory(suggestion.text, suggestion.placeId);
        setSelectedPlace(place);
        setMapPosition({ lat: place.latitude, lng: place.longitude });

        // Pan map to the selected place
        if (mapRef.current) {
          mapRef.current.panTo(place.latitude, place.longitude);
          mapRef.current.setMarkerPosition(place.latitude, place.longitude);
        }

        setQuery('');
      } else {
        showToast('場所の詳細を取得できませんでした', 'error');
      }
    } catch (error) {
      console.error('Failed to get place details:', error);
      showToast('場所の詳細を取得できませんでした', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle actions on selected place
  const handleRegister = () => {
    if (!selectedPlace) return;
    const params = new URLSearchParams({
      name: selectedPlace.name,
      address: selectedPlace.address,
      lat: selectedPlace.latitude.toString(),
      lng: selectedPlace.longitude.toString(),
    });
    navigate(`/place/new?${params.toString()}`);
  };

  const handleNavigate = () => {
    if (!selectedPlace) return;
    const settings = getSettings();
    openNavigation(selectedPlace.latitude, selectedPlace.longitude, settings.travelMode);
  };

  const handleBoth = () => {
    if (!selectedPlace) return;
    savePlace({
      name: selectedPlace.name,
      memo: '',
      address: selectedPlace.address,
      latitude: selectedPlace.latitude,
      longitude: selectedPlace.longitude,
      tabId: 'frequent',
    });
    showToast('場所を登録しました');
    const settings = getSettings();
    openNavigation(selectedPlace.latitude, selectedPlace.longitude, settings.travelMode);
    navigate('/');
  };

  const hasGoogleApi = !!GOOGLE_MAPS_API_KEY;
  const hasGeminiApi = !!GEMINI_API_KEY;

  // Glass style classes
  const glassStyle = 'bg-white/80 backdrop-blur-xl shadow-lg border border-gray-200';
  const glassButtonStyle = `${glassStyle} rounded-full px-4 h-12 text-base font-medium text-text active:bg-white/90 transition-colors flex items-center justify-center`;
  const glassInputStyle = `${glassStyle} rounded-full px-4 h-12 text-base outline-none focus:ring-2 focus:ring-primary/30`;

  return (
    <div className="fixed inset-0 bg-gray-200">
      {/* Full-screen Native Map */}
      {hasGoogleApi && mapPosition && (
        <NativeMap
          ref={mapRef}
          latitude={selectedPlace?.latitude ?? mapPosition.lat}
          longitude={selectedPlace?.longitude ?? mapPosition.lng}
          hideCurrentLocationButton={!!selectedPlace}
          onLocationChange={async (lat, lng) => {
            // ピンを刺した時は逆ジオコーディングで住所を取得
            try {
              const result = await reverseGeocode(lat, lng, GOOGLE_MAPS_API_KEY);
              const parsed = parseAddress(result.address);
              setSelectedPlace({
                placeId: `pin-${Date.now()}`,
                name: result.placeName || parsed.address.split(',')[0] || '選択した場所',
                address: parsed.address,
                postalCode: parsed.postalCode,
                latitude: lat,
                longitude: lng,
              });
            } catch (error) {
              console.error('Reverse geocode error:', error);
              setSelectedPlace({
                placeId: `pin-${Date.now()}`,
                name: '選択した場所',
                address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                latitude: lat,
                longitude: lng,
              });
            }
          }}
        />
      )}

      {/* Loading indicator - 位置取得中 */}
      {isLoadingInitialLocation && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
          <div className={`${glassStyle} rounded-2xl p-6 flex flex-col items-center gap-3`}>
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
            <p className="text-text-secondary text-sm">現在地を取得中...</p>
          </div>
        </div>
      )}

      {/* Floating UI - Top */}
      <div className="absolute top-0 left-0 right-0 pt-safe p-3 pointer-events-none">
        <div className="pointer-events-auto">
          {/* Row 1: Back button + Search input */}
          <div className="flex gap-2 items-center">
            <button
              onClick={() => navigate(-1)}
              className={glassButtonStyle}
            >
              戻る
            </button>
            <input
              ref={inputRef}
              type="search"
              placeholder="場所を検索"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              disabled={!hasGoogleApi}
              className={`${glassInputStyle} flex-1 min-w-0`}
            />
            {isSearching && (
              <div className={`${glassStyle} rounded-full p-2`}>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </div>

          {/* Row 2: Voice input + Typo fix buttons */}
          <div className="flex gap-2 mt-2 flex-wrap">
            <button
              onClick={startVoiceInput}
              disabled={isListening}
              className={`${glassButtonStyle} flex items-center justify-center gap-1`}
            >
              <span>🎤</span>
              <span>{isListening ? '聞いています...' : '音声入力'}</span>
            </button>
            <button
              onClick={fixTypos}
              disabled={!query.trim() || isFixingTypos || !hasGeminiApi}
              className={`${glassButtonStyle} flex items-center justify-center gap-1 disabled:opacity-50`}
            >
              <span>✨</span>
              <span>{isFixingTypos ? '修正中...' : '誤字修正'}</span>
            </button>
            <button
              onClick={() => handleQuickSearch('トイレ')}
              className={`${glassButtonStyle} gap-1`}
            >
              <span>🚻</span>
              <span>トイレを探す</span>
            </button>
            <button
              onClick={() => handleQuickSearch('コンビニ')}
              className={`${glassButtonStyle} gap-1`}
            >
              <span>🏪</span>
              <span>コンビニを探す</span>
            </button>
          </div>
        </div>

        {/* Search Results */}
        {suggestions.length > 0 && (
          <div className={`${glassStyle} rounded-2xl mt-2 max-h-60 overflow-y-auto pointer-events-auto`}>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.placeId}
                onClick={() => handleSelectSuggestion(suggestion)}
                className="w-full px-4 py-3 text-left border-b border-gray-200/50 last:border-b-0 hover:bg-white/50 flex items-start gap-3"
              >
                <span className="text-sm flex-shrink-0 mt-0.5 text-primary font-medium min-w-[3.5rem] text-right">
                  {suggestion.distanceMeters ? formatDistance(suggestion.distanceMeters) : '📍'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text text-sm">{suggestion.text}</p>
                  {suggestion.description && (
                    <p className="text-xs text-text-secondary truncate">{suggestion.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Place - Bottom Panel */}
      {selectedPlace && (
        <div className={`absolute bottom-0 left-0 right-0 ${glassStyle} rounded-t-3xl p-4 pb-safe pointer-events-auto`}>
          <div className="mb-3">
            {/* 名前がある場合のみ表示（名前と住所が同じ場合は住所のみ） */}
            {selectedPlace.name && selectedPlace.name !== selectedPlace.address && (
              <h2 className="text-lg font-bold text-text">{selectedPlace.name}</h2>
            )}
            <p className="text-sm text-text-secondary">{selectedPlace.address}</p>
            {selectedPlace.postalCode && (
              <p className="text-xs text-text-secondary mt-0.5">〒{selectedPlace.postalCode}</p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleRegister}
              className="flex-1 bg-primary text-white rounded-full py-2.5 px-4 font-medium text-sm flex items-center justify-center gap-1 active:bg-primary/90"
            >
              <span>📍</span>
              <span>登録</span>
            </button>
            <button
              onClick={handleNavigate}
              className="flex-1 bg-white border border-border text-text rounded-full py-2.5 px-4 font-medium text-sm flex items-center justify-center gap-1 active:bg-gray-50"
            >
              <span>🚗</span>
              <span>ナビ</span>
            </button>
          </div>

          <div className="flex gap-2 mt-2">
            <button
              onClick={handleBoth}
              className="flex-1 text-text-secondary text-sm py-2 active:bg-gray-100 rounded-full"
            >
              登録してナビ開始
            </button>
            <button
              onClick={() => setSelectedPlace(null)}
              className="flex-1 text-text-secondary text-sm py-2 active:bg-gray-100 rounded-full"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* API Key missing message */}
      {!hasGoogleApi && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`${glassStyle} rounded-2xl p-6 mx-4 text-center`}>
            <p className="text-text-secondary">Google Maps APIキーが設定されていません</p>
          </div>
        </div>
      )}
    </div>
  );
}
