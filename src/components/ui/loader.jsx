import React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const loaderVariants = cva('animate-spin text-primary', {
  variants: {
    size: {
      sm: 'h-4 w-4',
      md: 'h-8 w-8',
      lg: 'h-12 w-12',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

const Loader = ({ className, size, ...props }) => {
  return (
    <Loader2 className={cn(loaderVariants({ size }), className)} {...props} />
  );
};

const FullPageLoader = ({ message = 'Cargando...' }) => (
  <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
    <Loader size="lg" />
    {message && <p className="mt-4 text-lg font-semibold text-foreground">{message}</p>}
  </div>
);

export { Loader, FullPageLoader, loaderVariants };