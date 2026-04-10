import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Loader2, ServerCrash, Package, UploadCloud, ArrowLeft, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import HerramientasAdmin from '@/components/HerramientasAdmin';
import ToolRequests from '@/components/ToolRequests';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ToolCrudModal from '@/components/ToolCrudModal';
import { Badge } from '@/components/ui/badge';


const CategoryImageUploader = ({ categoryId, onUploadComplete }) => {
    const inputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            alert('Archivo demasiado grande. La imagen no debe superar los 10 MB.');
            return;
        }

        setIsUploading(true);
        const path = `${categoryId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        
        try {
            const { error: uploadError } = await supabase.storage
                .from('categorias_herramienta')
                .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type });

            if (uploadError) throw uploadError;

            const { error: rpcError } = await supabase.rpc('categoria_set_imagen', {
                p_categoria_id: categoryId,
                p_imagen_path: path,
            });

            if (rpcError) throw rpcError;

            alert('Imagen actualizada');
            onUploadComplete();
        } catch (error) {
            console.error('Error uploading category image:', error);
            alert('Error al subir imagen: ' + (error.message || ''));
        } finally {
            setIsUploading(false);
            if (inputRef.current) {
                inputRef.current.value = "";
            }
        }
    };

    const handleButtonClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isUploading) {
            inputRef.current?.click();
        }
    };

    const stopPropagation = (e) => {
        e.preventDefault();
        e.stopPropagation();
    }

    return (
        <>
            <input 
                type="file" 
                ref={inputRef} 
                onChange={handleFileChange} 
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onClick={(e) => e.stopPropagation()}
            />
            <Button
                type="button"
                data-role="upload-btn"
                size="sm"
                variant="outline"
                className="absolute bottom-2 right-2 z-10 bg-card/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleButtonClick}
                onMouseDown={stopPropagation}
                onPointerDown={stopPropagation}
                disabled={isUploading}
            >
                {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                {!isUploading && <UploadCloud className="w-4 h-4" />}
            </Button>
        </>
    );
};

const Herramientas = ({ navigate }) => {
    const { sessionRole } = useAuth();
    const canManage = useMemo(() => ['admin', 'encargado'].includes(sessionRole.rol), [sessionRole.rol]);
    
    const [view, setView] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('view') === 'requests') return 'requests';
        if (params.get('cat')) return 'tools';
        return 'categories';
    });
    
    const [categoryId, setCategoryId] = useState(() => new URLSearchParams(window.location.search).get('cat'));
    
    const [categories, setCategories] = useState([]);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('catalogo');
    const [isCrudModalOpen, setIsCrudModalOpen] = useState(false);


    const fetchCategories = useCallback(async () => {
        setLoadingCategories(true);
        setError(null);
        try {
            const { data, error } = await supabase.from('v_categorias_herramientas_catalogo').select('*').order('categoria_nombre', { ascending: true });
            if (error) throw error;
            setCategories(data);
        } catch (e) {
            setError(e);
            alert('Error al cargar categorías: ' + (e.message || ''));
        } finally {
            setLoadingCategories(false);
        }
    }, []);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);
    
    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const cat = params.get('cat');
            const viewParam = params.get('view');

            if (viewParam === 'requests') {
                setView('requests');
                setCategoryId(null);
                setActiveTab('solicitudes');
            } else if (cat) {
                setView('tools');
                setCategoryId(cat);
                setActiveTab('catalogo');
            } else {
                setView('categories');
                setCategoryId(null);
                setActiveTab('catalogo');
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);


    const getPublicUrl = (path) => {
        if (!path) return null;
        const { data } = supabase.storage.from('categorias_herramienta').getPublicUrl(path);
        return data.publicUrl;
    };
    
    const handleCategoryClick = (e, category) => {
      if (e.target && e.target.closest('[data-role="upload-btn"]')) return;
      navigate(`/herramientas?cat=${category.categoria_id}`);
    }

    const handleBackToCatalog = useCallback(() => {
        navigate('/herramientas');
    }, [navigate]);

    const handleTabChange = (tabValue) => {
        setActiveTab(tabValue);
        if (tabValue === 'solicitudes') {
            navigate('/herramientas?view=requests');
        } else {
            if(categoryId || view === 'tools') {
                handleBackToCatalog();
            }
        }
    };
    
    const renderContent = () => {
        const params = new URLSearchParams(window.location.search);
        const currentCatId = params.get('cat');
        const currentView = params.get('view');

        if (currentView === 'requests') {
             return (
                <div className="p-4 md:p-8">
                     <Tabs value="solicitudes" onValueChange={handleTabChange}>
                        <TabsList>
                            <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
                            {(canManage || sessionRole.rol === 'tecnico') && <TabsTrigger value="solicitudes">Solicitudes</TabsTrigger>}
                        </TabsList>
                        <TabsContent value="solicitudes" className="mt-6">
                            <ToolRequests navigate={navigate} />
                        </TabsContent>
                    </Tabs>
                </div>
            );
        }

        if (currentCatId) {
            const selectedCategory = categories.find(cat => cat.categoria_id === currentCatId);
            return (
                <div className="p-4 md:p-8">
                    <Button variant="ghost" onClick={handleBackToCatalog} className="mb-4">
                        <ArrowLeft className="mr-2 h-4 w-4"/> Volver al Catálogo
                    </Button>
                    <HerramientasAdmin 
                        categoryId={currentCatId} 
                        categoryName={selectedCategory ? selectedCategory.categoria_nombre : 'Cargando...'} 
                        navigate={navigate} 
                    />
                </div>
            );
        }

        return (
             <Tabs value={activeTab} onValueChange={handleTabChange} className="p-4 md:p-8">
                <div className="flex flex-wrap justify-between items-center gap-4">
                    <TabsList>
                        <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
                         {(canManage || sessionRole.rol === 'tecnico') && <TabsTrigger value="solicitudes">Solicitudes</TabsTrigger>}
                    </TabsList>
                    {canManage && activeTab === 'catalogo' && (
                        <Button onClick={() => setIsCrudModalOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Nueva Herramienta
                        </Button>
                    )}
                </div>
                <TabsContent value="catalogo" className="mt-6">
                    {loadingCategories ? (
                        <div className="flex items-center justify-center p-8 h-full"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center bg-card rounded-lg m-8 border border-destructive/50">
                            <ServerCrash className="w-16 h-16 text-destructive mb-4" />
                            <h2 className="text-2xl font-bold text-destructive mb-2">Error de Carga</h2>
                            <p className="text-muted-foreground mb-4">{error.message}</p>
                            <Button onClick={fetchCategories}>Reintentar</Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                            {categories.map((cat, index) => {
                                const hasStock = cat.herramientas_con_stock > 0;
                                return (
                                <motion.div
                                    key={cat.categoria_id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                >
                                    <Card 
                                        className="group relative aspect-square flex flex-col overflow-hidden transition-all duration-300 ease-in-out hover:shadow-xl hover:-translate-y-1 cursor-pointer bg-card border border-border/50 rounded-xl"
                                        onClick={(e) => handleCategoryClick(e, cat)}
                                    >
                                        <div className="absolute inset-0">
                                            {cat.imagen_path ? (
                                                <img src={getPublicUrl(cat.imagen_path)} alt={cat.categoria_nombre} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 rounded-xl" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-muted rounded-xl">
                                                    <Package className="w-16 h-16 text-muted-foreground/30" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent rounded-xl"></div>
                                        <div className="relative flex flex-col justify-end h-full p-4 text-white">
                                            <h3 className="text-lg font-bold drop-shadow-md">{cat.categoria_nombre}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="secondary" className="text-xs backdrop-blur-sm bg-white/20 border-none">{cat.total_herramientas || 0} Total</Badge>
                                                <Badge className={`text-xs backdrop-blur-sm border-none ${hasStock ? 'bg-green-500/80' : 'bg-destructive/80'}`}>
                                                    {hasStock ? `${cat.herramientas_con_stock} Disp.` : 'Sin Stock'}
                                                </Badge>
                                            </div>
                                        </div>
                                        {canManage && <CategoryImageUploader categoryId={cat.categoria_id} onUploadComplete={fetchCategories} />}
                                    </Card>
                                </motion.div>
                            )})}
                        </div>
                    )}
                </TabsContent>
                <TabsContent value="solicitudes" className="mt-6">
                    <ToolRequests navigate={navigate} />
                </TabsContent>
            </Tabs>
        );
    }
    
    return (
        <>
            {renderContent()}
            {isCrudModalOpen && (
                <ToolCrudModal
                    isOpen={isCrudModalOpen}
                    onClose={() => {
                        setIsCrudModalOpen(false);
                        // No need to reset editingTool here if we're only adding new
                    }}
                    onSuccess={() => {
                        fetchCategories();
                    }}
                    // Passing an empty object or just the categoryId for initialData when creating new
                    initialData={categoryId ? { categoria_id: categoryId } : {}}
                />
            )}
        </>
    );
}

export default Herramientas;