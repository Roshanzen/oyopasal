import { useState, useCallback, useRef, useEffect } from 'react';
import { Coordinates } from '../types';

export interface GeolocationState {
  locating: boolean;
  coords: Coordinates | null;
  accuracy: number | null;
  error: string | null;
  errorCode: number | null;
}

export function useNativeGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    locating: false,
    coords: null,
    accuracy: null,
    error: null,
    errorCode: null,
  });

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null, errorCode: null }));
  }, []);

  const detectLocation = useCallback(
    (): Promise<Coordinates> => {
      return new Promise((resolve, reject) => {
        if (!('geolocation' in navigator) || !navigator.geolocation) {
          const msg = 'Geolocation is not supported by your browser. Please select your location on the map.';
          setState({
            locating: false,
            coords: null,
            accuracy: null,
            error: msg,
            errorCode: 0,
          });
          reject(new Error(msg));
          return;
        }

        setState((prev) => ({
          ...prev,
          locating: true,
          error: null,
          errorCode: null,
        }));

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!isMountedRef.current) return;
            const newCoords: Coordinates = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            };
            setState({
              locating: false,
              coords: newCoords,
              accuracy: pos.coords.accuracy,
              error: null,
              errorCode: null,
            });
            resolve(newCoords);
          },
          (err) => {
            if (!isMountedRef.current) return;
            let friendlyMsg = 'Could not determine your exact position. Please select your location on the map.';
            if (err.code === 1) {
              friendlyMsg = 'Location permission was denied. Please allow location access in your browser or select your location on the map.';
            } else if (err.code === 2) {
              friendlyMsg = 'Location services are unavailable or GPS signal is weak. Please pick your location on the map.';
            } else if (err.code === 3) {
              friendlyMsg = 'Location detection timed out. Please try again or tap the map directly.';
            }

            setState({
              locating: false,
              coords: null,
              accuracy: null,
              error: friendlyMsg,
              errorCode: err.code,
            });
            reject(new Error(friendlyMsg));
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000,
          }
        );
      });
    },
    []
  );

  return {
    ...state,
    detectLocation,
    clearError,
  };
}
