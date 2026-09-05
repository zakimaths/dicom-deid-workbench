import { challenge, GENERATOR_VERSION } from "./challenge.js";
import { scoreChallenge } from "./challenge-score.js";
import { suggestText, cancelOCR } from "./ocr.js";
import { BUILD } from "./build-info.js";
let history = [],
  scored = false,
  assisted = false,
  zoomIndex = 3;
const zoomLevels = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
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
    report_schema: 3,
    app: BUILD,
    generator: s.generator || "guided-1",
    seed: s.seed ?? null,
    challenge_score: s.challenge ? scoreChallenge(actual.pixels, s) : null,
    assisted,
    human_review: $("ack").checked
      ? "limits_acknowledged_not_clinical_review"
      : "not_recorded",
    anatomy_review: "not_assessed",
    ocr: s.ocr || { status: "not_run" },
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
  const fitWidth = Math.min(
    canvas.parentElement.clientWidth,
    ((window.innerHeight * 0.75 - 2) * s.width) / s.height,
  );
  const scale = (Math.max(1, fitWidth) * zoomLevels[zoomIndex]) / s.width;
  canvas.style.width = `${s.width * scale}px`;
  ctx.putImageData(new ImageData(s.pixels, s.width, s.height), 0, 0);
  if (!before) {
    ctx.strokeStyle = "#ffcc44";
    ctx.lineWidth = Math.max(2, s.width / 400);
    regions.forEach((r, index) => {
      ctx.strokeRect(r.x + 1, r.y + 1, r.width - 2, r.height - 2);
      // Editing guides live only on this display canvas, never in saved pixels.
      const label = String(index + 1);
      const padding = Math.min(3 / scale, r.width / 8, r.height / 8);
      let fontSize = Math.min(16 / scale, r.height - 2 * padding);
      ctx.font = `bold ${fontSize}px monospace`;
      fontSize *= Math.min(
        1,
        (r.width - 2 * padding) / ctx.measureText(label).width,
      );
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.width, r.height);
      ctx.clip();
      ctx.fillStyle = "#ffcc44";
      ctx.fillRect(
        r.x,
        r.y,
        ctx.measureText(label).width + 2 * padding,
        fontSize + 2 * padding,
      );
      ctx.fillStyle = "#10150e";
      ctx.textBaseline = "top";
      ctx.fillText(label, r.x + padding, r.y + padding);
      ctx.restore();
    });
  }
  $("view-label").textContent = before
    ? "BEFORE — fake details are still present"
    : "CURRENT — " +
      (regions.length
        ? `${regions.length} numbered box(es) selected; numbers and outlines are not saved`
        : "saved pixels, without display filters");
}
function render() {
  if (!state) return;
  draw();
  const r = state.verification,
    dirty = !!state.ink;
  const allowed = {
    close: !busy,
    ocr: dirty && !before,
    score: dirty && !before,
    reveal: dirty && state.challenge && !before,
    zoom: zoomIndex < zoomLevels.length - 1,
    "zoom-out": zoomIndex > 0,
    "zoom-fit": zoomIndex !== 3,
    undo: history.length > 0 && !before,
    nonymise: !dirty,
    metadata: dirty && Object.keys(state.metadata).length > 1,
    select: dirty && !state.challenge,
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
  $("zoom-level").textContent =
    `${Math.round(zoomLevels[zoomIndex] * 100)}% of fit`;
  $("ack").disabled = busy;
  $("mode").disabled = busy || dirty;
  $("seed").disabled = busy || dirty || $("mode").value !== "challenge";
  $("human-status").textContent = $("ack").checked
    ? "limits acknowledged; no clinical review"
    : "not recorded";
  $("select").hidden = !!state.challenge;
  $("reveal").hidden = !state.challenge;
  $("score-result").textContent =
    scored && r?.challenge_score
      ? `${assisted ? "Assisted practice. " : ""}Fake labels missed: ${r.challenge_score.missed_identifiers} / ${r.challenge_score.identifier_count}. Pixels changed outside fake letters: ${r.challenge_score.changed_pixels_outside_labels}. Innocent orientation-label pixels changed: ${r.challenge_score.innocent_label_pixels_changed}. Source text and anatomy remain unassessed.`
      : state.challenge
        ? "Answer positions are hidden. Check your attempt when ready."
        : "Guided practice uses known label positions.";
  $("selections").replaceChildren();
  regions.forEach((box, index) => {
    const li = document.createElement("li"),
      edit = document.createElement("button"),
      remove = document.createElement("button");
    edit.className = remove.className = "report-button";
    edit.textContent = `Edit box ${index + 1}: left ${box.x}, top ${box.y}, width ${box.width}, height ${box.height}`;
    edit.disabled = remove.disabled = busy || before;
    edit.onclick = () => {
      ["x", "y", "w", "h"].forEach(
        (id, i) => ($(id).value = Object.values(box)[i]),
      );
      regions.splice(index, 1);
      $("x").closest("details").open = true;
      render();
      $("x").focus();
    };
    remove.textContent = `Remove box ${index + 1}`;
    remove.onclick = () => {
      regions.splice(index, 1);
      render();
      canvas.focus();
    };
    li.append(edit, remove);
    $("selections").append(li);
  });
  $("before").textContent = before ? "Show current" : "Show before";
  $("before").setAttribute("aria-pressed", String(before));
  $("fields").replaceChildren();
  for (const [key, value] of Object.entries(
    state.fakeDetails || FAKE_DETAILS,
  )) {
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
async function transaction(action, message, remember = false) {
  if (busy || !state) return;
  busy = true;
  render();
  $("status").textContent = "Working and checking the saved file…";
  try {
    const next = await action(state);
    next.verification = await verify(next);
    if (remember) {
      history.push(state);
      if (history.length > 3) history.shift();
    }
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
    zoomIndex = 3;
    canvas.parentElement.scrollTo(0, 0);
    history = [];
    scored = false;
    assisted = false;
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
    const seedValue = $("seed").value.trim();
    if ($("mode").value === "challenge" && !seedValue)
      throw new Error("Enter a challenge number.");
    const added =
        $("mode").value === "challenge"
          ? challenge(
              s.original,
              s.originalWidth,
              s.originalHeight,
              Number(seedValue),
            )
          : nonymise(s.original, s.originalWidth, s.originalHeight),
      metadata = { Source: s.source, ...(added.fakeDetails || FAKE_DETAILS) };
    history = [];
    scored = false;
    assisted = false;
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
  }, "Fake details added. Inspect the picture and file information; some challenges contain no fake pixel labels.");
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
    true,
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
  transaction(
    async (s) => {
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
    },
    "Selected pixels replaced with solid black. Check the remaining-field and remaining-label counts below.",
    true,
  );
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
    history = [];
    scored = false;
    assisted = false;
    $("ocr-status").textContent = "Text search has not run.";
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
$("mode").onchange = render;
$("cancel").onclick = cancelOCR;
function setZoom(index) {
  zoomIndex = Math.max(0, Math.min(zoomLevels.length - 1, index));
  render();
  if (zoomIndex <= 3) canvas.parentElement.scrollTo(0, 0);
}
$("zoom").onclick = () => setZoom(zoomIndex + 1);
$("zoom-out").onclick = () => setZoom(zoomIndex - 1);
$("zoom-fit").onclick = () => setZoom(3);
window.addEventListener("resize", draw);
let stageWidth = 0;
new ResizeObserver(([entry]) => {
  if (entry.contentRect.width !== stageWidth) {
    stageWidth = entry.contentRect.width;
    draw();
  }
}).observe(canvas.parentElement);
$("undo").onclick = () =>
  transaction(async () => {
    const previous = history.at(-1);
    if (!previous) throw new Error("No edit to undo.");
    history.pop();
    regions = [];
    return previous;
  }, "Last edit undone and saved file checked again.");
$("score").onclick = () =>
  transaction(async (s) => {
    scored = true;
    return s;
  }, "Attempt checked against the injected labels. Review missed labels and unnecessary changes.");
$("reveal").onclick = () => {
  assisted = true;
  scored = true;
  regions = state.labels.map((b) => ({ ...b }));
  render();
  $("status").textContent =
    "Answer boxes revealed. This attempt is now assisted practice.";
};
$("ocr").onclick = async () => {
  if (busy || !state?.ink || before) return;
  busy = true;
  render();
  $("cancel").disabled = false;
  $("ocr-status").textContent =
    "Looking for text locally. No image is uploaded. This can take up to 30 seconds.";
  try {
    const result = await suggestText(
      surface(state.pixels, state.width, state.height),
    );
    regions = result.boxes;
    state.ocr = { ...result, boxes: result.boxes.length };
    $("ocr-status").textContent =
      `${result.boxes.length} possible text boxes. ${result.truncated ? "Only the first 32 are shown. " : ""}Review and remove wrong boxes before erasing. A missed label remains possible; an empty result is unresolved.`;
  } catch (e) {
    state.ocr = { status: "failed_or_cancelled_unresolved" };
    $("ocr-status").textContent = e.message;
  } finally {
    busy = false;
    $("cancel").disabled = true;
    render();
  }
};
let pointerStart = null;
const position = (e) => {
  const b = canvas.getBoundingClientRect();
  return {
    x: Math.max(
      0,
      Math.min(
        state.width - 1,
        Math.floor(((e.clientX - b.left) * state.width) / b.width),
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        state.height - 1,
        Math.floor(((e.clientY - b.top) * state.height) / b.height),
      ),
    ),
  };
};
canvas.onpointerdown = (e) => {
  if (busy || !state?.ink || before || e.button !== 0) return;
  pointerStart = position(e);
  canvas.setPointerCapture(e.pointerId);
};
canvas.onpointercancel = () => {
  pointerStart = null;
};
canvas.onpointerup = (e) => {
  if (!pointerStart) return;
  const end = position(e),
    start = pointerStart;
  pointerStart = null;
  const b = {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x) + 1,
    height: Math.abs(end.y - start.y) + 1,
  };
  try {
    validateRegions([...regions, b], state.width, state.height);
    regions.push(b);
    render();
  } catch (error) {
    $("status").textContent = error.message;
  }
};
canvas.onkeydown = (e) => {
  if (busy || !state?.ink || before) return;
  if (e.key === "Enter") {
    e.preventDefault();
    $("add").click();
    return;
  }
  const delta = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  }[e.key];
  if (!delta) return;
  e.preventDefault();
  const ids = e.shiftKey ? ["w", "h"] : ["x", "y"];
  ids.forEach(
    (id, i) =>
      ($(id).value = Math.max(
        e.shiftKey ? 1 : 0,
        Number($(id).value) + delta[i],
      )),
  );
  $("view-label").textContent =
    `Box: left ${$("x").value}, top ${$("y").value}, width ${$("w").value}, height ${$("h").value}. Enter adds it.`;
};
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
  history = [];
  scored = false;
  assisted = false;
  canvas.width = canvas.height = 0;
  panel.hidden = true;
  panel.parentElement.classList.remove("exercise-active");
  document.getElementById("browse-teaching").focus();
};
// A separate mode prevents exercise pixels or identifiers reaching DICOM exports.
// Choosing a legacy sample deliberately returns to that controller's own view.
for (const id of [
  "demo",
  "text-exercise",
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
  const term = document.createElement("dt"),
    definition = document.createElement("dd");
  term.textContent = button.textContent;
  definition.textContent = button.title;
  $("all-help").append(term, definition);
  button.setAttribute("aria-describedby", desc.id);
  for (const event of ["pointerenter", "focus", "pointerdown"])
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
