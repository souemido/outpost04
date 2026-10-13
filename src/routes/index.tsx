import { createFileRoute } from "@tanstack/react-router";
import { LeakHome } from "@/components/leak/console";

export const Route = createFileRoute("/")({ component: LeakHome });
