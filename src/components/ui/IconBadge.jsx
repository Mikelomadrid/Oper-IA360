import React from 'react';
import { cn } from '@/lib/utils';

const IconBadge = ({ icon: Icon, className, iconClassName, ariaLabel }) => {
  return (
    <div className={cn("flex h-9 w-9 items-center justify-center rounded-md", className)}>
      {Icon && (
        <Icon
          className={cn("h-5 w-5 text-white", iconClassName)}
          strokeWidth={2}
          aria-label={ariaLabel}
        />
      )}
    </div>
  );
};

export default IconBadge;