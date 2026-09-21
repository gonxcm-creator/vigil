import { Toaster as Sonner } from "sonner";

function Toaster() {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast bg-card text-card-foreground shadow-[0_0_0_1px_rgb(255_255_255_/_0.08)]",
        },
      }}
    />
  );
}

export { Toaster };
