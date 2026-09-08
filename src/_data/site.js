import { readFileSync } from "node:fs";
export default JSON.parse(readFileSync("content/site.json", "utf8"));
