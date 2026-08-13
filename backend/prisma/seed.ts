import { PrismaClient, type Prisma } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import "dotenv/config";

const prisma = new PrismaClient();
const root = resolve(process.cwd(), process.env.FRAMEWORK_LIBRARY_PATH ?? "../spectramind/src/core/framework-library");
const folders = ["soc2", "iso27001", "cmmc"];

for (const folder of folders) {
  const framework = JSON.parse(await readFile(resolve(root, folder, "framework.json"), "utf8"));
  const controlsFile = JSON.parse(await readFile(resolve(root, folder, "controls.json"), "utf8"));
  const id = framework.id;
  const slug = folder === "soc2" ? "soc-2" : folder === "iso27001" ? "iso-27001" : "cmmc";

  await prisma.framework.upsert({
    where: { id },
    create: { id, slug, name: framework.name, version: framework.version ?? "1", description: framework.description, metadata: framework as Prisma.InputJsonValue },
    update: { slug, name: framework.name, version: framework.version ?? "1", description: framework.description, metadata: framework as Prisma.InputJsonValue },
  });

  for (const control of controlsFile.controls ?? []) {
    const externalId = control.id ?? control.controlId;
    const title = control.title ?? control.controlRequirement ?? externalId;
    const category = control.category ?? control.controlFamily;
    const objective = control.objective ?? control.controlRequirement;
    const description = control.description ?? control.publicNotesUse;
    const { priority, guidance, ...metadata } = control;
    await prisma.control.upsert({
      where: { frameworkId_externalId: { frameworkId: id, externalId } },
      create: { frameworkId: id, externalId, title, category, objective, description, priority, guidance, metadata: metadata as Prisma.InputJsonValue },
      update: { title, category, objective, description, priority, guidance, metadata: metadata as Prisma.InputJsonValue },
    });
  }
  console.log(`Seeded ${id}: ${(controlsFile.controls ?? []).length} controls`);
}

await prisma.$disconnect();
