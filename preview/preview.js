import { decode, rgba } from "./pixels.js";

const $ = (id) => document.getElementById(id);
const keys = ["demo", "text", "ct", "mr", "ct-a", "ct-b", "mr-a", "mr-b"];
const imports = [
  "demo",
  "text-exercise",
  ...keys.slice(2).map((k) => "sample-" + k),
];
let sample,
  raw,
  pixels,
  defaults,
  timer,
  loading = false,
  revision = 0;
let regions = [],
  applied = [],
  marking = false,
  drag = null;
const digest = async (bytes) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

function status(text, error = false) {
  $("status").textContent = text;
  $("status").classList.toggle("error", error);
}
function sync() {
  const ready = Boolean(sample) && !loading;
  for (const id of imports) $(id).disabled = loading;
  for (const id of ["center", "width", "reset", "clear", "ack"])
    $(id).disabled = !ready;
  for (const id of [
    "mark-region",
    "add-region",
    "region-x",
    "region-y",
    "region-width",
    "region-height",
  ])
    $(id).disabled = !ready || applied.length > 0;
  for (const id of ["apply-regions", "undo-regions"])
    $(id).disabled = !ready || !regions.length;
  $("download").disabled = !ready || !$("ack").checked || regions.length > 0;
  $("report").disabled = !ready || regions.length > 0;
  $("mark-region").setAttribute("aria-pressed", String(marking));
  $("canvas").classList.toggle("marking", marking);
  document
    .querySelector(".workbench")
    .setAttribute("aria-busy", String(loading));
  $("region-status").textContent = applied.length
    ? "Selected sample pixels replaced. Open the sample again to start over."
    : regions.length
      ? `${regions.length} rectangle(s) selected. Apply or discard them before saving.`
      : sample?.id === "text"
        ? "Suggested rectangle: left 16, top 12, width 132, height 14."
        : "Draw a rectangle or enter whole-number coordinates, starting at zero.";
}
function clear() {
  ++revision;
  clearTimeout(timer);
  sample = raw = pixels = null;
  regions = [];
  applied = [];
  drag = null;
  marking = false;
  $("ack").checked = false;
  $("canvas").hidden = true;
  $("canvas").width = $("canvas").height = 1;
  $("empty").hidden = false;
  for (const id of ["viewport-caption", "sample-badge", "sample-details"])
    $(id).hidden = true;
  $("image-title").textContent = "No image loaded";
  $("image-details").textContent =
    "PNG downloads include the contrast settings and applied edits shown here.";
  $("center-value").textContent = $("width-value").textContent = "—";
  $("changed-count").textContent = $("kept-count").textContent = "—";
  $("changes").replaceChildren();
  $("integrity-title").textContent = "Sample-only browser demo";
  $("integrity-copy").textContent =
    "Metadata changes were prepared with the local tool. This page does not process DICOM uploads.";
  $("integrity-icon").textContent = "○";
  sync();
}
function expiry() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    clear();
    status(
      "The sample was cleared after ten minutes. Choose it again to continue.",
    );
  }, 600000);
}
function fit() {
  if (!sample) return;
  const i = sample.image;
  const ratio = (i.columns * i.spacing[1]) / (i.rows * i.spacing[0]);
  const width = Math.min(
    $("viewport").clientWidth * 0.86,
    $("viewport").clientHeight * 0.86 * ratio,
  );
  $("canvas").style.width = width + "px";
  $("canvas").style.height = width / ratio + "px";
}
function draw() {
  if (!sample) return;
  const center = Number($("center").value),
    width = Number($("width").value);
  const ctx = $("canvas").getContext("2d");
  ctx.putImageData(
    new ImageData(
      rgba(pixels, center, width, sample.image.invert),
      sample.image.columns,
      sample.image.rows,
    ),
    0,
    0,
  );
  ctx.strokeStyle = "#ffb000";
  for (const b of regions)
    ctx.strokeRect(
      b.x + 0.5,
      b.y + 0.5,
      Math.max(0, b.width - 1),
      Math.max(0, b.height - 1),
    );
  $("center-value").textContent = center;
  $("width-value").textContent = width;
}
async function load(key) {
  if (loading || !keys.includes(key)) return;
  loading = true;
  clear();
  const current = revision;
  status("Opening the prepared sample…");
  try {
    const response = await fetch(
      new URL(`./samples/${key}.json`, import.meta.url),
      { credentials: "omit", cache: "no-store" },
    );
    if (!response.ok)
      throw new Error("The sample could not be loaded. Please try again.");
    const data = await response.json();
    const bytes = Uint8Array.from(atob(data.pixels), (c) => c.charCodeAt(0));
    if (
      data.id !== key ||
      bytes.length > 2 * 1024 * 1024 ||
      (await digest(bytes)) !== data.pixel_sha256
    )
      throw new Error(
        "The sample failed its integrity check. Please reload the page.",
      );
    if (current !== revision) return;
    sample = data;
    raw = bytes;
    pixels = decode(bytes.buffer, data.image);
    const i = data.image;
    let low = Infinity,
      high = -Infinity;
    for (const v of pixels) {
      low = Math.min(low, v);
      high = Math.max(high, v);
    }
    defaults = {
      center: i.center ?? (low + high + 1) / 2,
      width: i.width ?? Math.max(1, high - low + 1),
    };
    $("center").min = Math.floor(Math.min(low, defaults.center));
    $("center").max = Math.ceil(Math.max(high, defaults.center, low + 1));
    $("width").max = Math.ceil(Math.max(high - low + 1, defaults.width, 2));
    for (const id of ["center", "width"]) {
      $(id).step = "any";
      $(id).value = defaults[id];
    }
    $("canvas").width = i.columns;
    $("canvas").height = i.rows;
    $("canvas").hidden = false;
    $("empty").hidden = true;
    $("viewport-caption").hidden =
      $("sample-badge").hidden =
      $("sample-details").hidden =
        false;
    $("viewport-caption").textContent = "Prepared sample · PNG export only";
    $("sample-badge").textContent =
      keys.indexOf(key) < 2 ? "SYNTHETIC" : "PUBLIC SAMPLE";
    $("image-title").textContent = data.title;
    $("image-details").textContent =
      `${i.columns} × ${i.rows} · ${i.modality} · identifying content is not assessed`;
    $("sample-details").textContent = `${data.source}. ${data.preparation}`;
    const box =
      key === "text"
        ? { x: 16, y: 12, width: 132, height: 14 }
        : {
            x: 0,
            y: 0,
            width: Math.min(16, i.columns),
            height: Math.min(16, i.rows),
          };
    for (const k of Object.keys(box)) {
      $("region-" + k).value = box[k];
      $("region-" + k).max = ["x", "width"].includes(k)
        ? i.columns - (k === "x" ? 1 : 0)
        : i.rows - (k === "y" ? 1 : 0);
    }
    const counts = data.metadata.counts;
    $("changed-count").textContent =
      counts.removed + counts.emptied + counts.replaced;
    $("kept-count").textContent = counts.kept;
    for (const action of data.metadata.actions.filter(
      (a) => a.action !== "kept",
    )) {
      const row = document.createElement("div");
      row.className = "change-row";
      const left = document.createElement("div"),
        field = document.createElement("span"),
        tag = document.createElement("small"),
        badge = document.createElement("span");
      field.textContent = action.field;
      tag.textContent = action.tag;
      badge.textContent = action.action;
      badge.className = "action";
      badge.dataset.action = action.action;
      left.append(field, tag);
      row.append(left, badge);
      $("changes").append(row);
    }
    $("integrity-title").textContent = "Prepared sample loaded";
    $("integrity-copy").textContent =
      "These metadata actions were recorded before this site was published. The browser checked the sample pixel digest; it has not assessed anonymity.";
    $("integrity-icon").textContent = "✓";
    fit();
    draw();
    expiry();
    status("Sample ready. Try the sliders or the fake-text exercise.");
  } catch (error) {
    clear();
    status(error.message || "The sample could not be opened.", true);
  } finally {
    loading = false;
    sync();
  }
}
function add(box) {
  if (!sample || loading || applied.length) return;
  const i = sample.image;
  if (
    regions.length >= 32 ||
    Object.values(box).some((v) => !Number.isInteger(v)) ||
    box.x < 0 ||
    box.y < 0 ||
    box.width < 1 ||
    box.height < 1 ||
    box.x + box.width > i.columns ||
    box.y + box.height > i.rows
  ) {
    status(
      "Choose a rectangle inside the image using whole numbers. Up to 32 rectangles fit in one edit.",
      true,
    );
    return;
  }
  ++revision;
  regions.push(box);
  $("ack").checked = false;
  sync();
  draw();
}
function apply() {
  if (!sample || !regions.length || loading || applied.length) return;
  ++revision;
  const i = sample.image,
    signed = i.signed;
  const fill =
    i.invert !== i.slope < 0 ? (signed ? 32767 : 65535) : signed ? -32768 : 0;
  const next = raw.slice(),
    view = new DataView(next.buffer),
    before = new DataView(raw.buffer);
  for (const b of regions)
    for (let y = b.y; y < b.y + b.height; y++)
      for (let x = b.x; x < b.x + b.width; x++) {
        view[signed ? "setInt16" : "setUint16"](
          (y * i.columns + x) * 2,
          fill,
          true,
        );
      }
  // Independently walk the complete matrix and compare inside/outside selections.
  for (let n = 0; n < i.rows * i.columns; n++) {
    const x = n % i.columns,
      y = Math.floor(n / i.columns);
    const selected = regions.some(
      (b) => x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height,
    );
    const getter = signed ? "getInt16" : "getUint16";
    if (
      view[getter](n * 2, true) !==
      (selected ? fill : before[getter](n * 2, true))
    ) {
      clear();
      status(
        "The pixel edit could not be verified. Open the sample again.",
        true,
      );
      return;
    }
  }
  raw = next;
  pixels = decode(raw.buffer, i);
  applied = regions.map((b) => ({ ...b }));
  regions = [];
  marking = false;
  drag = null;
  $("ack").checked = false;
  $("integrity-title").textContent = "Selected sample pixels replaced";
  $("integrity-copy").textContent =
    "The selected pixels were replaced and all outside pixels checked as unchanged. This is a browser exercise; no DICOM file was created.";
  $("viewport-caption").textContent =
    "Sample edited · remaining areas unassessed";
  draw();
  sync();
  expiry();
  status(
    "Edit applied to this sample. Save a PNG or open the sample again to start over.",
  );
}
async function save(kind) {
  if (
    !sample ||
    loading ||
    regions.length ||
    (kind === "png" && !$("ack").checked)
  )
    return;
  const current = revision,
    selected = sample;
  let blob;
  if (kind === "png")
    blob = await new Promise((resolve) =>
      $("canvas").toBlob(resolve, "image/png"),
    );
  else {
    const report = {
      preview_schema: 1,
      sample: selected.id,
      scope:
        "Sample-only browser exercise. No DICOM created; anonymity not assessed.",
      metadata_prepared_before_publication: selected.metadata,
      applied_rectangles: applied.map((b) => ({ ...b })),
      stored_pixels_sha256: await digest(raw),
      display: {
        center: Number($("center").value),
        width: Number($("width").value),
      },
      export_format: "PNG",
    };
    blob = new Blob([JSON.stringify(report, null, 2) + "\n"], {
      type: "application/json",
    });
  }
  if (
    !blob ||
    current !== revision ||
    selected !== sample ||
    regions.length ||
    (kind === "png" && !$("ack").checked)
  )
    return;
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download =
    kind === "png"
      ? "dicom-workbench-preview.png"
      : "dicom-workbench-exercise.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function point(e) {
  const r = $("canvas").getBoundingClientRect(),
    i = sample.image;
  return {
    x: Math.max(
      0,
      Math.min(
        i.columns - 1,
        Math.floor(((e.clientX - r.left) * i.columns) / r.width),
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        i.rows - 1,
        Math.floor(((e.clientY - r.top) * i.rows) / r.height),
      ),
    ),
  };
}
$("demo").onclick = () => load("demo");
$("text-exercise").onclick = () => load("text");
for (const key of keys.slice(2)) $("sample-" + key).onclick = () => load(key);
$("browse-samples").onclick = () => {
  $("sample-library").hidden = !$("sample-library").hidden;
  $("browse-samples").setAttribute(
    "aria-expanded",
    String(!$("sample-library").hidden),
  );
};
for (const id of ["center", "width"])
  $(id).oninput = () => {
    ++revision;
    draw();
  };
