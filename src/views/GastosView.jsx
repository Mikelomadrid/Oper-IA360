import React from 'react';
import GastosGenerales from '@/components/GastosGenerales';
import { AlertTriangle } from 'lucide-react';

const GastosView = ({ navigate }) => {
  return (
    <>
      <div className="lg:hidden flex flex-col items-center justify-center h-[80vh] px-6 text-center animate-in fade-in duration-500">
        <div className="bg-amber-100 p-6 rounded-full mb-6 shadow-sm">
          <AlertTriangle className="w-12 h-12 text-amber-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Versión de Escritorio Requerida</h2>
        <p className="text-muted-foreground text-lg max-w-sm leading-relaxed">
          El módulo de <strong>Facturación y Gastos</strong> contiene tablas detalladas optimizadas para pantallas grandes. Por favor, accede desde un ordenador para gestionar esta sección.
        </p>
      </div>
      <div className="hidden lg:block h-full">
        <GastosGenerales navigate={navigate} />
      </div>
    </>
  );
};

export default GastosView;