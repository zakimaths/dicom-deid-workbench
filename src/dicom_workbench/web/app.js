import { decode, rgba } from "./pixels.js";

const $ = (id) => document.getElementById(id);
let token, job, pixels, image, defaultCenter, defaultWidth;
let regions = [],
  marking = false,
  dragStart = null,
  edited = false,
  sourceLabel = {};
let busy = false;
let generation = 0;
let expiry;
let viewRevision = 0;
const sampleKinds = ["ct", "mr", "ct-a", "ct-b", "mr-a", "mr-b"];
const importControls = [
  "demo",
  "file",
  "text-exercise",
  ...sampleKinds.map((k) => `sample-${k}`),
];

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
    throw Object.assign(new Error(message), { status: response.status });
  }
  return response;
}

function clearView() {
  ++viewRevision;
  clearTimeout(expiry);
  regions = [];
  dragStart = null;
  marking = false;
  edited = false;
  job = pixels = image = null;
  syncRegions();
  $("canvas").hidden = true;
  $("canvas").width = $("canvas").height = 1;
  $("empty").hidden = false;
  $("viewport-caption").hidden = $("sample-badge").hidden = true;
  $("sample-details").hidden = true;
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
  const ctx = canvas.getContext("2d");
  ctx.strokeStyle = "#ffb000";
  ctx.lineWidth = 1;
  for (const r of regions)
    ctx.strokeRect(
      r.x + 0.5,
      r.y + 0.5,
      Math.max(0, r.width - 1),
      Math.max(0, r.height - 1),
    );
}

function present(result, buffer) {
  ++viewRevision;
  clearTimeout(expiry);
  job = result.job;
  regions = [];
  dragStart = null;
  marking = false;
  edited = Boolean(result.report.redaction?.regions.length);
  sourceLabel = {
    synthetic: result.synthetic,
    sample: result.sample,
    text_exercise: result.text_exercise,
  };
  image = result.image;
  const defaults = result.text_exercise
    ? { x: 16, y: 12, width: 132, height: 14 }
    : {
        x: 0,
        y: 0,
        width: Math.min(16, image.columns),
        height: Math.min(16, image.rows),
      };
  for (const key of ["x", "y", "width", "height"]) {
    $("region-" + key).value = defaults[key];
    $("region-" + key).max = ["x", "width"].includes(key)
      ? image.columns - (key === "x" ? 1 : 0)
      : image.rows - (key === "y" ? 1 : 0);
  }
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
  $("sample-badge").hidden = !result.synthetic && !result.sample;
  $("sample-badge").textContent = result.sample ? "PUBLIC SAMPLE" : "SYNTHETIC";
  $("sample-details").hidden = !result.sample;
  $("sample-details").textContent = result.sample
    ? `Source: ${result.sample.source}. ${result.sample.preparation}`
    : "";
  $("image-title").textContent = result.synthetic
    ? result.text_exercise
      ? "Fake-text redaction exercise"
      : "Geometric CT phantom"
    : (result.sample?.title ?? `${image.modality} · imported image`);
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
    badge.dataset.action = action.action;
    badge.textContent = labels[action.action];
    row.append(left, badge);
    $("changes").append(row);
  }
  $("integrity-title").textContent = edited
    ? "Selected pixels erased and checked"
    : "Pixel bytes preserved";
  $("viewport-caption").textContent = edited
    ? "Selected areas erased · remaining areas unassessed"
    : "Pixels unchanged · single frame";
  $("integrity-copy").textContent = edited
    ? "Export reopened. Selected pixels match the replacement; all pixels outside your selection are unchanged. Complete anonymity is not established."
    : "Export reopened successfully. Metadata contract checked; pixels not assessed for identity.";
  $("integrity-icon").textContent = "✓";
  for (const id of ["center", "width", "reset", "clear", "ack", "report"])
    $(id).disabled = false;
  $("ack").checked = false;
  $("download").disabled = true;
  syncRegions();
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

async function load(file, sample = null) {
  if (busy) return;
  busy = true;
  document.querySelector(".workbench").setAttribute("aria-busy", "true");
  const current = ++generation;
  clearView();
  for (const id of importControls) $(id).disabled = true;
  status(
    sample
      ? "Opening a public test fixture and scrubbing its metadata…"
      : file
        ? "Scrubbing supported metadata…"
        : "Generating a synthetic example…",
  );
  try {
    if (file && file.size > 8 * 1024 * 1024) {
      await request("/api/clear", { method: "POST" });
      throw new Error("This version accepts files up to 8 MiB.");
    }
    const response = await request(
      sample === "text"
        ? "/api/demo-text"
        : sample
          ? `/api/samples/${sample}`
          : file
            ? "/api/process"
            : "/api/demo",
      {
        method: "POST",
        ...(file
          ? { body: file, headers: { "Content-Type": "application/dicom" } }
          : {}),
      },
    );
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
    document.querySelector(".workbench").setAttribute("aria-busy", "false");
    for (const id of importControls) $(id).disabled = false;
    $("file").value = "";
    syncRegions();
  }
}

