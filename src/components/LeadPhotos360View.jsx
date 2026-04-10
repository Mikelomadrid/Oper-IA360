import React from 'react';
import Photos360Gallery from '@/components/Photos360Gallery';

const LeadPhotos360View = ({ leadId }) => {
  return (
    <Photos360Gallery 
        entityId={leadId} 
        entityType="lead"
    />
  );
};

export default LeadPhotos360View;