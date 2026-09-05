// Published teaching pictures have their own viewer, never a DICOM export path.
const $ = (id) => document.getElementById(id);
const dialog = $("teaching-dialog");
let opening = 0;
let collection,
  selected,
  visible = [],
  revision = 0,
  controller,
  objectURL;
const defaults =
  "Hover over a button or focus it with the keyboard for an explanation.";
function help(button, text) {
  button.title = text;
  const description = document.createElement("span");
  description.hidden = true;
  description.id = `${button.id}-description`;
  description.textContent = text;
  button.after(description);
  button.setAttribute("aria-describedby", description.id);
  for (const event of ["pointerenter", "focus"])
    button.addEventListener(event, () => {
      $("teaching-help").textContent = text;
    });
  for (const event of ["pointerleave", "blur"])
    button.addEventListener(event, () => {
      const active =
        dialog.querySelector("button:hover") ||
        dialog.querySelector("button:focus");
      $("teaching-help").textContent = active?.title || defaults;
    });
}
for (const button of dialog.querySelectorAll("button[data-help]"))
  help(button, button.dataset.help);
$("browse-teaching").title = $("teaching-open-help").textContent;
function setStatus(text) {
  $("teaching-status").textContent = text;
}
function resetView() {
  for (const name of ["brightness", "contrast"]) {
    $("teaching-" + name).value = "100";
    $("teaching-" + name + "-value").textContent = "100%";
  }
  $("teaching-image").style.filter = "none";
  $("teaching-stage").classList.remove("actual-size");
  $("teaching-zoom").textContent = "Actual size";
}
function disposeImage() {
  revision++;
  controller?.abort();
  $("teaching-image").hidden = true;
  $("teaching-image").removeAttribute("src");
  if (objectURL) URL.revokeObjectURL(objectURL);
  objectURL = null;
}
function updateNavigation() {
  const index = visible.findIndex((item) => item.id === selected?.id);
  $("teaching-prev").disabled = index <= 0;
  $("teaching-next").disabled = index < 0 || index >= visible.length - 1;
}
async function choose(item) {
  disposeImage();
  selected = item;
  const thisRevision = revision;
  controller = new AbortController();
  resetView();
  const view = dialog.querySelector(".teaching-view");
  view.setAttribute("aria-busy", "true");
  $("teaching-title").textContent = item.title;
  $("teaching-kind").textContent = `${item.modality} · ${item.anatomy}`;
  $("teaching-plane").textContent = item.view;
  $("teaching-look").textContent = item.look_for;
  $("teaching-context").textContent = item.context;
  $("teaching-credit").textContent =
    `${item.author} · ${item.license} · ${item.width} × ${item.height} pixels. ${item.changes}`;
  $("teaching-source").href = item.source_url;
  $("teaching-license").href = item.license_url;
  $("teaching-image").alt = `${item.modality}: ${item.title}. ${item.view}.`;
  for (const card of $("teaching-cards").querySelectorAll("button"))
    card.setAttribute("aria-pressed", String(card.dataset.id === item.id));
  updateNavigation();
  history.replaceState(null, "", `#learn=${item.id}`);
  setStatus("Opening the teaching image…");
  $("teaching-zoom").disabled = true;
  try {
    const response = await fetch(
      new URL(`./teaching/${item.file}`, import.meta.url),
      { signal: controller.signal, credentials: "omit", cache: "force-cache" },
    );
    if (!response.ok)
      throw new Error(
        "This picture could not be loaded. Select it again to retry.",
      );
    const bytes = await response.arrayBuffer();
    const digest = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (n) => n.toString(16).padStart(2, "0"),
    ).join("");
    if (digest !== item.sha256)
      throw new Error(
        "The picture failed its file check. Reload the page to try again.",
      );
    if (thisRevision !== revision) return;
    const url = URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" }));
    objectURL = url;
    const probe = new Image();
    probe.src = url;
    await probe.decode();
    if (thisRevision !== revision) return;
    if (
      probe.naturalWidth !== item.width ||
      probe.naturalHeight !== item.height
    )
      throw new Error("The picture size does not match its catalogue entry.");
    $("teaching-image").src = url;
    $("teaching-image").hidden = false;
    $("teaching-zoom").disabled = false;
    setStatus(
      `${item.width} × ${item.height} · published scan image · original display contrast`,
    );
  } catch (error) {
    if (thisRevision !== revision) return;
    disposeImage();
    view.setAttribute("aria-busy", "false");
    setStatus(
      error.message || "The picture could not be opened. Please try again.",
    );
  } finally {
    if (thisRevision === revision) view.setAttribute("aria-busy", "false");
  }
}
function filter() {
  const search = $("teaching-search").value.trim().toLowerCase();
  const modality = $("teaching-filter").value;
  visible = collection.filter(
    (item) =>
      (modality === "all" || item.modality === modality) &&
      `${item.title} ${item.anatomy} ${item.view} ${item.look_for}`
        .toLowerCase()
        .includes(search),
  );
  $("teaching-count").textContent = visible.length
    ? `${visible.length} of ${collection.length} images`
    : "No matches. Try a body part such as knee, or choose All scan types.";
  $("teaching-cards").replaceChildren();
  for (const item of visible) {
    const button = document.createElement("button");
    button.id = `teaching-card-${item.id}`;
    button.type = "button";
    button.className = "teaching-card";
    button.dataset.id = item.id;
    button.setAttribute("aria-pressed", String(item.id === selected?.id));
    const img = document.createElement("img");
    img.src = new URL(`./teaching/${item.thumbnail}`, import.meta.url);
    img.alt = "";
    img.loading = "lazy";
    img.width = 160;
    img.height = 110;
    const title = document.createElement("span");
    title.textContent = item.title;
    const type = document.createElement("small");
    type.textContent = item.modality;
    button.append(img, title, type);
    button.onclick = () => {
      choose(item);
      if (matchMedia("(max-width: 760px)").matches) {
        $("teaching-title").focus({ preventScroll: true });
        $("teaching-title").scrollIntoView({ block: "start" });
      }
    };
    $("teaching-cards").append(button);
    help(
      button,
      `Open ${item.title.toLowerCase()}. ${item.view}. Read the study note beside the larger picture.`,
    );
  }
  updateNavigation();
  // Filtering does not silently replace a picture someone is studying.
}
function validate(items) {
  if (
    !Array.isArray(items) ||
    items.length !== 50 ||
    new Set(items.map((i) => i.id)).size !== 50
  )
    throw new Error("The teaching catalogue is incomplete.");
  for (const item of items) {
    if (
      !/^[a-z0-9-]+$/.test(item.id) ||
      item.file !== `${item.id}.jpg` ||
      item.thumbnail !== `${item.id}-thumb.jpg` ||
      !/^[a-f0-9]{64}$/.test(item.sha256) ||
      !["MRI", "CT", "X-ray"].includes(item.modality)
    )
      throw new Error("The teaching catalogue is invalid.");
    if (
      new URL(item.source_url).origin !== "https://commons.wikimedia.org" ||
      new URL(item.license_url).origin !== "https://creativecommons.org"
    )
      throw new Error("An image source is invalid.");
  }
  return items;
}
async function openLibrary() {
  const ticket = ++opening;
  if (!dialog.open) dialog.showModal();
  try {
    if (!collection) {
      const response = await fetch(
        new URL("./teaching/catalog.json", import.meta.url),
        { credentials: "omit" },
      );
      if (!response.ok)
        throw new Error(
          "The library could not be loaded. Close it and try again.",
        );
      const data = validate(await response.json());
      if (ticket !== opening || !dialog.open) return;
      collection = data;
      $("teaching-search").value = "";
      $("teaching-filter").value = "all";
      filter();
    }
    if (ticket !== opening || !dialog.open) return;
    const requested = location.hash.match(/^#learn=([a-z0-9-]+)$/)?.[1];
    await choose(
      collection.find((item) => item.id === requested) ||
        selected ||
        collection[0],
    );
  } catch (error) {
    if (ticket === opening && dialog.open) setStatus(error.message);
  }
}
$("browse-teaching").onclick = openLibrary;
$("teaching-close").onclick = () => dialog.close();
dialog.addEventListener("close", () => {
  opening++;
  disposeImage();
  if (location.hash.startsWith("#learn="))
    history.replaceState(null, "", location.pathname + location.search);
  $("browse-teaching").focus();
});
$("teaching-find").onclick = () => {
  $("teaching-search").focus();
  $("teaching-search").scrollIntoView({ block: "start" });
};
$("teaching-search").oninput = () => {
  if (collection) filter();
};
$("teaching-filter").onchange = () => {
  if (collection) filter();
};
$("teaching-prev").onclick = () => {
  const index = visible.indexOf(selected);
  if (index > 0) choose(visible[index - 1]);
};
$("teaching-next").onclick = () => {
  const index = visible.indexOf(selected);
  if (index >= 0 && index < visible.length - 1) choose(visible[index + 1]);
};
$("teaching-reset").onclick = resetView;
$("teaching-zoom").onclick = () => {
  const actual = $("teaching-stage").classList.toggle("actual-size");
  $("teaching-zoom").textContent = actual ? "Fit whole image" : "Actual size";
};
for (const name of ["brightness", "contrast"])
  $("teaching-" + name).oninput = () => {
    $("teaching-" + name + "-value").textContent =
      $("teaching-" + name).value + "%";
    $("teaching-image").style.filter =
      `brightness(${$("teaching-brightness").value}%) contrast(${$("teaching-contrast").value}%)`;
    setStatus(
      "Display adjusted. Reset view restores the publisher’s contrast.",
    );
  };
$("teaching-share").onclick = async () => {
  if (!selected) return;
  const url = new URL("https://zakimaths.github.io/dicom-deid-workbench/");
  url.hash = `learn=${selected.id}`;
  try {
    await navigator.clipboard.writeText(url.href);
    setStatus(
      "Public image link copied. Paste it into your notes or a message.",
    );
  } catch {
    setStatus(`Copy this public image link: ${url.href}`);
  }
};
if (location.hash.startsWith("#learn=")) openLibrary();
window.addEventListener("hashchange", () => {
  if (location.hash.startsWith("#learn=")) openLibrary();
});