$("reset").onclick = () => {
  ++revision;
  for (const id of ["center", "width"]) $(id).value = defaults[id];
  draw();
};
$("clear").onclick = () => {
  clear();
  status("Sample cleared. Choose another to continue.");
};
$("ack").onchange = sync;
$("download").onclick = () =>
  save("png").catch(() =>
    status("The PNG could not be saved. Please try again.", true),
  );
$("report").onclick = () =>
  save("json").catch(() =>
    status("The report could not be saved. Please try again.", true),
  );
$("add-region").onclick = () =>
  add(
    Object.fromEntries(
      ["x", "y", "width", "height"].map((k) => [
        k,
        $("region-" + k).value.trim() === ""
          ? NaN
          : Number($("region-" + k).value),
      ]),
    ),
  );
$("undo-regions").onclick = () => {
  ++revision;
  regions = [];
  drag = null;
  $("ack").checked = false;
  sync();
  draw();
};
$("apply-regions").onclick = apply;
$("mark-region").onclick = () => {
  marking = !marking;
  drag = null;
  sync();
};
$("canvas").onpointerdown = (e) => {
  if (!marking || drag || !sample || loading || e.button !== 0) return;
  drag = { ...point(e), id: e.pointerId };
  $("canvas").setPointerCapture(e.pointerId);
  e.preventDefault();
};
$("canvas").onpointerup = (e) => {
  if (!drag || !sample || drag.id !== e.pointerId) return;
  const end = point(e),
    start = drag;
  drag = null;
  add({
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(start.x - end.x) + 1,
    height: Math.abs(start.y - end.y) + 1,
  });
};
for (const name of ["pointercancel", "lostpointercapture"])
  $("canvas").addEventListener(name, (e) => {
    if (drag?.id === e.pointerId) drag = null;
  });
