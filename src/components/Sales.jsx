import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

const Sales = () => {
  return (
    <div className="p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold gradient-text mb-2">Gestión de Ventas</h1>
            <p className="text-gray-400">Registra y administra tus ventas</p>
          </div>
          <Button
            onClick={() => toast({
              title: '🚧 Módulo en desarrollo',
              description: '¡Avísame cuando tengas lista la estructura de Supabase y lo conectamos! 🚀'
            })}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva Venta
          </Button>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-effect rounded-2xl p-12 text-center"
        >
          <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-bold mb-2">Módulo de Ventas</h3>
          <p className="text-gray-400 mb-6">
            Este módulo estará listo cuando conectemos con Supabase.<br />
            ¡Avísame cuando tengas las tablas preparadas!
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Sales;