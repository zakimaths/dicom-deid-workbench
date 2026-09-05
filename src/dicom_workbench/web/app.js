import { decode, rgba } from "./pixels.js";

const $ = (id) => document.getElementById(id);
let token, job, pixels, image, defaultCenter, defaultWidth;
let busy = false;
let generation = 0;
let expiry;

function status(message, error = false) {
  $("status").textContent = message;
  $("status").classList.toggle("error", error);
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "X-Workbench-Token": token, ...options.headers },
  });
  if (!response.ok) {
    let message =
      "The local service is unavailable. Restart it and reload this page.";
    try {
      message = (await response.json()).error || message;
    } catch {
      /* fixed fallback */
    }
    throw new Error(message);
  }
  return response;
}

function clearView() {
  clearTimeout(expiry);
  job = pixels = image = null;
  $("canvas").hidden = true;
  $("canvas").width = $("canvas").height = 1;
  $("empty").hidden = false;
  $("viewport-caption").hidden = $("sample-badge").hidden = true;
  $("image-title").textContent = "No image loaded";
  $("image-details").textContent =
    "Contrast controls affect the preview. Exported pixels stay unchanged.";
  $("changed-count").textContent = $("kept-count").textContent = "—";
  $("changes").replaceChildren(
    Object.assign(document.createElement("p"), {
      className: "muted",
      textContent:
        "The report will list field names and actions. Original values are never included.",
    }),
  );
  $("integrity-title").textContent = "Output checks";
  $("integrity-copy").textContent =
    "Pixel preservation and file reopen checks run after processing.";
  $("integrity-icon").textContent = "○";
  $("ack").checked = false;
  for (const id of [
    "center",
    "width",
    "reset",
    "clear",
    "ack",
    "download",
    "report",
  ])
    $(id).disabled = true;
  $("center-value").textContent = $("width-value").textContent = "—";
}

function render() {
  if (!pixels) return;
  const center = Number($("center").value),
    width = Number($("width").value);
  const canvas = $("canvas");
  canvas
    .getContext("2d")
    .putImageData(
      new ImageData(
        rgba(pixels, center, width, image.invert),
        image.columns,
        image.rows,
      ),
      0,
      0,
    );
  $("center-value").textContent = String(center);
  $("width-value").textContent = String(width);
}

function present(result, buffer) {
  job = result.job;
  image = result.image;
  pixels = decode(buffer, image);
  let low = Infinity,
    high = -Infinity;
  for (const value of pixels) {
    low = Math.min(low, value);
    high = Math.max(high, value);
  }
  defaultCenter = image.center ?? (low + high + 1) / 2;
  defaultWidth = image.width ?? Math.max(1, high - low + 1);
  $("center").min = Math.floor(Math.min(low, defaultCenter));
  $("center").max = Math.ceil(Math.max(high, defaultCenter, low + 1));
  $("center").step = "any";
  $("width").min = "1";
  $("width").max = Math.ceil(Math.max(high - low + 1, defaultWidth, 2));
  $("width").step = "any";
  $("center").value = defaultCenter;
  $("width").value = defaultWidth;
  $("canvas").width = image.columns;
  $("canvas").height = image.rows;
  const aspect =
    (image.columns * image.spacing[1]) / (image.rows * image.spacing[0]);
  // Physical aspect, not just matrix dimensions. CSS object-fit must not override it.
  $("canvas").style.aspectRatio = String(aspect);
  $("canvas").style.objectFit = "fill";
  fitCanvas();
  $("canvas").hidden = false;
  $("empty").hidden = true;
  $("viewport-caption").hidden = false;
  $("sample-badge").hidden = !result.synthetic;
  $("image-title").textContent = result.synthetic
    ? "Geometric CT phantom"
    : `${image.modality} · imported image`;
  $("image-details").textContent =
    `${image.columns} × ${image.rows} · 16-bit ${image.signed ? "signed" : "unsigned"} · ${image.modality} · ${result.synthetic ? "Generated geometry. No patient data." : "Pixels and anatomy not assessed."}`;
  const counts = result.report.counts;
  $("changed-count").textContent =
    counts.removed + counts.emptied + counts.replaced;
  $("kept-count").textContent = counts.kept;
  $("changes").replaceChildren();
  const labels = {
    removed: "Removed",
    emptied: "Emptied",
    replaced: "Replaced",
  };
  for (const action of result.report.actions.filter(
    (a) => a.action !== "kept",
  )) {
    const row = document.createElement("div");
    row.className = "change-row";
    const left = document.createElement("div");
    const name = document.createElement("span");
    name.textContent = action.field;
    const tag = document.createElement("small");
    tag.textContent = action.tag;
    left.append(name, tag);
    const badge = document.createElement("span");
    badge.className = "action";
    badge.textContent = labels[action.action];
    row.append(left, badge);
    $("changes").append(row);
  }
  $("integrity-title").textContent = "Pixel bytes preserved";
  $("integrity-copy").textContent =
    "Export reopened successfully. File metadata rebuilt; preamble cleared. Pixels not assessed for identity.";
  $("integrity-icon").textContent = "✓";
  for (const id of ["center", "width", "reset", "clear", "ack", "report"])
    $(id).disabled = false;
  render();
  expiry = setTimeout(() => {
    clearView();
    status("The temporary image expired. Import it again to continue.");
  }, 600000);
}