async function download(kind, name) {
  if (!job || regions.length || busy || (kind === "dicom" && !$("ack").checked))
    return;
  const selectedJob = job,
    revision = viewRevision;
  try {
    const blob = await (
      await request(`/api/jobs/${selectedJob}/${kind}`)
    ).blob();
    // A response may finish after an import, clear, selection or expiry.
    if (
      job !== selectedJob ||
      revision !== viewRevision ||
      busy ||
      regions.length ||
      (kind === "dicom" && !$("ack").checked)
    )
      return;
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    if (job !== selectedJob || revision !== viewRevision) return;
    if ([403, 404].includes(error.status)) clearView();
    status(error.message, true);
  }
}

$("demo").addEventListener("click", () => load());
$("text-exercise").addEventListener("click", () => load(null, "text"));
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
  $("download").disabled =
    !$("ack").checked || !job || busy || regions.length > 0;
});
$("download").addEventListener("click", () =>
  download("dicom", "metadata-scrubbed.dcm"),
);
$("report").addEventListener("click", () =>
  download("report", "metadata-report.json"),
);
$("clear").addEventListener("click", async () => {
  if (busy) return;
  busy = true;
  ++generation;
  clearView();
  for (const id of importControls) $(id).disabled = true;
  try {
    await request("/api/clear", { method: "POST" });
    status("Image cleared. Load another file or try the example.");
  } catch {
    status(
      "The local service could not confirm clearing. Stop it to release its temporary result.",
      true,
    );
  } finally {
    busy = false;
    for (const id of importControls) $(id).disabled = false;
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
for (const id of importControls) $(id).disabled = true;
fetch("/api/session")
  .then((r) => {
    if (!r.ok) throw new Error();
    return r.json();
  })
  .then((session) => {
    token = session.token;
    for (const id of importControls) $(id).disabled = false;
  })
  .catch(() =>
    status(
      "Cannot connect to the local service. Restart it and reload this page.",
      true,
    ),
  );

$("browse-samples").addEventListener("click", () => {
  const open = $("sample-library").hidden;
  $("sample-library").hidden = !open;
  $("browse-samples").setAttribute("aria-expanded", String(open));
});
for (const kind of sampleKinds)
  $("sample-" + kind).addEventListener("click", () => load(null, kind));

// The same explanations are available on hover, keyboard focus and in a touch-friendly guide.
const helpText = {
  "text-exercise":
    "Opens a made-up image with FAKE ID 123 printed in its pixels. Use the suggested rectangle to practise permanently erasing it.",
  "mark-region":
    "Switches on drawing. Drag across text in the picture to select a rectangle. Nothing is erased until you press Erase selected pixels.",
  "add-region":
    "Adds the rectangle described by the four numbers. Left and top start at zero at the upper-left image corner. This is also a keyboard-friendly way to select an area.",
  "undo-regions":
    "Removes all rectangles you have selected but have not yet applied. The image stays as it was.",
  "apply-regions":
    "Permanently replaces the selected pixels in a new file. The app reopens it to check that those pixels were replaced and all other pixels stayed the same. Reimport the original to start again.",
  demo: "Creates a made-up scan using simple shapes. Start here to practise changing contrast and see which personal details the app removes.",
  "browse-samples":
    "Opens six small DICOM files for testing metadata scrubbing and pixel edits. For clearer anatomy, choose Browse 50 teaching scans.",
  "sample-ct":
    "Opens one public CT slice. A slice is a single picture from a scan. Try the contrast sliders to make different parts easier to see.",
  "sample-mr":
    "Opens one public MRI slice. Compare its appearance with the CT example. This small image is for learning, not making a diagnosis.",
  file: "Choose a DICOM image saved on your computer. DICOM is the file format used for medical scans. Use a public or made-up image for this exercise.",
  reset:
    "Puts the brightness and contrast back to the settings used when you opened this image. It does not undo the removal of personal details.",
  clear:
    "Closes the current image and removes its temporary result from the app. It does not delete the original file on your computer.",
  download:
    "Saves a new DICOM file with the supported personal details removed from its attached information. Selected pixel regions are erased only after you apply them. Unselected areas remain unassessed. Load an image and tick the acknowledgement first.",
  report:
    "Saves a list of which information fields were removed, emptied or replaced. It leaves out the original values, so you can review the changes without copying those details.",
};
for (const kind of sampleKinds.filter((k) => k.includes("-")))
  helpText["sample-" + kind] =
    "Opens a tiny public test picture with only 16 rows and 16 columns. It helps you check small-image controls and erasing at the edges. Its detail is too limited for diagnosis.";
const tip = $("button-help");
let helpOwner = null,
  hideHelpTimer;
function hideHelp() {
  tip.hidden = true;
  helpOwner = null;
}
function showHelp(control) {
  clearTimeout(hideHelpTimer);
  helpOwner = control;
  let text = helpText[control.id];
  if (control.disabled)
    text +=
      edited &&
      ["mark-region", "add-region", "undo-regions", "apply-regions"].includes(
        control.id,
      )
        ? " This image has already been edited. Reimport it to make a different selection."
        : job &&
            !busy &&
            ["undo-regions", "apply-regions"].includes(control.id) &&
            !regions.length
          ? " Select at least one rectangle first."
          : busy
            ? " Please wait for the image to finish loading."
            : !token
              ? " The local service needs to connect first."
              : control.id === "download"
                ? " This button becomes available after you tick the box above it."
                : " Open an image first to use this button.";
  tip.textContent = text;
  $("help-" + control.id).textContent = text;
  tip.hidden = false;
  const box = control.getBoundingClientRect();
  const width = tip.offsetWidth,
    height = tip.offsetHeight;
  tip.style.left = `${Math.max(8, Math.min(box.left, innerWidth - width - 8))}px`;
  const below = box.bottom + 8;
  tip.style.top = `${Math.max(8, below + height < innerHeight ? below : box.top - height - 8)}px`;
}
const guide = document.createElement("details");
guide.className = "button-guide";
const summary = document.createElement("summary");
summary.textContent = "Button guide · what each action does";
guide.append(summary);
for (const [id, text] of Object.entries(helpText)) {
  const control = $(id);
  const target = id === "file" ? control.closest("label") : control;
  const wrapper = document.createElement("span");
  wrapper.className = "help-anchor";
  target.before(wrapper);
  wrapper.append(target);
  const description = document.createElement("span");
  description.id = "help-" + id;
  description.hidden = true;
  description.textContent = text;
  document.body.append(description);
  control.setAttribute("aria-describedby", description.id);
  function syncHelpFocus() {
    wrapper.tabIndex = control.disabled ? 0 : -1;
    if (control.disabled) {
      wrapper.setAttribute(
        "aria-label",
        `${id === "file" ? "Choose DICOM file" : control.textContent.trim()} · unavailable`,
      );
      wrapper.setAttribute("aria-describedby", description.id);
    } else {
      wrapper.removeAttribute("aria-label");
      wrapper.removeAttribute("aria-describedby");
    }
  }
  syncHelpFocus();
  new MutationObserver(syncHelpFocus).observe(control, {
    attributes: true,
    attributeFilter: ["disabled"],
  });
  wrapper.addEventListener("pointerenter", () => showHelp(control));
  wrapper.addEventListener("focusin", () => showHelp(control));
  wrapper.addEventListener("pointerleave", () => {
    hideHelpTimer = setTimeout(hideHelp, 180);
  });
  wrapper.addEventListener("focusout", hideHelp);
  wrapper.addEventListener("click", hideHelp);
  const paragraph = document.createElement("p"),
    title = document.createElement("strong");
  title.textContent = `${id === "file" ? "Choose .dcm" : control.textContent.trim()} — `;
  paragraph.append(title, text);
  guide.append(paragraph);
}
$("dropzone").append(guide);
tip.addEventListener("pointerenter", () => clearTimeout(hideHelpTimer));
tip.addEventListener("pointerleave", hideHelp);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideHelp();
    dragStart = null;
    marking = false;
    syncRegions();
  }
});
window.addEventListener("resize", hideHelp);
window.addEventListener(
  "scroll",
  () => {
    if (helpOwner) {
      const box = helpOwner.getBoundingClientRect();
      if (box.bottom < 0 || box.top > innerHeight) hideHelp();
      else showHelp(helpOwner);
    }
  },
  true,
);

