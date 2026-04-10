import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Shared component for Secure Image Loading from Supabase Storage.
 * Handles both public URLs and private paths requiring Signed URLs.
 */
const AsyncImage = ({ path, alt, className, style }) => {
    const [src, setSrc] = useState(null);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        if (!path) {
            if (mounted) setError(true);
            return;
        }
        const load = async () => {
            try {
                if (path.startsWith('http')) {
                    if (mounted) { setSrc(path); setLoading(false); }
                    return;
                }

                // Handle prefixed paths from migrated leads / docs
                let bucket = 'proyecto_fotos';
                let cleanPath = path;

                if (path.startsWith('lead_fotos://')) {
                    bucket = 'lead_fotos';
                    cleanPath = path.replace('lead_fotos://', '');
                } else if (path.startsWith('lead_docs://')) {
                    bucket = 'lead_docs';
                    cleanPath = path.replace('lead_docs://', '');
                } else if (path.includes('/docs/')) {
                    // If the path suggests it's in the docs folder, check that bucket
                    // Standard structure: obras/{projectId}/docs/...
                    bucket = 'proyecto_docs';
                }

                // Create a signed URL valid for 1 hour
                const { data, error: signedError } = await supabase.storage
                    .from(bucket)
                    .createSignedUrl(cleanPath, 3600);

                if (signedError) {
                    // Retry with docs bucket if fotos bucket failed and it looks like a generic path
                    if (bucket === 'proyecto_fotos') {
                        const { data: docData, error: docError } = await supabase.storage
                            .from('proyecto_docs')
                            .createSignedUrl(cleanPath, 3600);

                        if (docError) throw signedError;
                        if (mounted) { setSrc(docData.signedUrl); setLoading(false); }
                    } else {
                        throw signedError;
                    }
                } else if (mounted) {
                    setSrc(data.signedUrl);
                    setLoading(false);
                }
            } catch (e) {
                if (mounted) { setError(true); setLoading(false); }
            }
        };
        load();
        return () => { mounted = false; };
    }, [path]);

    if (error) return (
        <div className={cn("flex items-center justify-center bg-muted text-muted-foreground/30", className)} style={style}>
            <AlertCircle className="w-5 h-5" />
        </div>
    );

    if (loading) return <div className={cn("animate-pulse bg-muted", className)} style={style} />;

    return (
        <img
            src={src}
            alt={alt}
            className={className}
            style={style}
            onError={() => setError(true)}
            loading="lazy"
        />
    );
};

export default AsyncImage;
