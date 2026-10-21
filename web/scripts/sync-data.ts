import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildCatalogFile } from "../src/lib/data/build";

const sourcePath = path.resolve(import.meta.dirname, "../../data/curated_drugs.json");
const targetPath = path.resolve(import.meta.dirname, "../src/data/catalog.json");
const raw: unknown = JSON.parse(readFileSync(sourcePath, "utf8"));
const built = buildCatalogFile(raw, "production");

if (!built.ok) {
  process.stderr.write(`${built.problems.join("\n")}\n`);
  process.exit(1);
}

mkdirSync(path.dirname(targetPath), { recursive: true });
writeFileSync(targetPath, `${JSON.stringify(built.file, null, 2)}\n`);
process.stdout.write(
  `Wrote ${built.file.records.length} records to web/src/data/catalog.json (${built.file.contentSha256})\n`,
);
