// button.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const base = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50 select-none";
    const variants = {
      default: "bg-zinc-100 text-zinc-900 shadow hover:bg-zinc-200",
      secondary: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
      outline: "border border-zinc-800 bg-transparent hover:bg-zinc-800 hover:text-zinc-100 text-zinc-300",
      ghost: "hover:bg-zinc-800 hover:text-zinc-100 text-zinc-400",
      destructive: "bg-rose-600 text-white hover:bg-rose-700",
    };
    const sizes = {
      default: "h-8 px-3 py-1.5",
      sm: "h-7 rounded px-2 text-xs",
      lg: "h-10 rounded-md px-5 text-sm",
      icon: "h-8 w-8",
    };
    return (
      <button
        className={cn(base, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
