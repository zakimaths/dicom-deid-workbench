import { begin, clear, clearComparison, configure, current, digest, setComparison, show, status, viewState } from "./nifti.js";
const $ = (id) => document.getElementById(id);
let raw = null,
  output = null,
  report = null,
  job = null,
  token;
let sourceInfo = null, brain = null, brainInfo = null, defaced = null, defaceReport = null, removal = null,
  defaceRevision = 0, defaceAbort = null, viewing = null, busy = false;
function defaceButtons() {
  const margin = Number($("margin").value);
  $("deface-run").disabled = busy || !raw || !brain || !$("review-mask").checked || !Number.isFinite(margin) || margin < 2 || margin > 20;
  $("review-deface").disabled = !defaced || viewing !== "after" || busy;
  const ready = !!defaced && viewing === "after" && !busy && $("review-deface").checked;
  for (const id of ["save-defaced", "save-removal", "save-deface-report"]) $(id).disabled = !ready;
}
function invalidateDeface() {
  defaceRevision++;
  defaceAbort?.abort(); defaceAbort = null;
  const hadComparison = !$("comparison").hidden;
  defaced = defaceReport = removal = viewing = null;
  busy = false;
  $("review-deface").checked = false;
  $("deface-status").textContent = "";
  $("inspect-comparison").hidden = true;
  clearComparison();
  defaceButtons();
  if (hadComparison && raw && job) {
    const { plane, crosshair, zoom } = viewState();
    show(raw, sourceInfo, job.g, { plane, crosshair, zoom }).then(ready => {
      if (ready) status("Inputs changed. The previous removal was discarded; prepare a new proposal.");
    });
  }
}
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
  sourceInfo = brain = brainInfo = null;
  invalidateDeface();
  $("brain-mask").value = "";
  $("mask-status").textContent = "No brain mask loaded.";
  $("review-mask").checked = false;
  $("margin").value = "5";
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
  sourceInfo = { ...info, summary: checked.summary };
  const ready = await show(bytes, sourceInfo, g);
  if (!current(g) || !ready) return;
  $("header-findings").textContent =
    `${report.text_fields_present.length} text fields contain data (${report.text_fields_present.join(", ") || "none"}); ${report.extensions_removed} extensions will be removed. ${checked.summary.dual_spaces ? "Two valid coordinate spaces will both be preserved." : ""}`;
  $("clean").disabled = false;
  defaceButtons();
}
configure({ clear: forget, sample: load,
  comparison: key => { viewing = key; defaceButtons(); },
  defaceSample: async (data, g, signal) => {
    await load(data.files.before.bytes, data, g, signal);
    if (!current(g) || !raw) return;
    brain = data.files.brain.bytes; brainInfo = data.files.brain;
    $("mask-status").textContent = "MNI atlas brain mask loaded. Check it against the anatomy before preparing removal.";
    await setComparison(data, g, "Prepared reference comparison. To compute your own proposal locally, review the supplied mask below, then choose Prepare removal & verify. This example leaves part of the atlas face region behind.");
    defaceButtons();
  }
});
$("brain-mask").onchange = async () => {
  const file = $("brain-mask").files[0];
  invalidateDeface(); brain = brainInfo = null;
  $("review-mask").checked = false;
  $("mask-status").textContent = "No brain mask loaded.";
  defaceButtons();
  if (!file || !job) return;
  const revision = defaceRevision, { g, signal } = job;
  try {
    if (file.size > 32 * 1024 * 1024) throw Error("Choose a mask up to 32 MiB.");
    const bytes = await file.arrayBuffer();
    const checked = await (await request("inspect", bytes, signal)).json();
    if (!current(g) || revision !== defaceRevision) return;
    brain = bytes; brainInfo = { summary: checked.summary };
    $("mask-status").textContent = "Mask file loaded. Binary values and grid alignment will be checked when preparing removal.";
    defaceButtons();
  } catch (e) {
    if (current(g) && revision === defaceRevision) $("mask-status").textContent = e.message;
  }
};
$("margin").oninput = invalidateDeface;
$("review-mask").onchange = invalidateDeface;
$("review-deface").onchange = defaceButtons;
$("inspect-comparison").onclick = e => { e.preventDefault(); $("compare-view").focus(); $("compare-view").scrollIntoView({ block: "center" }); };
$("deface-run").onclick = async () => {
  if ($("deface-run").disabled || !job) return;
  invalidateDeface();
  const revision = defaceRevision, { g, signal } = job;
  defaceAbort = new AbortController();
  const stop = () => defaceAbort?.abort();
  signal.addEventListener("abort", stop, { once: true });
  busy = true; defaceButtons();
  $("deface-status").textContent = "Preparing removal and checking the saved voxels…";
  const valid = () => current(g) && revision === defaceRevision;
  try {
    const body = new Uint8Array(16 + raw.byteLength + brain.byteLength);
    body.set([78, 68, 70, 49]);
    const header = new DataView(body.buffer);
    header.setUint32(4, raw.byteLength, true); header.setUint32(8, brain.byteLength, true);
    header.setFloat32(12, Number($("margin").value), true);
    body.set(new Uint8Array(raw), 16); body.set(new Uint8Array(brain), 16 + raw.byteLength);
    const response = await (await request("deface", body, defaceAbort.signal)).arrayBuffer();
    if (!valid()) return;
    if (response.byteLength < 16 || response.byteLength > 130 * 1024 * 1024) throw Error("Invalid removal response. Export blocked.");
    const h = new DataView(response), lengths = [4, 8, 12].map(i => h.getUint32(i, true));
    const [metaLength, outLength, maskLength] = lengths;
    if (h.getUint32(0, true) !== 0x3152444e || lengths.some(n => !n) || metaLength > 1024 * 1024 || outLength > 64 * 1024 * 1024 || maskLength > 64 * 1024 * 1024 || 16 + metaLength + outLength + maskLength !== response.byteLength) throw Error("Invalid removal response. Export blocked.");
    const meta = JSON.parse(new TextDecoder().decode(response.slice(16, 16 + metaLength)));
    const out = response.slice(16 + metaLength, 16 + metaLength + outLength);
    const mask = response.slice(16 + metaLength + outLength);
    if (await digest(out) !== meta.report.output_sha256 || await digest(mask) !== meta.report.removal_mask_sha256) throw Error("The returned files did not match their checks. Export blocked.");
    if (!valid()) return;
    defaced = out; removal = mask; defaceReport = meta.report;
    await setComparison({ ...sourceInfo, title: `${sourceInfo.title.split(" · ")[0]} · local removal proposal`, report: meta.report, files: {
      before: { bytes: raw, summary: sourceInfo.summary }, after: { bytes: out, summary: meta.summary },
      removal: { bytes: mask, summary: meta.mask_summary }, brain: { bytes: brain, summary: brainInfo.summary }
    } }, g, "Computed locally from the loaded volume and brain mask. These checks protect the supplied mask, not independently identified brain tissue. Review the after view before saving.");
    if (!valid()) return;
    $("deface-status").textContent = "Saved proposal reopened and verified. Select After removal and inspect all three directions before acknowledging the review.";
    $("inspect-comparison").hidden = false;
  } catch (e) {
    if (valid()) { defaced = removal = defaceReport = null; $("deface-status").textContent = e.message; }
  } finally {
    signal.removeEventListener("abort", stop);
    if (valid()) { busy = false; defaceButtons(); }
  }
};
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
$("save-defaced").onclick = () => { if (!$("save-defaced").disabled) download(defaced, "reviewed-removal-proposal.nii", "application/octet-stream"); };
$("save-removal").onclick = () => { if (!$("save-removal").disabled) download(removal, "removal-mask.nii", "application/octet-stream"); };
$("save-deface-report").onclick = () => { if (!$("save-deface-report").disabled) download(JSON.stringify(defaceReport, null, 2), "nifti-removal-report.json", "application/json"); };
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
