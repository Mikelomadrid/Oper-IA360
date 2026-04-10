import React from 'react';
import Sphere360Viewer from '@/components/Sphere360Viewer';

/**
 * Backward compatibility wrapper for the previous PannellumViewer.
 * This ensures existing imports don't break while using the new Sphere360Viewer.
 */
const PannellumViewer = ({ image, title, autoLoad = true, showFullscreenCtrl = true }) => {
  return (
    <div className="w-full h-full relative rounded-lg overflow-hidden bg-black shadow-inner">
      <Sphere360Viewer 
        imageUrl={image}
        title={title}
        autoLoad={autoLoad}
      />
    </div>
  );
};

export default PannellumViewer;