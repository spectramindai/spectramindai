import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "../../config.js";

const folderByFramework: Record<string, string> = {
  "soc2-type-ii": "soc2", "iso27001-2022": "iso27001", "cmmc-level-2": "cmmc",
};

export async function readFrameworkCollection(frameworkId: string, file: string, property: string) {
  const folder = folderByFramework[frameworkId];
  if (!folder) throw Object.assign(new Error("Framework library not found"), { statusCode: 404 });
  const document = JSON.parse(await readFile(resolve(process.cwd(), config.FRAMEWORK_LIBRARY_PATH, folder, file), "utf8"));
  return Array.isArray(document[property]) ? document[property] : [];
}
