import React from 'react';
import ProjectFolders from '@/components/ProjectFolders';

/**
 * Wrapper component for ProjectFolders to provide a document-specific view.
 * Refactored to use the new hierarchical folder system.
 */
const ProjectDocuments = ({ projectId, canManage, canUpload }) => {
    // ProjectFolders handles permission checks internally using useAuth and helpers,
    // but we pass prop overrides if provided (though ProjectFolders primarily relies on internal logic now).
    return (
        <ProjectFolders 
            projectId={projectId} 
            tipo="docs" 
            canEdit={canManage || canUpload} 
        />
    );
};

export default ProjectDocuments;