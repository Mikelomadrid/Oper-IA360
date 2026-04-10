import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle2, HardHat } from 'lucide-react';
import { cn } from '@/lib/utils';

const borderColors = {
  "text-blue-500": "border-l-blue-500",
  "text-orange-500": "border-l-orange-500",
  "text-purple-500": "border-l-purple-500",
  "text-teal-500": "border-l-teal-500",
  "text-emerald-500": "border-l-emerald-500",
  "text-red-500": "border-l-red-500",
  "text-indigo-500": "border-l-indigo-500",
  "text-amber-500": "border-l-amber-500",
};

const DashboardCard = ({
  title,
  count,
  icon: Icon,
  color = "text-primary",
  bgColor = "bg-primary/10",
  onClick,
  isSeen = false,
  // description prop is ignored in this compact version
}) => {
  const isZero = count === 0;
  const isOK = isZero || isSeen;
  const borderColorClass = borderColors[color] || "border-l-primary";

  return (
    <Card
      className={cn(
        "flex flex-col transition-all duration-300 hover:shadow-md cursor-pointer border-l-4",
        isOK ? "border-l-green-500 opacity-80 hover:opacity-100" : borderColorClass
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate pr-2">
          {title}
        </CardTitle>
        <div className={cn("p-1.5 rounded-full shrink-0", isOK ? "bg-green-100 text-green-600" : bgColor)}>
          <Icon className={cn("h-3.5 w-3.5", isOK ? "text-green-600" : color)} />
        </div>
      </CardHeader>

      <CardContent className="flex-1 px-3 py-2 flex flex-col justify-center min-h-[50px]">
        {isZero ? (
          <div className="flex items-center gap-2" title="Buen Trabajo!">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <span className="text-xs font-bold text-green-700 truncate">
              Buen Trabajo!
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className={cn("text-2xl font-bold leading-none", isSeen ? "text-green-600" : "")}>
              {count}
            </div>
            <div className={cn("flex items-center gap-1.5", isSeen ? "text-green-600" : "text-red-600")} title={isSeen ? "Revisado (OK)" : "Aquí tienes Trabajo!"}>
              {isSeen ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <HardHat className="h-4 w-4 shrink-0" />}
              <span className="text-xs font-bold truncate">
                {isSeen ? "Revisado (OK)" : "Aquí tienes Trabajo!"}
              </span>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="p-3 pt-0">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between hover:bg-transparent px-0 text-[10px] h-6 text-muted-foreground hover:text-foreground"
        >
          <span className={cn("font-medium", isOK ? "text-green-600" : "text-primary")}>
            {isZero ? "Ver historial" : "Gestionar ahora"}
          </span>
          <ArrowRight className={cn("h-3 w-3", isOK ? "text-green-600" : "text-primary")} />
        </Button>
      </CardFooter>
    </Card>
  );
};

export default DashboardCard;