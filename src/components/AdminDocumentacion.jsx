import React from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { AlertTriangle, Building } from 'lucide-react';
import { Card } from '@/components/ui/card';
import DocumentationExplorer from '@/components/documentation/DocumentationExplorer';

const AdminDocumentacion = () => {
  const { user, sessionRole } = useAuth();
  
  // Access Control: Strict whitelist for Admin Docs
  const allowedEmails = ['admin@orkaled.com', 'dana@orkaled.com', 'miguel@orkaled.com'];
  
  // Allow if email is whitelisted OR role is 'admin' (flexibility)
  const isAuthorized = user && (allowedEmails.includes(user.email) || sessionRole?.rol === 'admin');

  if (!isAuthorized) {
      return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="bg-red-50 p-6 rounded-full mb-6 ring-8 ring-red-50/50">
                  <AlertTriangle className="w-16 h-16 text-red-500" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-3">Acceso Restringido</h2>
              <p className="text-slate-500 max-w-lg text-lg leading-relaxed">
                  Esta sección contiene documentación confidencial de la empresa y está restringida exclusivamente a la dirección y administración.
              </p>
          </div>
      );
  }

  return (
    <>
      {/* Mobile/Tablet View - Helper Message (Explorer is responsive but better on desktop) */}
      <div className="lg:hidden flex flex-col items-center justify-center h-[80vh] px-6 text-center animate-in fade-in duration-500">
        <div className="bg-blue-100 p-6 rounded-full mb-6 shadow-sm">
          <Building className="w-12 h-12 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Documentación de Empresa</h2>
        <p className="text-muted-foreground text-lg max-w-sm leading-relaxed mb-6">
          Para una mejor experiencia gestionando archivos y carpetas, te recomendamos utilizar una pantalla más grande.
        </p>
        {/* Still show content on mobile, but warn */}
        <div className="w-full h-full min-h-[400px]">
             <DocumentationExplorer 
                bucketName="admin_docs"
                title="Archivos de Empresa"
             />
        </div>
      </div>

      {/* Desktop View - Full Layout */}
      <div className="hidden lg:flex p-6 h-[calc(100vh-4rem)] flex-col gap-6 bg-slate-50/50 dark:bg-black/20">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-3 text-slate-900 dark:text-white">
                    <Building className="w-9 h-9 text-blue-600" />
                    Documentación de Empresa
                </h1>
                <p className="text-muted-foreground mt-1 text-lg">
                    Repositorio centralizado y seguro para la gestión documental corporativa.
                </p>
            </div>
        </div>

        {/* Main Explorer Component */}
        <div className="flex-1 min-h-0">
           <DocumentationExplorer 
              bucketName="admin_docs"
              title="Archivos de Empresa"
              // No projectId passed means Global/Company scope
           />
        </div>
      </div>
    </>
  );
};

export default AdminDocumentacion;