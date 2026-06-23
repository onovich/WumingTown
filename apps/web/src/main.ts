/// <reference lib="dom" />

import { mountWebClientShell } from "./shell-bootstrap";

const rootElement = document.getElementById("app");

if (!(rootElement instanceof HTMLElement)) {
  throw new Error("Expected #app root element for the Wuming Town web shell.");
}

void mountWebClientShell(rootElement);
