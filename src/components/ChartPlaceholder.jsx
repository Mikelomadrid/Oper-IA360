import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';

const ChartPlaceholder = ({ title }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-effect rounded-2xl p-6"
    >
      <h3 className="text-xl font-bold mb-4">{title}</h3>
      <div className="h-64 flex items-center justify-center border-2 border-dashed border-white/10 rounded-xl">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p className="text-gray-400">Gráfico disponible con datos de Supabase</p>
        </div>
      </div>
    </motion.div>
  );
};

export default ChartPlaceholder;