for (const name of ["dragover", "drop"])
  window.addEventListener(name, (e) => {
    e.preventDefault();
    if (name === "drop")
      status(
        "This public demo accepts samples only. Use the local tool to open your own DICOM files.",
      );
  });
new ResizeObserver(fit).observe($("viewport"));

const help = {
  demo: "Opens a made-up scan. Use it to try the viewer without patient data.",
  "browse-samples":
    "Shows six small DICOM test fixtures. For clearer anatomy and study notes, choose Browse 50 teaching scans.",
  "text-exercise":
    "Opens a made-up image with FAKE ID 123 printed in its pixels. The suggested rectangle covers that text.",
  "mark-region":
    "Lets you drag a rectangle across the picture. Press Escape to cancel drawing.",
  "add-region":
    "Selects the rectangle described by the four numbers. Zero is the top-left corner. No pixels change until you apply the edit.",
  "undo-regions":
    "Discards your pending rectangles and leaves the sample unchanged.",
  "apply-regions":
    "Replaces the selected sample pixels in this tab, then checks that all other pixels stayed the same. It does not create a DICOM file.",
  reset:
    "Returns the contrast sliders to their starting positions. Applied erasing stays in place.",
  clear:
    "Closes the sample and clears this tab’s working copy. Your saved downloads stay on your computer.",
  download:
    "Saves the picture you see as a PNG, including the current contrast and applied edits. It is not an anonymised DICOM file.",
  report:
    "Saves an exercise record: prepared metadata actions, selected rectangles and display settings. It does not certify anonymity.",
};
for (const key of keys.slice(2))
  help["sample-" + key] =
    `Opens a public ${key.startsWith("ct") ? "CT" : "MRI"} sample. ${key.includes("-") ? "This tiny 16 × 16 picture helps you test image edges." : "Try changing its contrast with the sliders."}`;
