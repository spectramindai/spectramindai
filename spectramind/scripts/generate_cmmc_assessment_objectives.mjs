import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const libraryRoot = resolve(projectRoot, "src/core/framework-library/cmmc");
const csvPath = resolve(libraryRoot, "sp800-171a-assessment-procedures.csv");
const controlsPath = resolve(libraryRoot, "controls.json");
const outputPath = resolve(libraryRoot, "assessment-objectives.json");

const controlsData = JSON.parse(await readFile(controlsPath, "utf8"));
const rows = parseCsv(await readFile(csvPath, "utf8"));
const controlByRequirement = new Map(
  controlsData.controls.map((control) => [control.id.match(/(\d+\.\d+\.\d+)$/)?.[1], control])
);
const requirements = new Map();
const unletteredObjectives = new Map();

for (const row of rows) {
  const identifier = String(row.Identifier || "").replace(/\s+/g, "");
  const unletteredMatch = identifier.match(/^(\d+\.\d+\.\d+)$/);
  if (unletteredMatch && row["Assessment Objective"]) {
    unletteredObjectives.set(
      unletteredMatch[1],
      String(row["Assessment Objective"]).replace(/^\s*Determine\s+if:?\s*/i, "").trim()
    );
  }
  const objectiveMatch = identifier.match(/^(\d+\.\d+\.\d+)\.?\[([^\]]+)\]$/);
  if (!objectiveMatch) continue;
  const [, requirementNumber, objectiveId] = objectiveMatch;
  const control = controlByRequirement.get(requirementNumber);
  if (!control) continue;

  const current = requirements.get(control.id) || {
    requirementId: control.id,
    requirementNumber,
    objectives: [],
  };
  current.objectives.push({
    id: objectiveId.toLowerCase(),
    identifier: `[${objectiveId.toLowerCase()}]`,
    text: String(row["Assessment Objective"] || "").replace(/^\s+|\s+$/g, ""),
  });
  requirements.set(control.id, current);
}

for (const [requirementNumber, text] of unletteredObjectives) {
  const control = controlByRequirement.get(requirementNumber);
  if (!control || requirements.has(control.id)) continue;
  requirements.set(control.id, {
    requirementId: control.id,
    requirementNumber,
    objectives: [{ id: "requirement", identifier: "", text }],
  });
}

const result = {
  source: {
    cmmcGuide: "CMMC Assessment Guide – Level 2, Version 2.13 (September 2024)",
    cmmcGuideUrl: "https://dodcio.defense.gov/Portals/0/Documents/CMMC/AssessmentGuideL2v2.pdf",
    objectiveDataset: "NIST SP 800-171A Assessment Procedures CSV",
    objectiveDatasetUrl: "https://csrc.nist.gov/csrc/media/Publications/sp/800-171a/final/documents/sp800-171A-assessment-procedures.csv",
    note: "CMMC Level 2 assessment objectives are the NIST SP 800-171A assessment objectives identified by requirement and bracketed objective identifier.",
  },
  requirements: [...requirements.values()],
};

if (result.requirements.length !== controlsData.controls.length) {
  const missing = controlsData.controls
    .map((control) => control.id)
    .filter((controlId) => !requirements.has(controlId));
  console.error(`Missing objective data for: ${missing.join(", ")}`);
  throw new Error(`Expected ${controlsData.controls.length} requirements, generated ${result.requirements.length}.`);
}
if (result.requirements.some((requirement) => !requirement.objectives.length || requirement.objectives.some((objective) => !objective.text))) {
  throw new Error("Every CMMC requirement must have at least one non-empty assessment objective.");
}

await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(`Generated ${result.requirements.length} requirements and ${result.requirements.reduce((sum, item) => sum + item.objectives.length, 0)} objectives.`);

function parseCsv(value) {
  const records = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '"') {
      if (quoted && value[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && value[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.length)) records.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    records.push(row);
  }
  const [headers, ...data] = records;
  return data.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])));
}
