import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const EmployeeTaskView = () => {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Mis Tareas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Panel de tareas en construcción. Esperando instrucciones...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeTaskView;