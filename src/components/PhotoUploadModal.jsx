import React, { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Image as ImageIcon, Loader2 } from 'lucide-react';

const PhotoUploadModal = ({ isOpen, onClose, onPhotosSelected, title = "Subir Fotos", allowMultiple = true }) => {
    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);
    const [processing, setProcessing] = useState(false);

    const handleFileChange = (e) => {
        const fileList = e.target.files;
        
        if (fileList && fileList.length > 0) {
            setProcessing(true);
            
            // Convert FileList to a proper Array immediately to avoid any loss of reference
            const filesArray = Array.from(fileList);
            
            console.log(`PhotoUploadModal: Selected ${filesArray.length} files`); // Debug log

            // Pass files to parent immediately without setTimeout to prevent race conditions
            if (onPhotosSelected) {
                try {
                    onPhotosSelected(filesArray);
                } catch (err) {
                    console.error("PhotoUploadModal: Error passing files to parent", err);
                }
            }
            
            // Reset processing state
            setProcessing(false);
        }
        
        // Reset input value to allow selecting the same file again if needed
        // This is crucial for "retrying" an upload if the user picks the same file
        e.target.value = '';
    };

    const handleCameraClick = () => {
        if (cameraInputRef.current) {
            cameraInputRef.current.click();
        }
    };

    const handleGalleryClick = () => {
        if (galleryInputRef.current) {
            galleryInputRef.current.click();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md max-w-[95vw] rounded-xl border-0 shadow-xl bg-background/95 backdrop-blur-sm">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-center">{title}</DialogTitle>
                    <DialogDescription className="text-center">Elige el origen de la imagen</DialogDescription>
                </DialogHeader>
                
                <div className="grid grid-cols-2 gap-4 py-6">
                    <Button 
                        variant="outline" 
                        className="h-32 flex flex-col gap-3 rounded-2xl border-2 hover:border-primary/50 hover:bg-primary/5 active:scale-95 transition-all shadow-sm"
                        onClick={handleCameraClick}
                        disabled={processing}
                    >
                        {processing ? (
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        ) : (
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-full text-blue-600 dark:text-blue-400">
                                <Camera className="w-8 h-8" />
                            </div>
                        )}
                        <span className="font-semibold text-base">Cámara</span>
                    </Button>

                    <Button 
                        variant="outline" 
                        className="h-32 flex flex-col gap-3 rounded-2xl border-2 hover:border-purple-500/50 hover:bg-purple-500/5 active:scale-95 transition-all shadow-sm"
                        onClick={handleGalleryClick}
                        disabled={processing}
                    >
                        {processing ? (
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        ) : (
                            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-full text-purple-600 dark:text-purple-400">
                                <ImageIcon className="w-8 h-8" />
                            </div>
                        )}
                        <span className="font-semibold text-base">Galería</span>
                    </Button>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} className="w-full rounded-xl h-12 text-muted-foreground" disabled={processing}>
                        Cancelar
                    </Button>
                </DialogFooter>

                {/* Hidden Inputs */}
                {/* Camera Input: capture="environment" forces rear camera on mobile */}
                <input
                    type="file"
                    ref={cameraInputRef}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileChange}
                />
                {/* Gallery Input: multiple allows selecting several photos */}
                <input
                    type="file"
                    ref={galleryInputRef}
                    accept="image/*"
                    multiple={allowMultiple}
                    className="hidden"
                    onChange={handleFileChange}
                />
            </DialogContent>
        </Dialog>
    );
};

export default PhotoUploadModal;