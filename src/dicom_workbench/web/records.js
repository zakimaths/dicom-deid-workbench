import { BUILD } from "./build-info.js";
import { suggestText, cancelOCR } from "./ocr.js";
import {
  erase,
  verifyErase,
  validateRegions,
  equalBytes,
} from "./exercise-core.js";
import { withMetadata, parsePNG } from "./exercise-png.js";
const $ = (id) => document.getElementById(id);
let token,
  epoch = 0,
  busy = false,
  text = "",
  spans = [],
  manualSpans = [],
  manualBoxes = [],
  image = null,
  boxes = [],
  current = null,
  report = null,
  cleanBlob = null,
  timer;
const canvas = $("record-canvas"),
  ctx = canvas.getContext("2d", { willReadFrequently: true });
const say = (message) => {
  $("record-status").textContent = message;
};
function invalidate() {
  cleanBlob = report = null;
  $("review-privacy").checked = $("review-utility").checked = false;
  $("clean-text").value = "";
  $("record-measures").textContent = "";
  ready();
}
function ready() {
  const allowed =
    !!cleanBlob &&
    !busy &&
    $("review-privacy").checked &&
    $("review-utility").checked;
  $("record-save").disabled = $("record-report").disabled = !allowed;
}
function clear() {
  epoch++;
  cancelOCR();
  busy = false;
  text = "";
  spans = [];
  manualSpans = [];
  manualBoxes = [];
  image = current = null;
  boxes = [];
  invalidate();
  canvas.width = canvas.height = 0;
  $("record-overlays").width = $("record-overlays").height = 0;
  $("image-zoom").setAttribute("aria-pressed", "false");
  $("image-zoom").textContent = "Show full-size image";
  $("image-stage").style.maxWidth = "100%";
  $("text-removal-list").open = false;
  for (const id of ["source-text", "known-values", "record-file"])
    $(id).value = "";
  for (const id of ["text-work", "image-work", "record-export"])
    $(id).hidden = true;
  for (const id of [
    "record-notices",
    "record-selections",
    "image-boxes",
    "selection-summary",
  ])
    $(id).replaceChildren();
  setBusy(false);
  say("Record cleared. Choose another file or try the made-up report.");
}
function setBusy(value) {
  busy = value;
  for (const el of document.querySelectorAll("button,input,textarea")) {
    if (!["record-clear", "image-stop"].includes(el.id)) el.disabled = value;
  }
  ready();
}
async function work(fn) {
  if (busy) return;
  const ticket = epoch;
  setBusy(true);
  try {
    await fn(ticket);
  } catch {
    if (ticket === epoch) {
      invalidate();
      say(
        "Could not finish this step. Check the file or selection and try again.",
      );
    }
  } finally {
    if (ticket === epoch) setBusy(false);
  }
}
async function api(path, body, kind) {
  token ??= (await (await fetch("/api/session", { cache: "no-store" })).json())
    .token;
  const response = await fetch("/api/records/" + path, {
    method: "POST",
    cache: "no-store",
    headers: {
      "X-Workbench-Token": token,
      "Content-Type": kind ? "application/octet-stream" : "application/json",
      ...(kind ? { "X-Record-Kind": kind } : {}),
    },
    body: kind ? body : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error("Local processing failed.");
  return result;
}
function listSpans() {
  $("selection-summary").textContent =
    `${spans.length} proposed removals. Review the list, then apply.`;
  $("record-selections").replaceChildren();
  for (const [index, span] of spans.entries()) {
    const row = document.createElement("div");
    row.className = "selection-row";
    const label = document.createElement("span");
    label.textContent = `${index + 1}. ${span.category.replaceAll("_", " ")}: ${Array.from(text).slice(span.start, span.end).join("")}`;
    const remove = document.createElement("button");
    remove.textContent = `Keep passage ${index + 1}`;
    remove.title =
      "Leave these characters in the result. Check that they do not identify anyone.";
    remove.onclick = () => {
      manualSpans = manualSpans.filter(
        (s) =>
          s.start !== span.start ||
          s.end !== span.end ||
          s.category !== span.category,
      );
      spans.splice(index, 1);
      invalidate();
      listSpans();
    };
    row.append(label, remove);
    $("record-selections").append(row);
  }
}
function listBoxes() {
  outlineBoxes();
  $("image-boxes").replaceChildren();
  for (const [index, box] of boxes.entries()) {
    const row = document.createElement("div");
    row.className = "selection-row";
    const label = document.createElement("span");
    label.textContent = `Box ${index + 1}: left ${box.x}, top ${box.y}, ${box.width} × ${box.height} pixels`;
    const remove = document.createElement("button");
    remove.textContent = `Remove box ${index + 1}`;
    remove.title =
      "Remove this proposed rectangle and restore the original picture before applying again.";
    remove.onclick = () => {
      manualBoxes = manualBoxes.filter((b) => b !== box);
      boxes.splice(index, 1);
      invalidate();
      draw(image);
      listBoxes();
    };
    row.append(label, remove);
    $("image-boxes").append(row);
  }
}
function outlineBoxes(visible = true) {
  const overlay = $("record-overlays");
  overlay.width = canvas.width;
  overlay.height = canvas.height;
  const paint = overlay.getContext("2d");
  if (!visible) return;
  paint.strokeStyle = "#ffb000";
  paint.fillStyle = "#ffb000";
  paint.lineWidth = 2;
  paint.font = "16px sans-serif";
  boxes.forEach((box, index) => {
    paint.strokeRect(box.x, box.y, box.width, box.height);
    paint.fillText(
      String(index + 1),
      box.x + 3,
      Math.min(canvas.height - 2, box.y + 18),
    );
  });
}
$("image-zoom").onclick = () => {
  const full = $("image-zoom").getAttribute("aria-pressed") !== "true";
  $("image-zoom").setAttribute("aria-pressed", String(full));
  $("image-zoom").textContent = full
    ? "Fit image to screen"
    : "Show full-size image";
  $("image-stage").style.maxWidth = full ? "none" : "100%";
};
function draw(pixels) {
  current = pixels.slice();
  ctx.putImageData(new ImageData(current, canvas.width, canvas.height), 0, 0);
}
async function load(result, ticket) {
  if (ticket !== epoch) return;
  for (const notice of result.notices || []) {
    const p = document.createElement("p");
    p.textContent = notice;
    $("record-notices").append(p);
  }
  $("record-export").hidden = false;
  if (result.kind === "text") {
    text = result.text;
    $("source-text").value = text;
    $("text-work").hidden = false;
    listSpans();
    say("Text loaded. Suggest removals, then check for anything missed.");
  } else {
    const bytes = Uint8Array.from(atob(result.png), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(
      new Blob([bytes], { type: "image/png" }),
    );
    if (ticket !== epoch) {
      bitmap.close();
      return;
    }
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    $("image-stage").style.width = canvas.width + "px";
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    image = ctx.getImageData(0, 0, canvas.width, canvas.height).data.slice();
    current = image.slice();
    $("image-work").hidden = false;
    say(
      "Picture loaded. Inspect all visible details; text suggestions can miss labels.",
    );
  }
}
$("record-file").onchange = () => {
  const file = $("record-file").files[0];
  if (!file) return;
  clear();
  work(async (ticket) => {
    if (file.size > 8 * 1024 * 1024) throw new Error();
    say("Reading this file locally…");
    const result = await api(
      "import",
      file,
      file.name.split(".").at(-1).toLowerCase(),
    );
    await load(result, ticket);
  });
};
$("record-example").onclick = () => {
  clear();
  work((ticket) =>
    load(
      {
        kind: "text",
        text: "Patient: Alex Example\nDOB: 14/02/1970\nMRN: AB-458921\nEmail: alex@example.org\nAddress: 12 Example Road\n\nClinical note: No acute fracture. Follow-up imaging advised.\nDiscussed with Robin Sample today.",
        notices: [
          "Made-up practice record. The unlabelled name Robin Sample tests manual review.",
        ],
      },
      ticket,
    ),
  );
};
$("record-clear").onclick = clear;
$("known-values").oninput = invalidate;
$("record-detect").onclick = () =>
  work(async (ticket) => {
    if (!text) return;
    invalidate();
    say("Finding likely identifiers…");
    const result = await api("detect", {
      text,
      known: $("known-values")
        .value.split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    if (ticket !== epoch) return;
    spans = [
      ...new Map(
        [...result.spans, ...manualSpans].map((s) => [
          `${s.start}:${s.end}:${s.category}`,
          s,
        ]),
      ).values(),
    ];
    listSpans();
    $("text-removal-list").open = true;
    say(
      "Suggestions ready. Check every passage and add any missed names or details.",
    );
  });
$("record-select").onclick = () => {
  const input = $("source-text");
  // Browser textarea positions use UTF-16; API uses Unicode code points.
  const start = Array.from(text.slice(0, input.selectionStart)).length;
  const end = Array.from(text.slice(0, input.selectionEnd)).length;
  if (start === end) return say("Select a passage in the original text first.");
  if (spans.length >= 10000)
    return say("The maximum number of selections has been reached.");
  const span = { start, end, category: "other_identifier" };
  spans.push(span);
  manualSpans.push(span);
  invalidate();
  listSpans();
  $("text-removal-list").open = true;
};
$("record-reset").onclick = () => {
  spans = [];
  manualSpans = [];
  invalidate();
  listSpans();
};
$("record-apply").onclick = () =>
  work(async (ticket) => {
    invalidate();
    const result = await api("scrub", { text, spans });
    if (ticket !== epoch) return;
    $("clean-text").value = result.text;
    cleanBlob = new Blob([result.text], { type: "text/plain;charset=utf-8" });
    report = {
      ...result.report,
      mode: "text",
      manual_selections: manualSpans.length,
      known_identifiers_supplied: $("known-values")
        .value.split("\n")
        .filter((s) => s.trim()).length,
      document_container_exported: false,
    };
    $("record-measures").textContent =
      `${report.selections} selections; ${report.redacted_characters} characters selected. Replacement and preservation checks passed. Accuracy is not measured without an answer key.`;
    say(
      "Text replacements checked. Read the complete result before ticking the review boxes.",
    );
  });
$("image-add").onclick = () => {
  try {
    const box = Object.fromEntries(
      ["x", "y", "w", "h"].map((key, i) => [
        ["x", "y", "width", "height"][i],
        Number($("box-" + key).value),
      ]),
    );
    validateRegions([...boxes, box], canvas.width, canvas.height);
    boxes.push(box);
    manualBoxes.push(box);
    invalidate();
    draw(image);
    listBoxes();
  } catch {
    say(
      "Choose a whole-pixel rectangle inside the image, with positive width and height; up to 32 rectangles.",
    );
  }
};
$("image-ocr").onclick = () =>
  work(async (ticket) => {
    invalidate();
    draw(image);
    say("Looking for text on this computer…");
    const result = await suggestText(canvas);
    if (ticket !== epoch) return;
    boxes = [...manualBoxes, ...result.boxes].slice(0, 32);
    listBoxes();
    say(
      result.truncated || manualBoxes.length + result.boxes.length > 32
        ? "Only the first 32 suggestions are shown. Check the whole image for missed text."
        : `${boxes.length} proposed text boxes. Review them before applying; zero boxes does not establish anonymity.`,
    );
  });
$("image-stop").onclick = cancelOCR;
$("image-reset").onclick = () => {
  boxes = [];
  manualBoxes = [];
  invalidate();
  draw(image);
  listBoxes();
  say("Original picture restored.");
};
$("image-apply").onclick = () =>
  work(async (ticket) => {
    invalidate();
    const next = boxes.length
      ? erase(image, canvas.width, canvas.height, boxes)
      : image.slice();
    draw(next);
    outlineBoxes(false);
    const raw = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!raw) throw new Error();
    const bytes = withMetadata(new Uint8Array(await raw.arrayBuffer()), {});
    if (
      parsePNG(bytes).some((c) =>
        ["tEXt", "zTXt", "iTXt", "eXIf"].includes(c.type),
      )
    )
      throw new Error();
    const blob = new Blob([bytes], { type: "image/png" });
    const bitmap = await createImageBitmap(blob);
    if (ticket !== epoch) {
      bitmap.close();
      return;
    }
    const verify = document.createElement("canvas");
    verify.width = canvas.width;
    verify.height = canvas.height;
    const context = verify.getContext("2d", { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const reopened = context.getImageData(
      0,
      0,
      verify.width,
      verify.height,
    ).data;
    const checks = boxes.length
      ? verifyErase(image, reopened, canvas.width, canvas.height, boxes)
      : {
          selected_pixels: 0,
          unchanged_outside_pixels: canvas.width * canvas.height,
        };
    if (!equalBytes(next, reopened)) throw new Error();
    const digest = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    if (ticket !== epoch) return;
    report = {
      schema: 1,
      app_version: BUILD.version,
      policy: "hospital-image-review-v1",
      mode: "image",
      ...checks,
      rectangles: boxes.length,
      manual_rectangles: manualBoxes.length,
      output_sha256: digest,
      metadata: "removed",
      saved_pixels_verified: true,
      anonymity: "not_established",
      automatic_recall: "not_measured_without_answer_key",
    };
    cleanBlob = blob;
    $("record-measures").textContent =
      `${checks.selected_pixels} selected pixels; saved PNG reopened and verified. Visible identifiers and anatomy still need your review.`;
    say(
      "Image replacements checked. Inspect the whole result before ticking the review boxes.",
    );
  });
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportAllowed() {
  return (
    cleanBlob &&
    report &&
    !busy &&
    $("review-privacy").checked &&
    $("review-utility").checked
  );
}
$("record-save").onclick = () => {
  if (exportAllowed())
    download(
      cleanBlob,
      report.mode === "text" ? "reviewed-record.txt" : "reviewed-image.png",
    );
};
$("record-report").onclick = () => {
  if (exportAllowed())
    download(
      new Blob(
        [
          JSON.stringify(
            {
              ...report,
              status: "reviewer_acknowledged",
              privacy_review_acknowledged: true,
              utility_review_acknowledged: true,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      "processing-report.json",
    );
};
for (const id of ["review-privacy", "review-utility"]) $(id).onchange = ready;
function touch() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    clear();
    say("Record cleared after 10 minutes of inactivity.");
  }, 600000);
}
for (const event of ["pointerdown", "keydown", "input"])
  document.addEventListener(event, touch, { passive: true });
window.addEventListener("pagehide", () => {
  clear();
  clearTimeout(timer);
});
touch();
