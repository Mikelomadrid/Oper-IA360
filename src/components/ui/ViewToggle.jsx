import React from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ViewToggle({ viewMode, setViewMode, className }) {
  return (
    <div className={`flex items-center gap-1 bg-muted/50 p-1 rounded-lg border shadow-sm ${className}`}>
      <Button
        variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
        size="sm"
        className={`h-8 w-8 p-0 transition-all ${viewMode === 'grid' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
        onClick={() => setViewMode('grid')}
        title="Vista Cuadrícula"
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
      <Button
        variant={viewMode === 'list' ? 'secondary' : 'ghost'}
        size="sm"
        className={`h-8 w-8 p-0 transition-all ${viewMode === 'list' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
        onClick={() => setViewMode('list')}
        title="Vista Lista"
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  );
}