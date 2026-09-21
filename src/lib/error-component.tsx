import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

const FALLBACK_MESSAGE = "La llama se apagó. Recarga la noche.";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_MESSAGE;
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center text-foreground">
      <span className="text-destructive" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="font-display text-2xl tracking-tight">La llama se apagó</h1>
      <p className="max-w-md text-sm break-words text-muted-foreground">{errorMessage(error)}</p>
      <button
        type="button"
        className="mt-2 h-11 rounded-md bg-primary px-5 text-sm text-primary-foreground"
        onClick={() => window.location.reload()}
      >
        Reintentar
      </button>
    </main>
  );
}
