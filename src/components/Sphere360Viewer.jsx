import React, { useEffect, useRef, useState } from 'react';
import { Viewer } from '@photo-sphere-viewer/core';
import '@photo-sphere-viewer/core/index.css';
import { Loader2, AlertCircle } from 'lucide-react';

const Sphere360Viewer = ({ imageUrl, title, autoLoad = true }) => {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If no imageUrl, don't do anything yet
    if (!imageUrl) return;

    // Destroy existing viewer if any
    if (viewerRef.current) {
      viewerRef.current.destroy();
      viewerRef.current = null;
    }

    if (!containerRef.current) return;

    try {
      setLoading(true);
      setError(null);

      // Initialize the viewer
      const viewer = new Viewer({
        container: containerRef.current,
        panorama: imageUrl,
        caption: title || '',
        loadingTxt: '', // We use our own loader overlay
        defaultZoomLvl: 50,
        navbar: [
          'zoom',
          'move',
          'caption',
          'fullscreen',
        ],
        mousewheel: true,
        touchmoveTwoFingers: true,
      });

      viewerRef.current = viewer;

      // Event listeners
      viewer.addEventListener('ready', () => {
        setLoading(false);
      });

      viewer.addEventListener('load-error', (e) => {
        console.error('Sphere360Viewer error:', e);
        setLoading(false);
        setError('No se pudo cargar la imagen 360º. Verifique que la URL sea válida.');
      });

    } catch (err) {
      console.error('Sphere360Viewer initialization error:', err);
      setLoading(false);
      setError('Error al inicializar el visor 360º.');
    }

    // Cleanup
    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [imageUrl, title]);

  return (
    <div className="w-full h-full relative bg-gray-900 overflow-hidden rounded-md group">
      {/* Container for the Photo Sphere Viewer */}
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10 text-white backdrop-blur-sm transition-opacity duration-300">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm font-medium">Cargando experiencia 360º...</span>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20 text-red-400 p-4 text-center">
          <div className="flex flex-col items-center gap-3">
            <AlertCircle className="w-10 h-10" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sphere360Viewer;