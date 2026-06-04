import { gzipSync } from "node:zlib";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const distAssetsDir = join(process.cwd(), "dist", "assets");

const budgets = {
  mainJsRaw: 340_000,
  mainJsGzip: 110_000,
  cssRaw: 90_000,
  cssGzip: 18_000,
  routeChunkRaw: 16_000,
};

const formatKb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;

if (!existsSync(distAssetsDir)) {
  console.error("Missing dist/assets. Run `npm run build` before `npm run perf:budget`.");
  process.exit(1);
}

const files = readdirSync(distAssetsDir)
  .map((name) => {
    const path = join(distAssetsDir, name);
    const raw = statSync(path).size;
    const gzip = gzipSync(readFileSync(path)).length;
    return { name, path, raw, gzip };
  })
  .filter((file) => file.name.endsWith(".js") || file.name.endsWith(".css"));

const mainJs = files.find((file) => /^index-.*\.js$/.test(file.name));
const mainCss = files.find((file) => /^index-.*\.css$/.test(file.name));
const routeChunks = files.filter(
  (file) => file.name.endsWith(".js") && file.name !== mainJs?.name,
);

const failures = [];

const check = (label, actual, max) => {
  if (actual > max) {
    failures.push(`${label}: ${formatKb(actual)} exceeds ${formatKb(max)}`);
  }
};

if (!mainJs) {
  failures.push("Missing main JS chunk matching index-*.js");
} else {
  check("Main JS raw", mainJs.raw, budgets.mainJsRaw);
  check("Main JS gzip", mainJs.gzip, budgets.mainJsGzip);
}

if (!mainCss) {
  failures.push("Missing main CSS chunk matching index-*.css");
} else {
  check("Main CSS raw", mainCss.raw, budgets.cssRaw);
  check("Main CSS gzip", mainCss.gzip, budgets.cssGzip);
}

for (const chunk of routeChunks) {
  check(`Route chunk ${chunk.name}`, chunk.raw, budgets.routeChunkRaw);
}

console.log("Bundle budget report");
console.log("--------------------");
if (mainJs) {
  console.log(`Main JS:  ${formatKb(mainJs.raw)} raw, ${formatKb(mainJs.gzip)} gzip`);
}
if (mainCss) {
  console.log(`Main CSS: ${formatKb(mainCss.raw)} raw, ${formatKb(mainCss.gzip)} gzip`);
}
console.log(`Route chunks checked: ${routeChunks.length}`);
console.log(
  `Largest route chunk: ${
    routeChunks.length
      ? routeChunks
          .slice()
          .sort((a, b) => b.raw - a.raw)
          .slice(0, 1)
          .map((chunk) => `${chunk.name} at ${formatKb(chunk.raw)} raw`)
          .join("")
      : "none"
  }`,
);

if (failures.length > 0) {
  console.error("\nBudget failures:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("\nAll bundle budgets passed.");