const tip = $("button-help"),
  guide = document.createElement("details"),
  summary = document.createElement("summary");
guide.className = "button-guide";
summary.textContent = "Button guide · what each action does";
guide.append(summary);
function hideHelp() {
  tip.hidden = true;
}
for (const [id, text] of Object.entries(help)) {
  const button = $(id),
    wrap = document.createElement("span"),
    description = document.createElement("span");
  wrap.className = "help-anchor";
  button.before(wrap);
  wrap.append(button);
  description.id = "help-" + id;
  description.hidden = true;
  description.textContent = text;
  document.body.append(description);
  button.setAttribute("aria-describedby", description.id);
  const focus = () => {
    wrap.tabIndex = button.disabled ? 0 : -1;
    if (button.disabled) {
      wrap.setAttribute(
        "aria-label",
        button.textContent.trim() + " · unavailable",
      );
      wrap.setAttribute("aria-describedby", description.id);
    } else {
      wrap.removeAttribute("aria-label");
      wrap.removeAttribute("aria-describedby");
    }
  };
  focus();
  new MutationObserver(focus).observe(button, {
    attributes: true,
    attributeFilter: ["disabled"],
  });
  const show = () => {
    tip.textContent =
      text +
      (button.disabled
        ? " Open a sample and complete the preceding step to use this action."
        : "");
    tip.hidden = false;
    const box = button.getBoundingClientRect();
    tip.style.left =
      Math.max(8, Math.min(box.left, innerWidth - tip.offsetWidth - 8)) + "px";
    tip.style.top =
      Math.max(
        8,
        Math.min(box.bottom + 8, innerHeight - tip.offsetHeight - 8),
      ) + "px";
  };
  wrap.addEventListener("pointerenter", show);
  wrap.addEventListener("focusin", show);
  wrap.addEventListener("pointerleave", hideHelp);
  wrap.addEventListener("focusout", hideHelp);
  wrap.addEventListener("click", hideHelp);
  const p = document.createElement("p"),
    title = document.createElement("strong");
  title.textContent = button.textContent.trim() + ": ";
  p.append(title, text);
  guide.append(p);
}
$("dropzone").append(guide);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    hideHelp();
    drag = null;
    marking = false;
    sync();
  }
});
window.addEventListener("resize", hideHelp);
window.addEventListener("scroll", hideHelp, true);
clear();

// Cancel exports started in the other workbench mode, even if it is closed again.
document.addEventListener("exercise-enter", () => {
  ++revision;
});
