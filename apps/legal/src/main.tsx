import { render } from "solid-js/web";
import { App } from "./App";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Legal application root is missing.");

render(() => <App />, root);
