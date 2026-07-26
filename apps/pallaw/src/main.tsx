import "./styles.css";
import { render } from "solid-js/web";
import { createLocalDraftAdapter } from "./document/local-draft-adapter";
import { createPalLawDocument } from "./document/create-pallaw-document";
import { App } from "./ui/App";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("PalLaw application root is missing.");

const persistence = createLocalDraftAdapter(window.localStorage, "pallaw.studio.v1");
const editorDocument = createPalLawDocument(persistence);
render(() => <App editorDocument={editorDocument} />, root);
