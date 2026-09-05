import { begin, clear, configure, current, show, status } from "./nifti.js";
const $ = (id) => document.getElementById(id);
let raw = null,
  output = null,
  report = null,
  job = null,
  token;
async function request(route, body, signal) {
  if (!token) {
    const s = await fetch("./api/session", { signal });
    if (!s.ok) throw Error("Reload this page to start a new local session.");
    token = (await s.json()).token;
  }
  const r = await fetch(`./api/nifti/${route}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Workbench-Token": token,
    },
    body,
    signal,
  });
  if (!r.ok) {
    let message = "The volume could not be verified.";
    try {
      message = (await r.json()).error || message;
    } catch {}
    throw Error(message);
  }
  return r;
}
function buttons() {
  const ready =
    !!output && $("review-limit").checked && $("review-extension").checked;
  $("save-volume").disabled = !ready;
  $("save-report").disabled = !ready;
}
function forget() {
  raw = output = report = job = null;
  $("volume-file").value = "";
  $("review-limit").checked = $("review-extension").checked = false;
  $("header-findings").textContent = "";
  $("verification").textContent = "";
  $("clean").disabled = true;
  buttons();
}
async function load(bytes, info, g, signal) {
  const checked = await (await request("inspect", bytes, signal)).json();
  if (!current(g)) return;
  raw = bytes;
  report = checked.report;
  job = { g, signal };
  const ready = await show(bytes, { ...info, summary: checked.summary }, g);
  if (!current(g) || !ready) return;
  $("header-findings").textContent =
    `${report.text_fields_present.length} text fields contain data (${report.text_fields_present.join(", ") || "none"}); ${report.extensions_removed} extensions will be removed. ${checked.summary.dual_spaces ? "Two valid coordinate spaces will both be preserved." : ""}`;
  $("clean").disabled = false;
}
configure({ clear: forget, sample: load });
$("volume-file").onchange = async () => {
  const file = $("volume-file").files[0];
  if (!file) return;
  const { g, signal } = begin();
  try {
    if (file.size > 32 * 1024 * 1024)
      throw Error("Choose a file up to 32 MiB.");
    const bytes = await file.arrayBuffer();
    if (!current(g)) return;
    await load(
      bytes,
      {
        title: "Local 3D volume",
        notes:
          "The file's orientation determines the viewing directions. No anatomy or diagnosis is inferred from the filename.",
      },
      g,
      signal,
    );
  } catch (e) {
    if (current(g)) clear(e.message);
  }
};
$("clean").onclick = async () => {
  if (!raw || !job) return;
  const { g, signal } = job;
  output = null;
  buttons();
  $("clean").disabled = true;
  $("verification").textContent = "Rebuilding and reopening the saved volume…";
  try {
    const bytes = await (await request("clean", raw, signal)).arrayBuffer();
    if (!current(g)) return;
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    if (!current(g)) return;
    if (hash !== report.output_sha256)
      throw Error(
        "The returned file did not match the verified output. Export blocked.",
      );
    output = bytes;
    $("verification").textContent =
      "Header cleaned. Saved file reopened: voxel values, intensity scaling and orientation unchanged; text fields and extensions removed. Facial privacy remains unresolved.";
    status("Header checks passed. Read the review statements before saving.");
    buttons();
  } catch (e) {
    if (current(g)) clear(e.message);
  }
};
for (const id of ["review-limit", "review-extension"]) $(id).onchange = buttons;
function download(bytes, filename, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("save-volume").onclick = () => {
  if (output && !$("save-volume").disabled)
    download(output, "header-cleaned.nii", "application/octet-stream");
};
$("save-report").onclick = () => {
  if (output && !$("save-report").disabled)
    download(
      JSON.stringify(report, null, 2),
      "nifti-header-report.json",
      "application/json",
    );
};
