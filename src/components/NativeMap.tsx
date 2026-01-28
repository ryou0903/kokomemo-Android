import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { GoogleMap } from '@capacitor/google-maps';
import { Geolocation } from '@capacitor/geolocation';
import '../capacitor-google-maps.d';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export interface NativeMapProps {
  latitude: number;
  longitude: number;
  onLocationChange?: (lat: number, lng: number) => void;
  hideCurrentLocationButton?: boolean;
}

export interface NativeMapRef {
  panTo: (lat: number, lng: number) => void;
  setMarkerPosition: (lat: number, lng: number) => void;
}

export const NativeMap = forwardRef<NativeMapRef, NativeMapProps>(
  ({ latitude, longitude, onLocationChange, hideCurrentLocationButton }, ref) => {
    const mapRef = useRef<HTMLElement>(null);
    const googleMapRef = useRef<GoogleMap | null>(null);
    const markerIdRef = useRef<string | null>(null);
    const currentLocationMarkerIdRef = useRef<string | null>(null);
    const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [isMapReady, setIsMapReady] = useState(false);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      panTo: async (lat: number, lng: number) => {
        if (googleMapRef.current) {
          await googleMapRef.current.setCamera({
            coordinate: { lat, lng },
            animate: true,
          });
        }
      },
      setMarkerPosition: async (lat: number, lng: number) => {
        if (googleMapRef.current && markerIdRef.current) {
          // Remove old marker and add new one (Capacitor doesn't support moving markers)
          await googleMapRef.current.removeMarker(markerIdRef.current);
          markerIdRef.current = await googleMapRef.current.addMarker({
            coordinate: { lat, lng },
            draggable: true,
          });
        }
      },
    }));

    // Watch current location
    useEffect(() => {
      let watchId: string | null = null;

      const startWatching = async () => {
        try {
          // Check permission first
          const permission = await Geolocation.checkPermissions();
          if (permission.location !== 'granted') {
            const request = await Geolocation.requestPermissions();
            if (request.location !== 'granted') {
              console.warn('Location permission denied');
              return;
            }
          }

          watchId = await Geolocation.watchPosition(
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 5000,
            },
            (position, err) => {
              if (err) {
                console.error('Geolocation error:', err);
                return;
              }
              if (position) {
                setCurrentLocation({
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                });
              }
            }
          );
        } catch (error) {
          console.error('Failed to start location watch:', error);
        }
      };

      startWatching();

      return () => {
        if (watchId) {
          Geolocation.clearWatch({ id: watchId });
        }
      };
    }, []);

    // Initialize map
    useEffect(() => {
      if (!mapRef.current) return;

      const initMap = async () => {
        try {
          const map = await GoogleMap.create({
            id: 'kokomemo-native-map',
            element: mapRef.current!,
            apiKey: GOOGLE_MAPS_API_KEY,
            config: {
              center: { lat: latitude, lng: longitude },
              zoom: 16,
            },
          });

          googleMapRef.current = map;

          // Add draggable marker
          markerIdRef.current = await map.addMarker({
            coordinate: { lat: latitude, lng: longitude },
            draggable: true,
          });

          // Handle marker drag end
          await map.setOnMarkerDragEndListener((event) => {
            if (onLocationChange) {
              onLocationChange(event.latitude, event.longitude);
            }
          });

          // Handle map click (long press equivalent)
          await map.setOnMapClickListener(async (event) => {
            // Move marker to clicked position
            if (markerIdRef.current) {
              await map.removeMarker(markerIdRef.current);
            }
            markerIdRef.current = await map.addMarker({
              coordinate: { lat: event.latitude, lng: event.longitude },
              draggable: true,
            });

            if (onLocationChange) {
              onLocationChange(event.latitude, event.longitude);
            }
          });

          setIsMapReady(true);
        } catch (error) {
          console.error('Failed to create map:', error);
        }
      };

      initMap();

      return () => {
        if (googleMapRef.current) {
          googleMapRef.current.destroy();
          googleMapRef.current = null;
        }
      };
    }, []);

    // Update current location marker
    useEffect(() => {
      if (!googleMapRef.current || !currentLocation || !isMapReady) return;

      const updateCurrentLocationMarker = async () => {
        // Remove old current location marker
        if (currentLocationMarkerIdRef.current) {
          await googleMapRef.current!.removeMarker(currentLocationMarkerIdRef.current);
        }

        // Add new current location marker (blue dot style)
        currentLocationMarkerIdRef.current = await googleMapRef.current!.addMarker({
          coordinate: currentLocation,
          draggable: false,
          iconUrl: 'data:image/svg+xml;base64,' + btoa(`
            <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" fill="rgba(59, 130, 246, 0.2)" stroke="rgba(59, 130, 246, 0.5)" stroke-width="1"/>
              <circle cx="12" cy="12" r="6" fill="#3B82F6" stroke="white" stroke-width="2"/>
            </svg>
          `),
        });
      };

      updateCurrentLocationMarker();
    }, [currentLocation, isMapReady]);

    // Pan to current location
    const handleCenterOnCurrentLocation = useCallback(async () => {
      if (googleMapRef.current && currentLocation) {
        await googleMapRef.current.setCamera({
          coordinate: currentLocation,
          animate: true,
        });
      }
    }, [currentLocation]);

    return (
      <div className="relative w-full h-full">
        <capacitor-google-map
          ref={mapRef}
          style={{
            display: 'inline-block',
            width: '100%',
            height: '100%',
          }}
        />

        {/* Current location button */}
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
          タップまたはピンをドラッグで場所を選択
        </div>
      </div>
    );
  }
);

NativeMap.displayName = 'NativeMap';
