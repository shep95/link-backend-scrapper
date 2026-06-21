import { refresh, render } from "./ui.js";

render();
void refresh();
setInterval(() => void refresh(), 8000);
