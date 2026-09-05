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
  $("sample-badge").hidden = !result.synthetic && !result.sample;
  $("sample-badge").textContent = result.sample ? "PUBLIC SAMPLE" : "SYNTHETIC";
  $("sample-details").hidden = !result.sample;
  $("sample-details").textContent = result.sample
    ? `Source: pydicom / NEMA · ${result.sample.file}. ${result.sample.preparation}`
    : "";
  $("image-title").textContent = result.synthetic
    ? "Geometric CT phantom"
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

async function load(file, sample = null) {
  if (busy) return;
  busy = true;
  document.querySelector(".workbench").setAttribute("aria-busy", "true");
  const current = ++generation;
  clearView();
  for (const id of ["demo", "file", "sample-ct", "sample-mr"])
    $(id).disabled = true;
  status(
    sample
      ? "Opening a public teaching scan and scrubbing its metadata…"
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
      sample ? `/api/samples/${sample}` : file ? "/api/process" : "/api/demo",
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
    for (const id of ["demo", "file", "sample-ct", "sample-mr"])
      $(id).disabled = false;
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
for (const id of ["demo", "file", "sample-ct", "sample-mr"])
  $(id).disabled = true;
fetch("/api/session")
  .then((r) => {
    if (!r.ok) throw new Error();
    return r.json();
  })
  .then((session) => {
    token = session.token;
    for (const id of ["demo", "file", "sample-ct", "sample-mr"])
      $(id).disabled = false;
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
for (const kind of ["ct", "mr"])
  $("sample-" + kind).addEventListener("click", () => load(null, kind));

// The same explanations are available on hover, keyboard focus and in a touch-friendly guide.
const helpText = {
  demo: "Creates a made-up scan using simple shapes. Start here to practise changing contrast and see which personal details the app removes.",
  "browse-samples":
    "Opens a small collection of public CT and MRI teaching images. Choose one to practise with a scan instead of the made-up shapes.",
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
    "Saves a new DICOM file with the supported personal details removed from its attached information. The picture itself is unchanged. Load an image and tick the acknowledgement first.",
  report:
    "Saves a list of which information fields were removed, emptied or replaced. It leaves out the original values, so you can review the changes without copying those details.",
};
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
    text += busy
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
  if (event.key === "Escape") hideHelp();
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
