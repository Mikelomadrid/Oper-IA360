import { useState, useCallback } from 'react';

export const useGeolocation = () => {
    const [location, setLocation] = useState({ lat: null, lng: null });
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const getLocation = useCallback(async () => {
        setLoading(true);
        setError(null);

        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                const err = { message: 'Geolocalización no soportada por el navegador.' };
                setError(err);
                setLoading(false);
                resolve({ lat: null, lng: null, error: err });
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const loc = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    setLocation(loc);
                    setLoading(false);
                    resolve({ ...loc, error: null });
                },
                (err) => {
                    let msg = 'Error desconocido de ubicación.';
                    switch(err.code) {
                        case 1: msg = 'Permiso de ubicación denegado. Por favor actívalo en tu navegador.'; break;
                        case 2: msg = 'Ubicación no disponible.'; break;
                        case 3: msg = 'Tiempo de espera agotado.'; break;
                    }
                    const errorObj = { ...err, message: msg };
                    setError(errorObj);
                    setLoading(false);
                    resolve({ lat: null, lng: null, error: errorObj });
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        });
    }, []);

    return { 
        lat: location.lat, 
        lng: location.lng, 
        error, 
        loading, 
        getLocation 
    };
};