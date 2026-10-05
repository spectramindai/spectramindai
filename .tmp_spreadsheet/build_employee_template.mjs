import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const projectOutput = "/Users/sujan/tsaro_labs-vanta/spectramind/public/templates/employee-import-template.xlsx";
const finalOutput = "/Users/sujan/.codex/visualizations/2026/07/16/019f691b-3b09-7b73-aa0d-1960db5525e4/outputs/employee-import/employee-import-template.xlsx";
const previewOutput = "/Users/sujan/.codex/visualizations/2026/07/16/019f691b-3b09-7b73-aa0d-1960db5525e4/outputs/employee-import/employee-import-template.png";

const workbook = Workbook.create();
const employees = workbook.worksheets.add("Employees");
employees.showGridLines = false;
employees.getRange("A1:H1").values = [["Full Name", "Email", "System Role", "Employee Type", "Portal Access", "Start Date", "End Date", "Tags"]];
employees.getRange("A2:H2").values = [["Alex Morgan", "alex@company.com", "User", "Full-Time", "Yes", new Date("2026-07-16T00:00:00Z"), new Date("2027-07-16T00:00:00Z"), "All Staff, Engineering"]];
employees.getRange("A1:H1").format = { fill: "#1D4ED8", font: { bold: true, color: "#FFFFFF" }, rowHeight: 28, verticalAlignment: "center" };
employees.getRange("A2:H2").format = { fill: "#FFFFFF", font: { color: "#334155" }, borders: { insideHorizontal: { style: "thin", color: "#E2E8F0" } }, rowHeight: 23 };
employees.getRange("F2:G2").format.numberFormat = "yyyy-mm-dd";
employees.getRange("A:A").format.columnWidth = 22;
employees.getRange("B:B").format.columnWidth = 30;
employees.getRange("C:E").format.columnWidth = 18;
employees.getRange("F:G").format.columnWidth = 15;
employees.getRange("H:H").format.columnWidth = 28;
employees.freezePanes.freezeRows(1);
employees.tables.add("A1:H2", true, "EmployeeImportTable").style = "TableStyleMedium2";

const instructions = workbook.worksheets.add("Instructions");
instructions.showGridLines = false;
instructions.getRange("A1:D1").merge();
instructions.getRange("A1").values = [["SpectraMind Employee Import Template"]];
instructions.getRange("A1:D1").format = { fill: "#0F172A", font: { bold: true, color: "#FFFFFF", size: 16 }, rowHeight: 36, verticalAlignment: "center" };
instructions.getRange("A3:D11").values = [
  ["Column", "Required", "Accepted format", "Example"],
  ["Full Name", "Yes", "Text", "Alex Morgan"],
  ["Email", "Yes", "Valid unique email; case-insensitive", "alex@company.com"],
  ["System Role", "No", "User, Manager, or Admin", "User"],
  ["Employee Type", "No", "Full-Time, Part-Time, or Contractor", "Full-Time"],
  ["Portal Access", "No", "Yes or No", "Yes"],
  ["Start Date", "No", "Excel date or YYYY-MM-DD", "2026-07-16"],
  ["End Date", "No", "Excel date or YYYY-MM-DD", ""],
  ["Tags", "No", "Comma-separated text", "All Staff, Engineering"],
];
instructions.getRange("A3:D3").format = { fill: "#DBEAFE", font: { bold: true, color: "#1E3A8A" }, rowHeight: 26 };
instructions.getRange("A4:D11").format = { borders: { insideHorizontal: { style: "thin", color: "#E2E8F0" } }, verticalAlignment: "center", wrapText: true };
instructions.getRange("A13:D14").merge(true);
instructions.getRange("A13:D14").values = [["How to use"], ["Keep the header names unchanged. Delete the example row, enter employees from row 2 onward, save as .xlsx, then upload it from Employees → Import Excel. Rows are previewed and validated before anything is added."]];
instructions.getRange("A13:D13").format = { fill: "#FEF3C7", font: { bold: true, color: "#92400E" }, rowHeight: 25 };
instructions.getRange("A14:D14").format = { fill: "#FFFBEB", font: { color: "#78350F" }, wrapText: true, rowHeight: 52, verticalAlignment: "center" };
instructions.getRange("A:A").format.columnWidth = 20;
instructions.getRange("B:B").format.columnWidth = 13;
instructions.getRange("C:C").format.columnWidth = 38;
instructions.getRange("D:D").format.columnWidth = 28;
instructions.freezePanes.freezeRows(3);

await fs.mkdir(new URL(".", `file://${projectOutput}`).pathname, { recursive: true });
await fs.mkdir(new URL(".", `file://${finalOutput}`).pathname, { recursive: true });
const preview = await workbook.render({ sheetName: "Instructions", range: "A1:D14", scale: 1.5, format: "png" });
await fs.writeFile(previewOutput, new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(projectOutput);
await output.save(finalOutput);

const inspect = await workbook.inspect({ kind: "table", range: "Employees!A1:H5", include: "values,formulas", tableMaxRows: 5, tableMaxCols: 8 });
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 50 }, summary: "formula error scan" });
console.log(inspect.ndjson);
console.log(errors.ndjson);
