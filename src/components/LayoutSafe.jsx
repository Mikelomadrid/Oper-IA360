import React from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';

const LayoutSafe = ({ children }) => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </div>
  );
};

export default LayoutSafe;