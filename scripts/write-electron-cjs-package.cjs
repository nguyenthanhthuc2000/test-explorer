const fs = require("node:fs");
const path = require("node:path");

const outDir = path.resolve(process.cwd(), "dist/electron");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "package.json"),
  JSON.stringify({ type: "commonjs" }, null, 2) + "\n",
  "utf8"
);

console.log("Wrote dist/electron/package.json (type=commonjs)");

