import { createFileRoute } from "@tanstack/react-router";
import { VigilApp } from "@/components/vigil/vigil-app";

export const Route = createFileRoute("/")({ component: VigilApp });
