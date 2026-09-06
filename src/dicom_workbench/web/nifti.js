// Only reviewed, hash-pinned samples reach the public viewer. Local imports use a separate module.
const $ = (id) => document.getElementById(id);
let nv = null,
  graphics = null,
  generation = 0,
  renderTicket = 0,
  abort = null,
  timer,
  originalRange = [0, 1], panSpan = 200;
const axes = [2, 1, 0];
const viewControls = ["plane", "slice", "previous", "next", "zoom", "contrast", "fit", "reset", "pan-x", "pan-y"];
let handlers = {};
let comparison = null, anatomyState = null;
export const digest = async (bytes) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
export function clearComparison() {
  comparison = anatomyState = null;
  $("comparison").hidden = true;
  $("compare-view").value = "before";
  $("compare-context").textContent = $("compare-counts").textContent = "";
}
export function viewState() {
  return nv ? { plane: $("plane").value, crosshair: Array.from(nv.scene.crosshairPos), zoom: $("zoom").value, panX: $("pan-x").value, panY: $("pan-y").value, contrast: $("contrast").value, range: [...originalRange] } : {};
}
export async function setComparison(data, g, context) {
  comparison = data;
  anatomyState = { ...viewState(), plane: "2" };
  $("comparison").hidden = false;
  $("compare-view").value = "before";
  $("compare-context").textContent = context;
  const r = data.report;
  $("compare-counts").textContent = `${r.changed_voxels.toLocaleString()} of ${r.voxel_count.toLocaleString()} voxels changed. ${r.brain_mask_voxels_changed} of ${r.brain_mask_voxels.toLocaleString()} supplied brain-mask voxels changed; ${r.outside_selection_voxels_changed} changes outside the removal area. Manual review required.`;
  await switchComparison(g, true);
}
async function switchComparison(g = generation, initial = false) {
  if (!comparison) return;
  const key = $("compare-view").value;
  $("compare-help").textContent = {
    before: "Original anatomy before this proposed removal. Viewing it does not change the file.",
    after: "Proposed result: selected voxels are zero. Look for remaining facial features and unwanted tissue loss.",
    removal: "White marks every voxel selected for zeroing, including any that were already zero. Black marks the area left unchanged.",
    brain: "White marks the supplied brain mask: these voxels must stay unchanged. The mask itself still needs an independent anatomy check."
  }[key];
  const state = viewState();
  if (nv && !initial) anatomyState = { ...anatomyState, ...state, range: anatomyState.range, contrast: anatomyState.contrast };
  const data = comparison;
  const info = data.files[key];
  const isMask = key === "brain" || key === "removal";
  $("compare-view").disabled = true;
  status("Opening the selected comparison view…");
  handlers.comparison?.(null);
  const ready = await show(info.bytes, { ...data, summary: info.summary }, g,
    { ...anatomyState, range: isMask ? [0, 1] : anatomyState.range, contrast: isMask ? "100" : anatomyState.contrast });
  if (current(g) && comparison === data) {
    $("compare-view").disabled = false;
    if (ready) { status(`Comparison ready: ${$("compare-view").selectedOptions[0].textContent}. Slice, zoom and anatomy contrast are linked.`); handlers.comparison?.(key); }
  }
}
export const status = (text) => {
  $("status").textContent = text;
};
export function configure(next) {
  handlers = next;
}
export function current(g) {
  return generation === g;
}
function release() {
  if (!nv) return;
  const old = nv;
  nv = null;
  old.onLocationChange = () => {};
  old.cleanup();
  // NiiVue's gl getter throws when initialization failed. Keep our own reference
  // so that reporting unavailable graphics never fails during cleanup.
  graphics?.getExtension("WEBGL_lose_context")?.loseContext();
  graphics = null;
  old.volumes = [];
  $("canvas-host").replaceChildren();
}
export function clear(
  message = "Volume cleared. Choose another scan to begin.",
) {
  generation++;
  renderTicket++;
  abort?.abort();
  abort = null;
  clearTimeout(timer);
  release();
  clearComparison();
  $("volume-work").hidden = true;
  handlers.clear?.();
  status(message);
}
export function begin() {
  clear("Opening and checking the volume…");
  abort = new AbortController();
  touch();
  return { g: generation, signal: abort.signal };
}
function touch() {
  clearTimeout(timer);
  timer = setTimeout(
    () => clear("Volume expired after ten minutes without interaction."),
    600000,
  );
}
function position() {
  if (!nv?.volumes.length) return;
  const axis = axes[Number($("plane").value)],
    dims = nv.volumes[0].dimsRAS;
  const voxel = nv.frac2vox(nv.scene.crosshairPos);
  const index = Math.max(
    0,
    Math.min(dims[axis + 1] - 1, Math.round(voxel[axis])),
  );
  const labels = [
    ["R", "L", "A", "P"],
    ["R", "L", "S", "I"],
    ["A", "P", "S", "I"],
  ][Number($("plane").value)];
  for (const [i, side] of ["left", "right", "top", "bottom"].entries())
    document.querySelector(`.direction-${side}`).textContent = labels[i];
  $("plane-help").textContent =
    axis === 0
      ? "Side view: the front of the person is on the left. S means towards the head; I means towards the feet."
      : "Radiological view: the person's right (R) appears on the picture's left. A is front, P is back, S is towards the head and I towards the feet.";
  $("slice").max = dims[axis + 1] - 1;
  $("slice").value = index;
  $("slice-number").textContent = `${index + 1} of ${dims[axis + 1]}`;
  $("previous").disabled = index === 0;
  $("next").disabled = index === dims[axis + 1] - 1;
  const mm = Array.from(nv.frac2mm(nv.scene.crosshairPos).slice(0, 3), (v) =>
    Number(v).toFixed(1),
  );
  $("position").textContent =
    `${$("plane").selectedOptions[0].textContent} · slice ${index + 1} of ${dims[axis + 1]} · position ${mm.join(", ")} mm`;
}
function move(index) {
  if (!nv) return;
  const axis = axes[Number($("plane").value)];
  const delta = [0, 0, 0];
  delta[axis] = index - Math.round(nv.frac2vox(nv.scene.crosshairPos)[axis]);
  nv.moveCrosshairInVox(...delta);
  position();
}
function zoom() {
  const plane = Number($("plane").value), offset = [0, 0, 0, Number($("zoom").value) / 100];
  offset[plane === 2 ? 1 : 0] = Number($("pan-x").value) * panSpan / 100;
  offset[plane === 0 ? 1 : 2] = Number($("pan-y").value) * panSpan / 100;
  if (nv) nv.setPan2Dxyzmm(offset);
  $("zoom-number").textContent = `${$("zoom").value}%`;
  for (const axis of ["x", "y"]) $(`pan-${axis}-number`).textContent = `${$(`pan-${axis}`).value}%`;
}
function contrast() {
  if (!nv?.volumes.length) return;
  const middle = (originalRange[0] + originalRange[1]) / 2;
  const half =
    (((originalRange[1] - originalRange[0]) / 2) * 100) /
    Number($("contrast").value);
  nv.volumes[0].cal_min = middle - half;
  nv.volumes[0].cal_max = middle + half;
  nv.updateGLVolume();
  $("contrast-number").textContent = `${$("contrast").value}%`;
}
export async function show(buffer, info, g, state = {}) {
  const ticket = ++renderTicket;
  const valid = () => current(g) && ticket === renderTicket;
  for (const id of viewControls) $(id).disabled = true;
  $("canvas-host").setAttribute("aria-busy", "true");
  const { Niivue } = await import("./nifti-assets/niivue-0.69.0.js");
  if (!valid()) return false;
  release();
  $("volume-work").hidden = false;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    "MRI slice. Use the labelled viewing controls to explore the volume.",
  );
  canvas.tabIndex = -1;
  $("canvas-host").replaceChildren(canvas);
  for (const side of ["left", "right", "top", "bottom"]) {
    const label = document.createElement("span");
    label.className = `direction direction-${side}`;
    label.setAttribute("aria-hidden", "true");
    $("canvas-host").append(label);
  }
  const viewer = new Niivue({
    dragAndDropEnabled: false,
    logLevel: "silent",
    isRadiologicalConvention: true,
    sagittalNoseLeft: true,
    crosshairWidth: 1,
    crosshairColor: [1, 0.69, 0, 0.7],
    isOrientCube: false,
    isColorbar: false,
    textHeight: 0.035,
    forceDevicePixelRatio: 1,
  });
  nv = viewer;
  canvas.addEventListener("webglcontextlost", () => {
    if (nv === viewer)
      clear(
        "Graphics became unavailable. Clear and reopen the scan, or try another browser.",
      );
  });
  try {
    graphics = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (!graphics) throw Error("WebGL2 unavailable");
    await viewer.attachToCanvas(canvas, false);
    if (!valid()) return false;
    await viewer.loadFromArrayBuffer(buffer, "volume.nii");
    if (!valid()) {
      viewer.volumes = [];
      return false;
    }
    const header = viewer.volumes[0].hdr;
    const close = (a, b) => Number.isFinite(a) && Math.abs(a - b) <= 1e-4 * Math.max(1, Math.abs(b));
    if (!info.summary.display_affine.every((row, i) =>
      row.every((value, j) => close(header.affine[i][j], value))) ||
      ![header.scl_slope, header.scl_inter].every((value, i) =>
        close(value, info.summary.display_scaling[i]))) {
      clear("The viewer's orientation or brightness scaling did not match the checked file. This volume could not be displayed reliably; no export is enabled.");
      return false;
    }
    viewer.setSliceType(Number(state.plane ?? 0));
    viewer.onLocationChange = position;
    $("plane").value = state.plane ?? "0";
    $("zoom").value = state.zoom ?? "100";
    $("pan-x").value = state.panX ?? "0";
    $("pan-y").value = state.panY ?? "0";
    panSpan = Math.max(...info.summary.dimensions.map((n, i) => n * info.summary.spacing[i]));
    $("contrast").value = state.contrast ?? "100";
    originalRange = state.range ? [...state.range] : [viewer.volumes[0].cal_min, viewer.volumes[0].cal_max];
    if (!(originalRange[1] > originalRange[0]))
      originalRange[1] = originalRange[0] + 1;
    viewer.scene.crosshairPos = state.crosshair ?? [0.5, 0.5, 0.5];
    zoom();
    contrast();
    for (const id of viewControls) $(id).disabled = false;
    $("canvas-host").setAttribute("aria-busy", "false");
    position();
    $("volume-title").textContent = info.title;
    $("volume-notes").textContent = info.notes;
    const s = info.summary;
    $("volume-facts").textContent =
      `${s.dimensions.join(" × ")} voxels · ${s.spacing.map((v) => Number(v.toFixed(3))).join(" × ")} ${s.units} spacing · ${s.datatype} · axes ${s.orientation.join("/")}`;
    $("credit").replaceChildren();
    if (info.source) {
      const a = document.createElement("a");
      a.href = info.source;
      a.textContent = `${info.license} · ${info.credit} · Source`;
      a.rel = "noreferrer";
      $("credit").append(a);
    }
    status("Volume ready. Use the direction and slice controls to explore.");
    touch();
    return true;
  } catch {
    if (valid())
      clear(
        "The viewer could not open this volume. WebGL2 graphics are required; try a supported browser or a smaller scan.",
      );
    return false;
  }
}
async function sample(index) {
  const { g, signal } = begin();
  try {
    const response = await fetch("./nifti-assets/samples.json", { signal });
    if (!response.ok) throw Error();
    const samples = await response.json();
    const info = samples[index];
    if (!["brain-t1.nii.gz", "phantom.nii.gz"].includes(info.file))
      throw Error();
    const result = await fetch(`./nifti-assets/${info.file}`, { signal });
    if (!result.ok) throw Error();
    const bytes = await result.arrayBuffer();
    const hash = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    if (hash !== info.sha256) throw Error();
    if (!current(g)) return;
    if (handlers.sample) await handlers.sample(bytes, info, g, signal);
    else await show(bytes, info, g);
  } catch {
    if (current(g))
      clear("The sample could not be loaded or verified. Please try again.");
  }
}
$("brain").onclick = () => sample(0);
$("phantom").onclick = () => sample(1);
$("compare-view").onchange = () => switchComparison();
$("deface-demo").onclick = async () => {
  const { g, signal } = begin();
  try {
    const response = await fetch("./nifti-assets/deface-demo.json", { signal });
    if (!response.ok) throw Error();
    const data = await response.json();
    for (const key of ["before", "after", "removal", "brain"]) {
      const info = data.files[key];
      if (info.file !== `deface-${key}.nii.gz`) throw Error();
      const r = await fetch(`./nifti-assets/${info.file}`, { signal });
      if (!r.ok) throw Error();
      info.bytes = await r.arrayBuffer();
      if (await digest(info.bytes) !== info.sha256) throw Error();
    }
    if (!current(g)) return;
    if (handlers.defaceSample) await handlers.defaceSample(data, g, signal);
    else {
      if (!await show(data.files.before.bytes, { ...data, summary: data.files.before.summary }, g)) return;
      await setComparison(data, g, "Prepared public comparison, computed in advance. The atlas face region is only partly removed; this is a demonstration of limits, not a successful privacy certification.");
    }
  } catch {
    if (current(g)) clear("The comparison could not be loaded or verified. Please try again.");
  }
};
$("clear").onclick = () => clear();
$("plane").onchange = () => {
  nv?.setSliceType(Number($("plane").value));
  zoom();
  position();
};
$("slice").oninput = () => move(Number($("slice").value));
$("previous").onclick = () => move(Number($("slice").value) - 1);
$("next").onclick = () => move(Number($("slice").value) + 1);
$("zoom").oninput = zoom;
$("pan-x").oninput = $("pan-y").oninput = zoom;
$("contrast").oninput = () => {
  contrast();
  if (comparison && ["before", "after"].includes($("compare-view").value)) anatomyState.contrast = $("contrast").value;
};
$("fit").onclick = () => {
  $("zoom").value = "100";
  $("pan-x").value = $("pan-y").value = "0";
  zoom();
};
$("reset").onclick = () => {
  if (!nv) return;
  nv.scene.crosshairPos = [0.5, 0.5, 0.5];
  $("zoom").value = "100";
  $("pan-x").value = $("pan-y").value = "0";
  $("contrast").value = "100";
  if (anatomyState) anatomyState.contrast = "100";
  zoom();
  contrast();
  position();
};
for (const event of ["pointerdown", "keydown", "input"])
  document.addEventListener(event, touch, { passive: true });
for (const event of ["focusin", "pointerover", "click"])
  document.addEventListener(event, (e) => {
    const b = e.target.closest?.("button[title]");
    if (b) $("control-help").textContent = b.title;
  });
window.addEventListener("pagehide", () => clear());
if (!$("local-import")) {
  $("mode-label").textContent = "Public teaching volumes";
  status("Choose a public teaching volume. This demo accepts no file uploads.");
}
