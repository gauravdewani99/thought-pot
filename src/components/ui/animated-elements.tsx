import { cn } from "@/lib/utils";

interface AnimatedOrbProps {
  className?: string;
  variant?: "primary" | "secondary" | "accent";
  size?: "sm" | "md" | "lg";
  style?: React.CSSProperties;
}

export const AnimatedOrb = ({ 
  className, 
  variant = "primary", 
  size = "md",
  style 
}: AnimatedOrbProps) => {
  const sizeClasses = {
    sm: "w-32 h-32",
    md: "w-48 h-48", 
    lg: "w-64 h-64"
  };

  const variantClasses = {
    primary: "bg-gradient-primary",
    secondary: "bg-gradient-secondary", 
    accent: "bg-gradient-accent"
  };

  return (
    <div 
      className={cn(
        "absolute rounded-full blur-3xl opacity-20 animate-float",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      style={{
        animation: "float 6s ease-in-out infinite",
        ...style
      }}
    />
  );
};

export const ShimmerEffect = ({ className }: { className?: string }) => {
  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
};