function syncRegions() {
  const ready = Boolean(job) && !busy && !edited;
  for (const id of [
    "mark-region",
    "add-region",
    "region-x",
    "region-y",
    "region-width",
    "region-height",
  ])
    $(id).disabled = !ready;
  $("apply-regions").disabled = !ready || !regions.length;
  $("undo-regions").disabled = !ready || !regions.length;
  $("mark-region").setAttribute("aria-pressed", String(marking));
  $("canvas").classList.toggle("marking", marking);
  $("region-status").textContent = edited
    ? "Selected regions erased and verified. Reimport the image to make a different selection."
    : regions.length
      ? `${regions.length} rectangle(s) selected. Exports are paused until you erase these pixels or discard the selection.`
      : sourceLabel.text_exercise
        ? "Select an area. Exercise coordinates: left 16, top 12, width 132, height 14."
        : "Select an area using the numbers or draw a rectangle. Coordinates start at zero.";
  if (regions.length) {
    $("ack").checked = false;
    $("download").disabled = $("report").disabled = true;
  } else if (job && !busy) $("report").disabled = false;
}
function addRegion(box) {
  if (!job || busy || edited) return;
  if (
    regions.length >= 32 ||
    Object.values(box).some((v) => !Number.isInteger(v)) ||
    box.x < 0 ||
    box.y < 0 ||
    box.width < 1 ||
    box.height < 1 ||
    box.x + box.width > image.columns ||
    box.y + box.height > image.rows
  ) {
    status(
      "Choose a rectangle inside the image using whole numbers. Up to 32 rectangles are supported.",
      true,
    );
    return;
  }
  ++viewRevision;
  regions.push(box);
  syncRegions();
  render();
}
$("mark-region").addEventListener("click", () => {
  marking = !marking;
  dragStart = null;
  syncRegions();
});
$("add-region").addEventListener("click", () =>
  addRegion(
    Object.fromEntries(
      ["x", "y", "width", "height"].map((k) => [
        k,
        $("region-" + k).value.trim() === ""
          ? NaN
          : Number($("region-" + k).value),
      ]),
    ),
  ),
);
$("undo-regions").addEventListener("click", () => {
  ++viewRevision;
  $("ack").checked = false;
  $("download").disabled = true;
  regions = [];
  syncRegions();
  render();
});
function imagePoint(event) {
  const rect = $("canvas").getBoundingClientRect();
  return {
    x: Math.max(
      0,
      Math.min(
        image.columns - 1,
        Math.floor(((event.clientX - rect.left) * image.columns) / rect.width),
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        image.rows - 1,
        Math.floor(((event.clientY - rect.top) * image.rows) / rect.height),
      ),
    ),
  };
}
$("canvas").addEventListener("pointerdown", (event) => {
  if (!marking || busy || !image || event.button !== 0 || dragStart) return;
  dragStart = { ...imagePoint(event), pointerId: event.pointerId };
  $("canvas").setPointerCapture(event.pointerId);
  event.preventDefault();
});
$("canvas").addEventListener("pointerup", (event) => {
  if (!dragStart || !image || event.pointerId !== dragStart.pointerId) return;
  const end = imagePoint(event),
    start = dragStart;
  dragStart = null;
  addRegion({
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(start.x - end.x) + 1,
    height: Math.abs(start.y - end.y) + 1,
  });
});
for (const name of ["pointercancel", "lostpointercapture"])
  $("canvas").addEventListener(name, (event) => {
    if (event.pointerId === dragStart?.pointerId) dragStart = null;
  });
$("apply-regions").addEventListener("click", async () => {
  if (busy || !job || !regions.length) return;
  const selection = { job, regions },
    label = { ...sourceLabel };
  busy = true;
  $("ack").checked = false;
  syncRegions();
  for (const id of [...importControls, "clear", "download", "report", "ack"])
    $(id).disabled = true;
  document.querySelector(".workbench").setAttribute("aria-busy", "true");
  status("Erasing selected pixels and checking the saved result…");
  try {
    const result = await (
      await request("/api/redact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection),
      })
    ).json();
    const raw = await (
      await request(`/api/jobs/${result.job}/pixels`)
    ).arrayBuffer();
    present({ ...result, ...label }, raw);
    status(
      "Selected regions erased and verified. Review the result, then acknowledge the remaining limitations before downloading.",
    );
  } catch (error) {
    clearView();
    status(
      error.message ||
        "The edit could not be verified. Import the image again.",
      true,
    );
  } finally {
    busy = false;
    syncRegions();
    document.querySelector(".workbench").setAttribute("aria-busy", "false");
    for (const id of importControls) $(id).disabled = false;
  }
});

// Cancel exports started in the other workbench mode, even if it is closed again.
document.addEventListener("exercise-enter", () => {
  ++viewRevision;
});
