import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// Register every capture upload pipeline at startup so queued takes resume
// syncing on reconnect regardless of which screen the user reloaded onto.
import "@/lib/voice/captureUploaders";

createRoot(document.getElementById("root")!).render(<App />);
