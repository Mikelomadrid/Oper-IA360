import React from 'react';
import ProjectFolders from '@/components/ProjectFolders';

/**
 * ProjectPhotosView now leverages the hierarchical ProjectFolders component
 * with tipo="foto" to support folders and subfolders for project images.
 */
const ProjectPhotosView = ({ projectId, canManage, canUpload }) => {
  return (
    <>
      <ProjectFolders
        projectId={projectId}
        tipo="foto"
        canEdit={canManage || canUpload}
      />
    </>
  );
};

export default ProjectPhotosView;