function fitCanvas() {
  if (!image) return;
  const ratio =
    (image.columns * image.spacing[1]) / (image.rows * image.spacing[0]);
  const availableWidth = $("viewport").clientWidth * 0.86,
    availableHeight = $("viewport").clientHeight * 0.86;
  const width = Math.min(availableWidth, availableHeight * ratio);
  $("canvas").style.width = `${width}px`;
  $("canvas").style.height = `${width / ratio}px`;
}
new ResizeObserver(fitCanvas).observe($("viewport"));

async function load(file) {
  if (busy) return;
  busy = true;
  const current = ++generation;
  clearView();
  $("demo").disabled = $("file").disabled = true;
  status(
    file ? "Scrubbing supported metadata…" : "Generating a synthetic example…",
  );
  try {
    if (file && file.size > 8 * 1024 * 1024) {
      await request("/api/clear", { method: "POST" });
      throw new Error("This version accepts files up to 8 MiB.");
    }
    const response = await request(file ? "/api/process" : "/api/demo", {
      method: "POST",
      ...(file
        ? { body: file, headers: { "Content-Type": "application/dicom" } }
        : {}),
    });
    const result = await response.json();
    const raw = await (
      await request(`/api/jobs/${result.job}/pixels`)
    ).arrayBuffer();
    if (current !== generation) return;
    present(result, raw);
    status(
      "Metadata scrubbed. Review the changes and the export notice below.",
    );
  } catch (error) {
    clearView();
    status(error.message || "Unable to connect to the local service.", true);
  } finally {
    busy = false;
    $("demo").disabled = $("file").disabled = false;
    $("file").value = "";
  }
}

async function download(kind, name) {
  if (!job) return;
  try {
    const blob = await (await request(`/api/jobs/${job}/${kind}`)).blob();
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    status(error.message, true);
  }
}

$("demo").addEventListener("click", () => load());
$("file").addEventListener("change", (event) => {
  if (event.target.files[0]) load(event.target.files[0]);
});
for (const id of ["center", "width"]) $(id).addEventListener("input", render);
$("reset").addEventListener("click", () => {
  $("center").value = defaultCenter;
  $("width").value = defaultWidth;
  render();
});
$("ack").addEventListener("change", () => {
  $("download").disabled = !$("ack").checked || !job;
});
$("download").addEventListener("click", () =>
  download("dicom", "metadata-scrubbed.dcm"),
);
$("report").addEventListener("click", () =>
  download("report", "metadata-report.json"),
);
$("clear").addEventListener("click", async () => {
  ++generation;
  clearView();
  try {
    await request("/api/clear", { method: "POST" });
    status("Image cleared. Load another file or try the example.");
  } catch {
    status(
      "The local service could not confirm clearing. Stop it to release its temporary result.",
      true,
    );
  }
});
for (const event of ["dragenter", "dragover"])
  $("dropzone").addEventListener(event, (e) => {
    e.preventDefault();
    $("dropzone").classList.add("dragover");
  });
for (const event of ["dragleave", "drop"])
  $("dropzone").addEventListener(event, (e) => {
    e.preventDefault();
    $("dropzone").classList.remove("dragover");
  });
$("dropzone").addEventListener("drop", (e) => {
  if (e.dataTransfer.files[0]) load(e.dataTransfer.files[0]);
});
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => e.preventDefault());
$("demo").disabled = $("file").disabled = true;
fetch("/api/session")
  .then((r) => {
    if (!r.ok) throw new Error();
    return r.json();
  })
  .then((session) => {
    token = session.token;
    $("demo").disabled = $("file").disabled = false;
  })
  .catch(() =>
    status(
      "Cannot connect to the local service. Restart it and reload this page.",
      true,
    ),
  );
