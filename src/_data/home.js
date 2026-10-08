import { readFileSync } from "node:fs";
export default JSON.parse(readFileSync("content/home.json", "utf8"));
