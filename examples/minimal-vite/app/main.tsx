import { createRoot } from "react-dom/client";
import AppLayout from "../components/chat/app-layout";
import "./style.css";
const root = document.getElementById("root");
if (!root) throw Error("Missing application root");
createRoot(root).render(<AppLayout />);
