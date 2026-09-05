// Rebuild the checked-in, CDN-free NiiVue module from the exact npm lock.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { esm } from "../node_modules/@niivue/niivue/dist/index.min.js";
const root = "src/dicom_workbench/web/nifti-assets/";
const pkg = JSON.parse(
  await readFile("node_modules/@niivue/niivue/package.json", "utf8"),
);
if (pkg.version !== "0.69.0") throw Error("Unexpected viewer version");
const data = decodeURIComponent(esm);
await writeFile(root + "niivue-0.69.0.js", data);
await writeFile(
  root + "vendor.json",
  JSON.stringify(
    {
      package: "@niivue/niivue",
      version: pkg.version,
      commit: "53d450fe2e43c40c0d4ad6a2d8dc08ee37575f8c",
      sha256: createHash("sha256").update(data).digest("hex"),
      preparation:
        "decodeURIComponent of the npm dist/index.min.js esm export; no CDN imports",
    },
    null,
    2,
  ) + "\n",
);
