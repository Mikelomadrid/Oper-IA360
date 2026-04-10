import React from 'react';
import { cn } from '@/lib/utils';

export const NotificationBadge = ({ count, children, className, variant = 'destructive', ...props }) => {
  const showBadge = count > 0;

  // Customized as per requirements: Red #ef4444, white text
  const baseClasses = "bg-[#ef4444] text-white"; 

  const colorClasses = {
    destructive: baseClasses,
    primary: "bg-primary text-primary-foreground",
    secondary: "bg-blue-600 text-white", 
    outline: "border-2 border-background bg-muted text-muted-foreground",
  };

  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      {children}
      {showBadge && (
        <span
          className={cn(
            "absolute -top-2.5 -right-2.5 z-50 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-xs font-bold shadow-md ring-2 ring-background animate-in zoom-in duration-300",
            colorClasses[variant] || colorClasses.destructive,
            className
          )}
          {...props}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </div>
  );
};