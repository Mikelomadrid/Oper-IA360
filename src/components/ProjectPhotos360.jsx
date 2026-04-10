import React from 'react';
import Photos360Gallery from '@/components/Photos360Gallery';

const ProjectPhotos360 = ({ projectId }) => {
  return (
    <Photos360Gallery 
        entityId={projectId} 
        entityType="proyecto"
    />
  );
};

export default ProjectPhotos360;