import { readFileSync } from "node:fs";
export default JSON.parse(readFileSync("content/about.json", "utf8"));
