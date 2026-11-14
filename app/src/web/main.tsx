/** Explorer entry point: mount the React app over the static document shell. */

import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { queryClient } from "./lib/queryClient";

const container = document.body;
createRoot(container).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
