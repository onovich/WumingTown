import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./tools/ts-extension-loader.mjs", pathToFileURL("./"));
