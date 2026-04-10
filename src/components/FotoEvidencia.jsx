import React, { useState, useEffect, useRef } from 'react';
import { Camera, Link as LinkIcon, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
// import { supabase } from '@/lib/customSupabaseClient'; // Storage interactions removed
// import { toast } from '@/components/ui/use-toast';

const FotoEvidencia = ({ 
  onFotoCapturada, 
  currentFile, // Now expected to be a string (URL or text)
  className,
  label = "Adjuntar Evidencia (Texto/URL)",
  disabled = false,
  uploadBucket, // Ignored
  uploadPathGenerator // Ignored
}) => {
  const [inputValue, setInputValue] = useState('');
  
  // Initialize from props
  useEffect(() => {
    if (typeof currentFile === 'string') {
        setInputValue(currentFile);
    } else {
        setInputValue('');
    }
  }, [currentFile]);

  /* Storage upload logic completely removed/disabled
  const uploadFile = async (file) => { ... }
  */

  const handleTextChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    // Propagate change immediately or wait for explicit save? 
    // Usually immediate propagation is better for controlled inputs in forms
    if (onFotoCapturada) onFotoCapturada(val); 
  };

  const clearValue = () => {
      setInputValue('');
      if (onFotoCapturada) onFotoCapturada(null);
  };

  return (
    <div className={cn("w-full space-y-3", className)}>
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}

      <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                value={inputValue}
                onChange={handleTextChange}
                disabled={disabled}
                placeholder="Pegar enlace o escribir nota..."
                className="pl-9"
            />
          </div>
          {inputValue && !disabled && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={clearValue}
                title="Limpiar"
              >
                  <X className="h-4 w-4" />
              </Button>
          )}
      </div>
      <p className="text-[10px] text-muted-foreground">
          Subida de archivos deshabilitada temporalmente. Usa enlaces externos (Google Drive, Dropbox) o notas de texto.
      </p>
    </div>
  );
};

export default FotoEvidencia;