/** Explorer entry point: mount the React app over the static document shell. */

import { createRoot } from "react-dom/client";
import { App } from "./App";

const container = document.body;
createRoot(container).render(<App />);
