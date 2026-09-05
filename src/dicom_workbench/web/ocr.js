// Pinned Tesseract 7 worker protocol adapter. Own the worker from creation so
// cancellation also terminates stalled engine/model loading, before SDK readiness.
// Receives pixels only: never a seed, metadata, recognised string or answer key.
let active = null;
export function cancelOCR() {
  active?.cancel();
}
export async function suggestText(
  canvas,
  { timeout = 30000, mode = "11" } = {},
) {
  if (active) throw new Error("A text search is already running.");
  if (
    !["6", "11"].includes(mode) ||
    !Number.isFinite(timeout) ||
    timeout < 1 ||
    timeout > 30000 ||
    !canvas.width ||
    !canvas.height ||
    canvas.width * canvas.height > 1704 * 1704
  )
    throw new Error("Unsupported text-search settings or picture size.");
  const base = new URL("./ocr-assets/", import.meta.url).href;
  const worker = new Worker(base + "worker.min.js"),
    pending = new Map();
  let stopped = false,
    count = 0,
    rejectStop;
  const stop = new Promise((_, reject) => {
    rejectStop = reject;
  });
  const halt = (message) => {
    if (stopped) return;
    stopped = true;
    worker.terminate();
    const error = new Error(message);
    for (const job of pending.values()) job.reject(error);
    pending.clear();
    rejectStop(error);
  };
  const cancel = () =>
    halt("Text search stopped. Coverage remains unresolved.");
  active = { cancel };
  worker.onerror = (event) => {
    event.preventDefault();
    halt("Text search failed. Coverage remains unresolved.");
  };
  worker.onmessage = ({ data: message }) => {
    const job = pending.get(message.jobId);
    if (!job) return;
    if (message.status === "resolve") {
      pending.delete(message.jobId);
      job.resolve(message.data);
    } else if (message.status === "reject")
      halt("Text search failed. Coverage remains unresolved.");
  };
  function call(action, payload) {
    if (stopped) return Promise.reject(new Error("Text search stopped."));
    const jobId = String(++count);
    return new Promise((resolve, reject) => {
      pending.set(jobId, { resolve, reject });
      worker.postMessage({ workerId: "local-ocr", jobId, action, payload });
    });
  }
  const started = performance.now(),
    timer = setTimeout(cancel, timeout);
  const work = (async () => {
    await call("load", {
      options: {
        lstmOnly: true,
        corePath: base + "tesseract-core-lstm.wasm.js",
        logging: false,
      },
    });
    await call("loadLanguage", {
      langs: ["eng"],
      options: {
        langPath: base,
        cacheMethod: "none",
        gzip: true,
        lstmOnly: true,
      },
    });
    await call("initialize", { langs: ["eng"], oem: 1, config: {} });
    await call("setParameters", {
      params: { tessedit_pageseg_mode: mode, user_defined_dpi: "150" },
    });
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Picture encoding failed."))),
        "image/png",
      ),
    );
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const data = await call("recognize", {
      image: bytes,
      options: {},
      output: { text: false, blocks: true },
    });
    const boxes = [];
    for (const block of data.blocks || [])
      for (const paragraph of block.paragraphs || [])
        for (const line of paragraph.lines || []) {
          const b = line.bbox;
          if (!b || ![b.x0, b.y0, b.x1, b.y1].every(Number.isFinite)) continue;
          const x = Math.max(0, Math.floor(b.x0) - 2),
            y = Math.max(0, Math.floor(b.y0) - 2);
          const right = Math.min(canvas.width, Math.ceil(b.x1) + 2),
            bottom = Math.min(canvas.height, Math.ceil(b.y1) + 2);
          if (right > x && bottom > y)
            boxes.push({ x, y, width: right - x, height: bottom - y });
        }
    return {
      boxes: boxes.slice(0, 32),
      truncated: boxes.length > 32,
      elapsed_ms: Math.round(performance.now() - started),
      engine: "tesseract.js-7.0.0/eng-best-int",
      mode,
      status: boxes.length ? "review_required" : "no_text_found_unresolved",
    };
  })();
  try {
    return await Promise.race([work, stop]);
  } finally {
    clearTimeout(timer);
    worker.terminate();
    pending.clear();
    active = null;
  }
}
