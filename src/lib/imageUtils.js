import { supabase } from '@/lib/customSupabaseClient';

/**
 * Helper utility to get the thumbnail URL for a tool image.
 * Checks if a thumbnail likely exists based on the convention 'thumbnails/filename'.
 * Handles leading slashes to avoid double slashes in URL.
 * 
 * @param {string} path - The storage path of the original image
 * @param {string} bucket - The bucket name (default: 'herramientas_fotos')
 * @returns {string|null} - The public URL of the thumbnail
 */
export const getThumbnailUrl = (path, bucket = 'herramientas_fotos') => {
  if (!path) return null;

  // Normalize path by removing leading slashes
  const cleanPath = path.replace(/^\/+/, '');

  // If the path is already a thumbnail, return its public URL
  if (cleanPath.startsWith('thumbnails/')) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(cleanPath);
    return data.publicUrl;
  }

  // Construct the expected thumbnail path
  const thumbnailPath = `thumbnails/${cleanPath}`;
  
  const { data } = supabase.storage.from(bucket).getPublicUrl(thumbnailPath);
  return data.publicUrl;
};

/**
 * Helper to get the original image URL, stripping any thumbnail prefix if present.
 */
export const getOriginalUrl = (path, bucket = 'herramientas_fotos') => {
    if (!path) return null;
    
    // Strip 'thumbnails/' prefix if present to ensure we get the original
    const cleanPath = path.replace(/^thumbnails\//, '').replace(/^\/+/, '');
    
    const { data } = supabase.storage.from(bucket).getPublicUrl(cleanPath);
    return data.publicUrl;
};

/**
 * Scans the bucket to find images that don't have a corresponding thumbnail.
 * @param {string} bucket - The bucket to scan (default: 'herramientas_fotos')
 * @returns {Promise<{ missing: any[], totalOriginals: number, totalThumbnails: number }>}
 */
export const scanForMissingThumbnails = async (bucket = 'herramientas_fotos') => {
  try {
    // 1. List all files in the root of the bucket (originals)
    const { data: rootFiles, error: rootError } = await supabase
      .storage
      .from(bucket)
      .list('', { limit: 1000, offset: 0 });

    if (rootError) throw rootError;

    // 2. List all files in the 'thumbnails' folder
    const { data: thumbFiles, error: thumbError } = await supabase
      .storage
      .from(bucket)
      .list('thumbnails', { limit: 1000, offset: 0 });

    if (thumbError) throw thumbError;

    // 3. Filter out folders and placeholders from root
    const originalImages = rootFiles.filter(f => 
      f.id && // has an ID
      f.name !== '.emptyFolderPlaceholder' && 
      f.name !== 'thumbnails' // exclude the folder itself
    );

    // 4. Create a Set of existing thumbnail names for O(1) lookup
    const thumbNames = new Set(thumbFiles.map(f => f.name));

    // 5. Find missing
    const missing = originalImages.filter(img => !thumbNames.has(img.name));

    return {
      missing,
      totalOriginals: originalImages.length,
      totalThumbnails: thumbFiles.length
    };

  } catch (error) {
    console.error("Error scanning bucket:", error);
    throw error;
  }
};

/**
 * Fetches all original images from the bucket.
 * @param {string} bucket 
 */
export const getAllOriginalImages = async (bucket = 'herramientas_fotos') => {
    try {
        const { data: rootFiles, error } = await supabase
            .storage
            .from(bucket)
            .list('', { limit: 1000, offset: 0 });
            
        if (error) throw error;
        
        // Filter out folders and placeholders
        return rootFiles.filter(f => 
            f.id && 
            f.name !== '.emptyFolderPlaceholder' && 
            f.name !== 'thumbnails'
        );
    } catch (error) {
        console.error("Error listing images:", error);
        throw error;
    }
};

/**
 * Manually triggers the resize edge function for a specific file.
 * @param {string} fileName - The name of the file in the bucket
 * @param {string} bucket - The bucket name
 */
export const triggerResizeFunction = async (fileName, bucket = 'herramientas_fotos') => {
  const payload = {
    record: {
      bucket_id: bucket,
      name: fileName,
      id: 'manual-trigger' 
    },
    type: 'MANUAL_TRIGGER',
    table: 'objects',
    schema: 'storage'
  };

  const { data, error } = await supabase.functions.invoke('resize-tool-image', {
    body: payload
  });

  if (error) throw error;
  return data;
};