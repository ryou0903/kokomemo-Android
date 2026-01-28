import { useRef, useEffect, useState, useCallback } from 'react';
import { reverseGeocode } from '../lib/maps';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

interface InteractiveMapProps {
  latitude: number;
  longitude: number;
  onLocationChange?: (lat: number, lng: number, address: string, name?: string) => void;
  isLoaded: boolean;
  hideCurrentLocationButton?: boolean;
}

// マーカー型の統一（Advanced または Legacy）
type MarkerType = google.maps.marker.AdvancedMarkerElement | google.maps.Marker;

export function InteractiveMap({ latitude, longitude, onLocationChange, isLoaded, hideCurrentLocationButton }: InteractiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<MarkerType | null>(null);
  const currentLocationMarkerRef = useRef<MarkerType | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const isInitializedRef = useRef(false);
  const hasInitialPanRef = useRef(false);
  const isLegacyModeRef = useRef(false); // レガシーモードフラグ

  // Current location state
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [smoothLocation, setSmoothLocation] = useState<{ lat: number; lng: number } | null>(null);
  const targetLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [hasOrientationSensor, setHasOrientationSensor] = useState(false);

  // Store latest callback in ref to avoid re-initializing map
  const onLocationChangeRef = useRef(onLocationChange);
  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  // Store initial position
  const initialPositionRef = useRef({ lat: latitude, lng: longitude });

  // Watch current location
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.error('Geolocation watch error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );

    watchIdRef.current = watchId;

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Smooth location interpolation (lerp)
  useEffect(() => {
    if (!currentLocation) return;

    targetLocationRef.current = currentLocation;

    // First time - set immediately
    if (!smoothLocation) {
      setSmoothLocation(currentLocation);
      return;
    }

    // Start animation
    const animate = () => {
      const target = targetLocationRef.current;
      if (!target) return;

      setSmoothLocation((current) => {
        if (!current) return target;

        const factor = 0.15; // Smooth factor
        const newLat = current.lat + (target.lat - current.lat) * factor;
        const newLng = current.lng + (target.lng - current.lng) * factor;

        // Close enough - snap to target
        const dist = Math.abs(target.lat - newLat) + Math.abs(target.lng - newLng);
        if (dist < 0.0000001) {
          return target;
        }

        // Continue animation
        animationFrameRef.current = requestAnimationFrame(animate);
        return { lat: newLat, lng: newLng };
      });
    };

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentLocation]);

  // Device orientation for heading (supports both Android and iOS)
  useEffect(() => {
    let absoluteSupported = false;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      // Skip if absolute orientation is available (Android)
      if (absoluteSupported) return;

      // iOS: webkitCompassHeading is more accurate
      const compassHeading = (event as any).webkitCompassHeading;
      if (compassHeading !== undefined && compassHeading !== null) {
        setHeading(compassHeading);
        setHasOrientationSensor(true);
      }
    };

    const handleAbsoluteOrientation = (event: DeviceOrientationEvent) => {
      // Android: deviceorientationabsolute gives north-relative heading
      absoluteSupported = true;
      if (event.alpha !== null) {
        // alpha is counterclockwise from north, convert to clockwise
        setHeading((360 - event.alpha) % 360);
        setHasOrientationSensor(true);
      }
    };

    // Check if permission API exists (iOS 13+)
    const DeviceOrientationEventWithPermission = DeviceOrientationEvent as any;
    if (typeof DeviceOrientationEventWithPermission.requestPermission === 'function') {
      // Will request permission on user gesture later
      // For now, don't add listener
    } else {
      // Android and older iOS - add both listeners
      window.addEventListener('deviceorientationabsolute', handleAbsoluteOrientation as EventListener, true);
      window.addEventListener('deviceorientation', handleOrientation, true);
    }

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleAbsoluteOrientation as EventListener, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  // Request orientation permission on iOS (needs user gesture)
  const requestOrientationPermission = useCallback(async () => {
    const DeviceOrientationEventWithPermission = DeviceOrientationEvent as any;
    if (typeof DeviceOrientationEventWithPermission.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEventWithPermission.requestPermission();
        if (permission === 'granted') {
          window.addEventListener('deviceorientation', (event: DeviceOrientationEvent) => {
            const compassHeading = (event as any).webkitCompassHeading;
            if (compassHeading !== undefined && compassHeading !== null) {
              setHeading(compassHeading);
              setHasOrientationSensor(true);
            }
          }, true);
        }
      } catch (error) {
        console.error('Orientation permission error:', error);
      }
    }
  }, []);

  // Create current location marker element (for Advanced Marker)
  const createCurrentLocationMarkerContent = useCallback(() => {
    // Container with 0 size - elements are positioned absolutely from center
    // This prevents zoom drift issues
    const container = document.createElement('div');
    container.style.cssText = `
      position: relative;
      width: 0;
      height: 0;
    `;

    // Outer accuracy circle (subtle blue ring like Google Maps)
    const accuracyCircle = document.createElement('div');
    accuracyCircle.style.cssText = `
      position: absolute;
      left: -75px;
      top: -75px;
      width: 150px;
      height: 150px;
      border-radius: 50%;
      border: 1px solid rgba(59, 130, 246, 0.25);
      background: radial-gradient(circle, rgba(59, 130, 246, 0.06) 0%, transparent 70%);
      pointer-events: none;
    `;
    container.appendChild(accuracyCircle);

    // Direction indicator beam (cone shape with radial fade - Google Maps style)
    const directionIndicator = document.createElement('div');
    directionIndicator.id = 'direction-indicator';
    directionIndicator.style.cssText = `
      position: absolute;
      left: -75px;
      top: -75px;
      width: 150px;
      height: 150px;
      border-radius: 50%;
      background: conic-gradient(
        from -30deg,
        transparent 0deg,
        rgba(59, 130, 246, 0.5) 0deg,
        rgba(59, 130, 246, 0.3) 30deg,
        rgba(59, 130, 246, 0.3) 30deg,
        rgba(59, 130, 246, 0.5) 60deg,
        transparent 60deg
      );
      -webkit-mask-image: radial-gradient(circle, transparent 10%, black 15%, black 55%, transparent 100%);
      mask-image: radial-gradient(circle, transparent 10%, black 15%, black 55%, transparent 100%);
      transform-origin: center center;
      opacity: 0;
      transition: opacity 0.3s ease-out;
      pointer-events: none;
    `;
    container.appendChild(directionIndicator);

    // Blue dot (center) - larger size (24px)
    const dot = document.createElement('div');
    dot.style.cssText = `
      position: absolute;
      left: -12px;
      top: -12px;
      width: 24px;
      height: 24px;
      background-color: rgb(59, 130, 246);
      border-radius: 50%;
      border: 4px solid white;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
      z-index: 10;
    `;
    container.appendChild(dot);

    return container;
  }, []);

  // レガシーモード用の青い丸アイコン
  const getLegacyCurrentLocationIcon = useCallback((): google.maps.Symbol => {
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: '#4285F4',
      fillOpacity: 1,
      strokeColor: 'white',
      strokeWeight: 3,
    };
  }, []);

  // マーカーの位置を更新するヘルパー関数
  const updateMarkerPosition = useCallback((marker: MarkerType, position: { lat: number; lng: number }) => {
    if ('position' in marker && typeof marker.position !== 'function') {
      // AdvancedMarkerElement
      (marker as google.maps.marker.AdvancedMarkerElement).position = position;
    } else {
      // Legacy Marker
      (marker as google.maps.Marker).setPosition(position);
    }
  }, []);

  // マーカーの現在位置を取得するヘルパー関数
  const getMarkerPosition = useCallback((marker: MarkerType): google.maps.LatLngLiteral | null => {
    if ('position' in marker && typeof marker.position !== 'function') {
      // AdvancedMarkerElement
      return (marker as google.maps.marker.AdvancedMarkerElement).position as google.maps.LatLngLiteral;
    } else {
      // Legacy Marker
      const pos = (marker as google.maps.Marker).getPosition();
      return pos ? { lat: pos.lat(), lng: pos.lng() } : null;
    }
  }, []);

  // Initialize map only once
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google || isInitializedRef.current) return;

    isInitializedRef.current = true;

    const initMap = async () => {
      const { Map } = await google.maps.importLibrary('maps') as google.maps.MapsLibrary;
      const initialPos = initialPositionRef.current;

      // AdvancedMarkerElementが利用可能かチェック（実際にインスタンス化して確認）
      let useAdvancedMarker = false;
      let AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement | null = null;

      try {
        const markerLib = await google.maps.importLibrary('marker') as google.maps.MarkerLibrary;
        if (markerLib && markerLib.AdvancedMarkerElement) {
          // クラスが存在しても実際に動くかテスト用マップで確認
          const testDiv = document.createElement('div');
          testDiv.style.cssText = 'position:absolute;width:1px;height:1px;left:-9999px;';
          document.body.appendChild(testDiv);

          try {
            // テスト用のマップを作成（mapIdなし = ラスターマップ）
            const testMap = new Map(testDiv, {
              center: { lat: 0, lng: 0 },
              zoom: 1,
              disableDefaultUI: true,
            });

            // 実際にAdvancedMarkerElementをインスタンス化してみる
            const testMarker = new markerLib.AdvancedMarkerElement({
              map: testMap,
              position: { lat: 0, lng: 0 },
            });

            // 成功したらクリーンアップ
            testMarker.map = null;
            document.body.removeChild(testDiv);

            AdvancedMarkerElement = markerLib.AdvancedMarkerElement;
            useAdvancedMarker = true;
            console.log('AdvancedMarkerElement: 利用可能');
          } catch (testError) {
            // インスタンス化に失敗
            document.body.removeChild(testDiv);
            console.warn('AdvancedMarkerElement: インスタンス化に失敗、レガシーモードを使用:', testError);
            useAdvancedMarker = false;
          }
        } else {
          console.log('AdvancedMarkerElement: クラスが見つかりません、レガシーモードを使用');
        }
      } catch (error) {
        console.warn('マーカーライブラリの読み込みに失敗、レガシーモードを使用:', error);
        useAdvancedMarker = false;
      }

      isLegacyModeRef.current = !useAdvancedMarker;
      console.log('地図モード:', useAdvancedMarker ? 'Advanced (Vector)' : 'Legacy (Raster)');

      // 地図オプション（スプレッド演算子でmapIdを条件付き追加）
      const mapOptions: google.maps.MapOptions = {
        center: { lat: initialPos.lat, lng: initialPos.lng },
        zoom: 16,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        // AdvancedMarkerが使える場合のみmapIdをセット（ベクターマップ）
        // レガシーモードではmapIdなし（ラスターマップ = 軽量）
        ...(useAdvancedMarker ? { mapId: 'kokomemo-map' } : {}),
      };

      const map = new Map(mapRef.current!, mapOptions);
      mapInstanceRef.current = map;

      // マーカーの作成（モードに応じて分岐）
      let marker: MarkerType;

      if (useAdvancedMarker && AdvancedMarkerElement) {
        // Advanced Marker モード
        marker = new AdvancedMarkerElement({
          map,
          position: { lat: initialPos.lat, lng: initialPos.lng },
          gmpDraggable: true,
        });

        // Handle marker drag end (Advanced)
        marker.addListener('dragend', async () => {
          const position = (marker as google.maps.marker.AdvancedMarkerElement).position as google.maps.LatLngLiteral;
          if (position && onLocationChangeRef.current) {
            setIsLoadingLocation(true);
            try {
              const result = await reverseGeocode(position.lat, position.lng, GOOGLE_MAPS_API_KEY);
              onLocationChangeRef.current(position.lat, position.lng, result.address, result.placeName);
            } catch (error) {
              console.error('Reverse geocode error:', error);
              onLocationChangeRef.current(position.lat, position.lng, `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`);
            } finally {
              setIsLoadingLocation(false);
            }
          }
        });
      } else {
        // Legacy Marker モード
        marker = new google.maps.Marker({
          map,
          position: { lat: initialPos.lat, lng: initialPos.lng },
          draggable: true,
        });

        // Handle marker drag end (Legacy)
        marker.addListener('dragend', async () => {
          const position = (marker as google.maps.Marker).getPosition();
          if (position && onLocationChangeRef.current) {
            const lat = position.lat();
            const lng = position.lng();
            setIsLoadingLocation(true);
            try {
              const result = await reverseGeocode(lat, lng, GOOGLE_MAPS_API_KEY);
              onLocationChangeRef.current(lat, lng, result.address, result.placeName);
            } catch (error) {
              console.error('Reverse geocode error:', error);
              onLocationChangeRef.current(lat, lng, `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
            } finally {
              setIsLoadingLocation(false);
            }
          }
        });
      }

      markerRef.current = marker;

      // Handle long press using map click event
      let pressStartPos = { x: 0, y: 0 };
      let isPressing = false;

      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          isPressing = true;
          pressStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };

          longPressTimerRef.current = window.setTimeout(() => {
            if (isPressing) {
              // Trigger long press action at current touch position
              const touch = e.touches[0];
              if (touch) {
                handleLongPressAt(touch.clientX, touch.clientY);
              }
            }
          }, 600);
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (!isPressing) return;

        const touch = e.touches[0];
        if (!touch) return;

        const moveThreshold = 15;
        if (
          Math.abs(touch.clientX - pressStartPos.x) > moveThreshold ||
          Math.abs(touch.clientY - pressStartPos.y) > moveThreshold
        ) {
          // User is scrolling, cancel long press
          isPressing = false;
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
        }
      };

      const handleTouchEnd = () => {
        isPressing = false;
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        // Request orientation permission on iOS (user gesture)
        requestOrientationPermission();
      };

      const handleLongPressAt = async (clientX: number, clientY: number) => {
        const rect = mapRef.current!.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        // Use overlay projection for accurate conversion
        const bounds = map.getBounds();
        const ne = bounds?.getNorthEast();
        const sw = bounds?.getSouthWest();

        if (ne && sw) {
          const mapWidth = rect.width;
          const mapHeight = rect.height;

          const lng = sw.lng() + (x / mapWidth) * (ne.lng() - sw.lng());
          const lat = ne.lat() - (y / mapHeight) * (ne.lat() - sw.lat());

          // Move marker without panning
          updateMarkerPosition(marker, { lat, lng });

          // Get address
          if (onLocationChangeRef.current) {
            setIsLoadingLocation(true);
            try {
              const result = await reverseGeocode(lat, lng, GOOGLE_MAPS_API_KEY);
              onLocationChangeRef.current(lat, lng, result.address, result.placeName);
            } catch (error) {
              console.error('Reverse geocode error:', error);
              onLocationChangeRef.current(lat, lng, `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
            } finally {
              setIsLoadingLocation(false);
            }
          }
        }
      };

      // Only add touch events for long press (mouse can use drag)
      const mapElement = mapRef.current!;
      mapElement.addEventListener('touchstart', handleTouchStart, { passive: true });
      mapElement.addEventListener('touchmove', handleTouchMove, { passive: true });
      mapElement.addEventListener('touchend', handleTouchEnd);
      mapElement.addEventListener('touchcancel', handleTouchEnd);

      // Request orientation permission on first click (for iOS)
      const handleFirstClick = () => {
        requestOrientationPermission();
        mapElement.removeEventListener('click', handleFirstClick);
      };
      mapElement.addEventListener('click', handleFirstClick);
    };

    initMap().catch((error) => {
      console.error('地図の初期化に失敗しました:', error);
      setMapError('地図の読み込みに失敗しました。ページを再読み込みしてください。');
    });

    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, [isLoaded, requestOrientationPermission, updateMarkerPosition]);

  // Create/update current location marker using smooth location
  useEffect(() => {
    if (!mapInstanceRef.current || !isInitializedRef.current || !smoothLocation) return;

    const createOrUpdateMarker = async () => {
      if (!currentLocationMarkerRef.current) {
        // 新規作成
        if (!isLegacyModeRef.current) {
          // Advanced Marker モード
          try {
            const markerLib = await google.maps.importLibrary('marker') as google.maps.MarkerLibrary;
            if (markerLib && markerLib.AdvancedMarkerElement) {
              const content = createCurrentLocationMarkerContent();
              currentLocationMarkerRef.current = new markerLib.AdvancedMarkerElement({
                map: mapInstanceRef.current!,
                position: smoothLocation,
                content,
              });
            } else {
              throw new Error('AdvancedMarkerElement not available');
            }
          } catch (error) {
            console.warn('現在地マーカー: AdvancedMarkerの作成に失敗、レガシーモードに切替:', error);
            // フォールバックとしてLegacy Markerを使用
            isLegacyModeRef.current = true;
            currentLocationMarkerRef.current = new google.maps.Marker({
              map: mapInstanceRef.current!,
              position: smoothLocation,
              icon: getLegacyCurrentLocationIcon(),
            });
          }
        } else {
          // Legacy Marker モード
          console.log('現在地マーカー: レガシーモードで作成');
          currentLocationMarkerRef.current = new google.maps.Marker({
            map: mapInstanceRef.current!,
            position: smoothLocation,
            icon: getLegacyCurrentLocationIcon(),
          });
        }
      } else {
        // 位置更新
        updateMarkerPosition(currentLocationMarkerRef.current, smoothLocation);
      }
    };

    createOrUpdateMarker();
  }, [smoothLocation, createCurrentLocationMarkerContent, getLegacyCurrentLocationIcon, updateMarkerPosition]);

  // Update direction indicator rotation (Advanced Marker only)
  useEffect(() => {
    if (!currentLocationMarkerRef.current || isLegacyModeRef.current) return;

    // Advanced Marker のみ方向インジケーターを更新
    const advancedMarker = currentLocationMarkerRef.current as google.maps.marker.AdvancedMarkerElement;
    const content = advancedMarker.content as HTMLElement;
    const indicator = content?.querySelector('#direction-indicator') as HTMLElement;

    if (indicator) {
      if (heading !== null && hasOrientationSensor) {
        // Show indicator and rotate to heading
        indicator.style.transform = `rotate(${heading}deg)`;
        indicator.style.opacity = '1';
      } else {
        // Hide indicator when no heading data
        indicator.style.opacity = '0';
      }
    }
  }, [heading, hasOrientationSensor]);

  // Pan map to new position when it changes significantly (initial location load)
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current || !isInitializedRef.current) return;
    if (hasInitialPanRef.current) return; // Only pan once for initial location

    const currentCenter = mapInstanceRef.current.getCenter();
    if (!currentCenter) return;

    const latDiff = Math.abs(currentCenter.lat() - latitude);
    const lngDiff = Math.abs(currentCenter.lng() - longitude);

    // Large movement (initial location load) - pan map and marker
    if (latDiff > 0.01 || lngDiff > 0.01) {
      hasInitialPanRef.current = true;
      mapInstanceRef.current.panTo({ lat: latitude, lng: longitude });
      updateMarkerPosition(markerRef.current, { lat: latitude, lng: longitude });
    }
  }, [latitude, longitude, updateMarkerPosition]);

  // Update marker position when props change (but don't pan map)
  useEffect(() => {
    if (markerRef.current && isInitializedRef.current) {
      const currentPos = getMarkerPosition(markerRef.current);
      // Only update if position actually changed significantly (avoid floating point issues)
      if (currentPos) {
        const latDiff = Math.abs(currentPos.lat - latitude);
        const lngDiff = Math.abs(currentPos.lng - longitude);
        if (latDiff > 0.00001 || lngDiff > 0.00001) {
          updateMarkerPosition(markerRef.current, { lat: latitude, lng: longitude });
        }
      }
    }
  }, [latitude, longitude, updateMarkerPosition, getMarkerPosition]);

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-200 text-text-secondary">
        地図を読み込み中...
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-200 text-text-secondary p-4 text-center">
        <p className="text-lg mb-4">{mapError}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-white rounded-lg"
        >
          再読み込み
        </button>
      </div>
    );
  }

  // 現在地に戻る
  const handleCenterOnCurrentLocation = useCallback(() => {
    if (mapInstanceRef.current && currentLocation) {
      mapInstanceRef.current.panTo(currentLocation);
    }
  }, [currentLocation]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />
      {isLoadingLocation && (
        <div className="absolute top-2 right-2 bg-white/90 px-3 py-1.5 rounded-lg shadow text-sm flex items-center gap-2 z-10">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>住所を取得中...</span>
        </div>
      )}
      {/* 現在地ボタン */}
      {currentLocation && !hideCurrentLocationButton && (
        <button
          onClick={handleCenterOnCurrentLocation}
          className="absolute bottom-36 right-2.5 w-10 h-10 bg-[#3d4043] rounded-lg shadow-lg flex items-center justify-center active:bg-[#4d5053] z-10"
          aria-label="現在地に移動"
        >
          <div className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
          </div>
        </button>
      )}
      <div className="absolute bottom-2 left-2 bg-white/90 px-2 py-1 rounded text-xs text-text-secondary">
        ピンをドラッグまたは長押しで移動
      </div>
    </div>
  );
}
