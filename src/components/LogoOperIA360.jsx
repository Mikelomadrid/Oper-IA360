import React from 'react';
import { cn } from '@/lib/utils';
const LogoOperIA360 = ({
  className,
  size = 'md'
}) => {
  return <div className={cn("flex items-center font-bold text-primary gap-2", className)}>
      <div className="flex items-center justify-center bg-primary text-primary-foreground rounded-md w-8 h-8">
        O
      </div>
      <span className={cn("hidden md:inline-block", size === 'lg' ? 'text-xl' : 'text-lg')}>OrkaLED</span>
    </div>;
};
export default LogoOperIA360;