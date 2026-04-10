import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FolderPlus, Folder } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Helmet } from 'react-helmet';

export default function CarpetasPage() {
  const handleCreate = () => {
    toast({ 
        title: "🚧 Próximamente", 
        description: "La funcionalidad de crear carpetas estará disponible pronto." 
    });
  };

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-500">
      <Helmet>
        <title>Carpetas | Gestión Documental</title>
      </Helmet>

      <div className="flex items-center justify-between px-6 py-6 border-b bg-card">
        <h1 className="text-2xl font-bold flex items-center gap-3 text-foreground">
          <Folder className="w-8 h-8 text-primary" />
          Carpetas
        </h1>
      </div>

      <div className="p-6 md:p-10 flex-1 overflow-auto bg-slate-50/50 dark:bg-background/50">
        <Card className="border-dashed border-2 shadow-none bg-transparent h-full max-h-[500px] flex items-center justify-center">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-6">
            <div className="p-6 rounded-full bg-primary/10 animate-bounce-slow">
              <FolderPlus className="w-16 h-16 text-primary" />
            </div>
            <div className="space-y-3 max-w-md">
              <h3 className="text-2xl font-semibold tracking-tight">Organiza tu documentación</h3>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Aquí podrás organizar tus comunidades y guardar facturas, presupuestos y fotos.
              </p>
            </div>
            <Button onClick={handleCreate} size="lg" className="mt-6 px-8 text-md shadow-lg hover:shadow-xl transition-all">
              <FolderPlus className="w-5 h-5 mr-2" />
              Crear carpeta
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}