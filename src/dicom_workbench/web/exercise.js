import {
  FAKE_DETAILS,
  nonymise,
  erase,
  verifyErase,
  remainingInk,
  equalBytes,
  validateRegions,
} from "./exercise-core.js";
import {
  withMetadata,
  scrubMetadata,
  readText,
  asciiJSON,
  parsePNG,
} from "./exercise-png.js";
const $ = (id) => document.getElementById("exercise-" + id);
const panel = document.getElementById("exercise");
let state = null,
  busy = false,
  before = false,
  regions = [];
const canvas = $("canvas"),
  ctx = canvas.getContext("2d");
const hash = async (bytes) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
function surface(pixels, width, height) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  c.getContext("2d").putImageData(new ImageData(pixels, width, height), 0, 0);
  return c;
}
async function encode(pixels, width, height, metadata) {
  const blob = await new Promise((resolve, reject) =>
    surface(pixels, width, height).toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(new Error("The browser could not save this picture.")),
      "image/png",
    ),
  );
  return withMetadata(new Uint8Array(await blob.arrayBuffer()), metadata);
}
async function reopen(bytes) {
  const url = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const cx = c.getContext("2d", { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    return {
      width: c.width,
      height: c.height,
      pixels: cx.getImageData(0, 0, c.width, c.height).data,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function verify(s) {
  // Check the bytes that will be downloaded, independently decoded by the browser.
  const actual = await reopen(s.png),
    meta = readText(s.png);
  if (
    actual.width !== s.width ||
    actual.height !== s.height ||
    !equalBytes(actual.pixels, s.pixels)
  )
    throw new Error(
      "The reopened PNG differs from the expected picture. Export blocked.",
    );
  if (JSON.stringify({ ...meta }) !== JSON.stringify(s.metadata))
    throw new Error(
      "The saved information differs from the expected fields. Export blocked.",
    );
  if (
    parsePNG(s.png).some(
      (c) => !["IHDR", "IDAT", "IEND", "tEXt"].includes(c.type),
    )
  )
    throw new Error("Unexpected hidden PNG information. Export blocked.");
  const fakeKeys = Object.keys(meta).filter((k) => k !== "Source");
  return {
    scope:
      "Only identifiers deliberately injected by this exercise are checked. Source labels and recognisable anatomy remain unassessed.",
    format: "PNG (not DICOM)",
    source: JSON.parse(s.source),
    sha256: await hash(s.png),
    pixel_sha256: await hash(s.pixels),
    width: s.width,
    height: s.height,
    reopened_pixels_match: true,
    remaining_fake_fields: fakeKeys,
    remaining_injected_label_pixels: s.ink
      ? remainingInk(actual.pixels, s.ink)
      : 0,
    retained_metadata_keys: Object.keys(meta),
    all_added_details_removed:
      !!s.ink && !fakeKeys.length && remainingInk(actual.pixels, s.ink) === 0,
    edits: s.edits,
  };
}
function draw() {
  if (!state) return;
  const s = before ? state.dirty : state;
  canvas.width = s.width;
  canvas.height = s.height;
  ctx.putImageData(new ImageData(s.pixels, s.width, s.height), 0, 0);
  if (!before) {
    ctx.strokeStyle = "#ffcc44";
    ctx.lineWidth = Math.max(2, s.width / 400);
    for (const r of regions)
      ctx.strokeRect(r.x + 1, r.y + 1, r.width - 2, r.height - 2);
  }
  $("view-label").textContent = before
    ? "BEFORE — fake details are still present"
    : "CURRENT — " +
      (regions.length
        ? `${regions.length} rectangle(s) selected; outlines are not saved`
        : "saved pixels, without display filters");
}
function render() {
  if (!state) return;
  draw();
  const r = state.verification,
    dirty = !!state.ink;
  const allowed = {
    close: !busy,
    nonymise: !dirty,
    metadata: dirty && Object.keys(state.metadata).length > 1,
    select: dirty,
    erase: dirty && regions.length > 0,
    add: dirty,
    discard: regions.length > 0,
    before: dirty,
    restart: true,
    save:
      r?.all_added_details_removed &&
      $("ack").checked &&
      !before &&
      !regions.length,
    report: !!r,
    dirty: dirty,
  };
  for (const [id, enabled] of Object.entries(allowed))
    $(id).disabled = busy || !enabled;
  for (const id of ["x", "y", "w", "h"])
    $(id).disabled = busy || !dirty || before;
  for (const id of [
    "nonymise",
    "metadata",
    "select",
    "erase",
    "add",
    "discard",
  ])
    if (before) $(id).disabled = true;
  $("ack").disabled = busy;
  $("before").textContent = before ? "Show current" : "Show before";
  $("before").setAttribute("aria-pressed", String(before));
  $("fields").replaceChildren();
  for (const [key, value] of Object.entries(FAKE_DETAILS)) {
    const names = {
      PatientName: "Patient name",
      PatientID: "Patient number",
      PatientBirthDate: "Date of birth",
      InstitutionName: "Hospital",
      StudyDate: "Scan date",
      ReferringPhysicianName: "Referring doctor",
      Comment: "Comment",
    };
    const dt = document.createElement("dt"),
      dd = document.createElement("dd");
    dt.textContent = names[key];
    dd.textContent = Object.hasOwn(state.metadata, key)
      ? value
      : dirty
        ? "Removed from PNG"
        : "Not added yet";
    $("fields").append(dt, dd);
  }
  $("checks").textContent = r
    ? `Saved PNG reopened: pixels match. Fake metadata fields remaining: ${r.remaining_fake_fields.length}. Injected label pixels remaining: ${r.remaining_injected_label_pixels}. Source credit is retained.`
    : "Preparing file checks…";
}
async function transaction(action, message) {
  if (busy || !state) return;
  busy = true;
  render();
  $("status").textContent = "Working and checking the saved file…";
  try {
    const next = await action(state);
    next.verification = await verify(next);
    state = next;
    $("status").textContent = message;
  } catch (error) {
    $("status").textContent = error.message;
  } finally {
    busy = false;
    render();
  }
}
function save(bytes, name, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function openExercise(item, img, stillCurrent = () => true) {
  if (busy)
    throw new Error(
      "Wait for the current file check to finish, then try again.",
    );
  if (document.querySelector(".workbench").getAttribute("aria-busy") === "true")
    throw new Error(
      "Wait for the DICOM image to finish loading, then open the teaching exercise.",
    );
  busy = true;
  try {
    if (
      !img.complete ||
      img.naturalWidth !== item.width ||
      img.naturalHeight !== item.height
    )
      throw new Error("Wait for the teaching picture to finish loading.");
    const c = document.createElement("canvas");
    c.width = item.width;
    c.height = item.height;
    const cx = c.getContext("2d");
    cx.drawImage(img, 0, 0);
    const original = cx.getImageData(0, 0, c.width, c.height).data;
    const source = asciiJSON({
      title: item.title,
      author: item.author,
      license: item.license,
      license_url: item.license_url,
      source_url: item.source_url,
      source_sha256: item.source_sha256,
      teaching_sha256: item.sha256,
      changes:
        item.changes +
        " Converted to PNG for an exercise; fake information and margins may be added or removed.",
      scope: "Published teaching image, not a clinical DICOM export.",
    });
    const next = {
      original,
      originalWidth: c.width,
      originalHeight: c.height,
      width: c.width,
      height: c.height,
      pixels: original,
      metadata: { Source: source },
      source,
      edits: [],
    };
    next.png = await encode(
      next.pixels,
      next.width,
      next.height,
      next.metadata,
    );
    next.verification = await verify(next);
    if (!stillCurrent()) throw new Error("Image opening cancelled.");
    document.dispatchEvent(new Event("exercise-enter"));
    state = next;
    before = false;
    regions = [];
    $("ack").checked = false;
    $("title").textContent = item.title + " · " + item.modality;
    $("source").textContent =
      item.look_for +
      " " +
      item.author +
      " · " +
      item.license +
      ". Source credit is kept in the downloaded file.";
    $("status").textContent =
      "Ready. Press NONYMISE to add clearly fake information.";
    panel.hidden = false;
    panel.parentElement.classList.add("exercise-active");
  } finally {
    busy = false;
    render();
  }
}
$("nonymise").onclick = () =>
  transaction(async (s) => {
    const added = nonymise(s.original, s.originalWidth, s.originalHeight),
      metadata = { Source: s.source, ...FAKE_DETAILS };
    const png = await encode(added.pixels, added.width, added.height, metadata);
    regions = [];
    before = false;
    $("ack").checked = false;
    return {
      ...s,
      ...added,
      metadata,
      png,
      dirty: {
        pixels: added.pixels.slice(),
        width: added.width,
        height: added.height,
        png: png.slice(),
      },
      edits: [],
    };
  }, "Fake details added to seven PNG metadata fields and four visible labels. Both channels now need scrubbing.");
$("metadata").onclick = () =>
  transaction(
    async (s) => ({
      ...s,
      metadata: { Source: s.source },
      png: scrubMetadata(s.png, s.source),
      edits: [
        ...s.edits,
        {
          action: "remove_fake_metadata",
          removed_keys: Object.keys(s.metadata).filter((k) => k !== "Source"),
          encoded_image_payload_unchanged: true,
        },
      ],
    }),
    "Fake metadata removed. Visible letters are separate pixels: select and erase them too.",
  );
$("select").onclick = () => {
  regions = state.labels.map((r) => ({ ...r }));
  render();
  $("status").textContent =
    "Both added margins selected. Press Erase selected pixels to remove their labels.";
};
$("add").onclick = () => {
  try {
    const values = ["x", "y", "w", "h"].map((id) => $(id).value.trim());
    if (values.some((v) => v === ""))
      throw new Error("Fill in all four rectangle numbers.");
    const [x, y, width, height] = values.map(Number),
      next = [...regions, { x, y, width, height }];
    validateRegions(next, state.width, state.height);
    regions = next;
    render();
    $("status").textContent =
      "Rectangle selected. It will change the image only when you erase it.";
  } catch (e) {
    $("status").textContent = e.message;
  }
};
$("discard").onclick = () => {
  regions = [];
  render();
};
$("erase").onclick = () =>
  transaction(async (s) => {
    const boxes = regions.map((r) => ({ ...r })),
      pixels = erase(s.pixels, s.width, s.height, boxes),
      checks = verifyErase(s.pixels, pixels, s.width, s.height, boxes);
    const png = await encode(pixels, s.width, s.height, s.metadata);
    const next = {
      ...s,
      pixels,
      png,
      edits: [
        ...s.edits,
        { action: "erase_pixels", rectangles: boxes, ...checks },
      ],
    };
    regions = [];
    return next;
  }, "Selected pixels replaced with solid black. Check the remaining-field and remaining-label counts below.");
$("before").onclick = () => {
  before = !before;
  render();
};
$("restart").onclick = () =>
  transaction(async (s) => {
    const metadata = { Source: s.source },
      png = await encode(
        s.original,
        s.originalWidth,
        s.originalHeight,
        metadata,
      );
    before = false;
    regions = [];
    $("ack").checked = false;
    return {
      original: s.original,
      originalWidth: s.originalWidth,
      originalHeight: s.originalHeight,
      width: s.originalWidth,
      height: s.originalHeight,
      pixels: s.original,
      metadata,
      source: s.source,
      png,
      edits: [],
    };
  }, "Restarted from the published picture. Fake details have not been added yet.");
$("ack").onchange = render;
$("save").onclick = () =>
  transaction(async (s) => {
    const r = await verify(s);
    if (
      !r.all_added_details_removed ||
      !$("ack").checked ||
      before ||
      regions.length
    )
      throw new Error(
        "Finish both scrub steps and review the limits before saving.",
      );
    save(s.png, "scrubbed-teaching-exercise.png", "image/png");
    return s;
  }, "Saved the verified PNG. Injected fake metadata and label pixels are gone.");
$("dirty").onclick = () => {
  if (!busy && state?.dirty)
    save(state.dirty.png, "nonymised-FAKE-DETAILS.png", "image/png");
};
$("report").onclick = () =>
  transaction(async (s) => {
    const r = await verify(s);
    save(
      JSON.stringify(r, null, 2),
      "teaching-exercise-verification.json",
      "application/json",
    );
    return s;
  }, "Saved the report for the current PNG. Its fingerprint identifies the exact file checked.");
$("close").onclick = () => {
  if (busy) return;
  state = null;
  regions = [];
  before = false;
  canvas.width = canvas.height = 0;
  panel.hidden = true;
  panel.parentElement.classList.remove("exercise-active");
  document.getElementById("browse-teaching").focus();
};
// A separate mode prevents exercise pixels or identifiers reaching DICOM exports.
// Choosing a legacy sample deliberately returns to that controller's own view.
for (const id of [
  "demo",
  "file",
  "sample-ct",
  "sample-mr",
  "sample-ct-a",
  "sample-ct-b",
  "sample-mr-a",
  "sample-mr-b",
]) {
  const el = document.getElementById(id);
  if (!el) continue;
  el.addEventListener(
    "click",
    (event) => {
      if (!state) return;
      if (busy) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      $("close").click();
    },
    true,
  );
}
for (const button of panel.querySelectorAll("button[title]")) {
  const desc = document.createElement("span");
  desc.id = button.id + "-help";
  desc.hidden = true;
  desc.textContent = button.title;
  button.after(desc);
  button.setAttribute("aria-describedby", desc.id);
  for (const event of ["pointerenter", "focus"])
    button.addEventListener(event, () => {
      $("help").textContent = button.title;
    });
}

// File drops follow the DICOM controller, so reveal that view before it runs.
document.getElementById("dropzone").addEventListener(
  "drop",
  (event) => {
    if (!state) return;
    if (busy) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    $("close").click();
  },
  true,
);
