import React from 'react';

const LayoutSafeEmpty = ({ children }) => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
};

export default LayoutSafeEmpty;