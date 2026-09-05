// Only reviewed, hash-pinned samples reach the public viewer. Local imports use a separate module.
const $ = (id) => document.getElementById(id);
let nv = null,
  graphics = null,
  generation = 0,
  abort = null,
  timer,
  originalRange = [0, 1];
const axes = [2, 1, 0];
let handlers = {};
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
  abort?.abort();
  abort = null;
  clearTimeout(timer);
  release();
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
  if (nv) nv.setPan2Dxyzmm([0, 0, 0, Number($("zoom").value) / 100]);
  $("zoom-number").textContent = `${$("zoom").value}%`;
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
export async function show(buffer, info, g) {
  const { Niivue } = await import("./nifti-assets/niivue-0.69.0.js");
  if (!current(g)) return false;
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
    graphics = canvas.getContext("webgl2", { alpha: true, antialias: false });
    if (!graphics) throw Error("WebGL2 unavailable");
    await viewer.attachToCanvas(canvas, false);
    if (!current(g)) return false;
    await viewer.loadFromArrayBuffer(buffer, "volume.nii");
    if (!current(g)) {
      viewer.volumes = [];
      return false;
    }
    viewer.setSliceType(0);
    viewer.onLocationChange = position;
    $("plane").value = "0";
    $("zoom").value = "100";
    $("contrast").value = "100";
    originalRange = [viewer.volumes[0].cal_min, viewer.volumes[0].cal_max];
    if (!(originalRange[1] > originalRange[0]))
      originalRange[1] = originalRange[0] + 1;
    viewer.scene.crosshairPos = [0.5, 0.5, 0.5];
    zoom();
    contrast();
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
    if (current(g))
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
$("clear").onclick = () => clear();
$("plane").onchange = () => {
  nv?.setSliceType(Number($("plane").value));
  position();
};
$("slice").oninput = () => move(Number($("slice").value));
$("previous").onclick = () => move(Number($("slice").value) - 1);
$("next").onclick = () => move(Number($("slice").value) + 1);
$("zoom").oninput = zoom;
$("contrast").oninput = contrast;
$("fit").onclick = () => {
  $("zoom").value = "100";
  zoom();
};
$("reset").onclick = () => {
  if (!nv) return;
  nv.scene.crosshairPos = [0.5, 0.5, 0.5];
  $("zoom").value = "100";
  $("contrast").value = "100";
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
