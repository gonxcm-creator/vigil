import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      suppressHydrationWarning
      className={cn(
        "flex h-11 w-full rounded-md bg-secondary px-3 text-sm text-foreground shadow-[0_0_0_1px_rgb(255_255_255_/_0.08)] transition-[box-shadow] duration-150 placeholder:text-muted-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_rgb(237_233_224_/_0.55)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
