import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-md bg-secondary px-3 py-2.5 text-sm text-foreground shadow-[0_0_0_1px_rgb(255_255_255_/_0.08)] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:shadow-[0_0_0_1px_rgb(237_233_224_/_0.55)] disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
