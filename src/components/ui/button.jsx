import { cn } from '@/lib/utils';
    import { Slot } from '@radix-ui/react-slot';
    import { cva } from 'class-variance-authority';
    import React from 'react';

    const buttonVariants = cva(
    	'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 transition-all duration-150 ease-in-out',
    	{
    		variants: {
    			variant: {
    				default: 'bg-primary text-primary-foreground shadow-[0_0_12px_-3px_hsl(var(--primary))] hover:shadow-[0_0_16px_-2px_hsl(var(--primary))] hover:-translate-y-px active:scale-98',
    				destructive:
              'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm active:scale-95',
    				outline:
              'border bg-transparent hover:bg-muted active:scale-95',
    				secondary:
              'bg-secondary text-secondary-foreground hover:bg-secondary/80 active:scale-95',
    				ghost: 'hover:bg-muted hover:text-muted-foreground',
    				link: 'text-primary underline-offset-4 hover:underline',
    			},
    			size: {
    				default: 'h-10 px-4 py-2',
    				sm: 'h-9 rounded-md px-3',
    				lg: 'h-11 rounded-lg px-8',
    				icon: 'h-10 w-10',
    			},
    		},
    		defaultVariants: {
    			variant: "default",
    			size: "default",
    		},
    	},
    );

    const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
    	const Comp = asChild ? Slot : 'button';
    	return (
    		<Comp
    			className={cn(buttonVariants({ variant, size, className }))}
    			ref={ref}
    			{...props}
    		/>
    	);
    });
    Button.displayName = 'Button';

    export { Button, buttonVariants };