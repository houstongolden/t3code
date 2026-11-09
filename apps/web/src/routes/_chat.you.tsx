import { createFileRoute } from "@tanstack/react-router";

import { YouMemoryPage } from "../components/you/YouMemoryPage";

export const Route = createFileRoute("/_chat/you")({
  component: YouMemoryPage,
});
