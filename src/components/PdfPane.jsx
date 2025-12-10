// src/components/PdfPane.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";

export default function PdfPane({
  fileUrl = "/detailed_extraction_layer_report.pdf",
  selectedChunk = null,
  onReady
}) {
  const containerRef = useRef(null);
  const [pageViews, setPageViews] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const rafPending = useRef(false);
  const latestSelected = useRef(selectedChunk);

  useEffect(() => {
    latestSelected.current = selectedChunk;
  }, [selectedChunk]);

  // load and render PDF
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        setError(null);
        setLoading(true);
        console.log("[PdfPane] loading PDF:", fileUrl);

        // quick HEAD check so we know if the file even exists
        const head = await fetch(fileUrl, { method: "HEAD" });
        if (!head.ok) {
          const msg = `PDF not found at ${fileUrl} (status ${head.status})`;
          console.error("[PdfPane]", msg);
          setError(msg);
          setLoading(false);
          return;
        }

        const pdfjsLib = await import("pdfjs-dist/build/pdf");
        // worker is served from public/pdf.worker.js (copied in postinstall)
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.js";

        const loadingTask = pdfjsLib.getDocument(fileUrl);
        const doc = await loadingTask.promise;
        if (cancelled) return;

        console.log("[PdfPane] PDF loaded, pages:", doc.numPages);

        const container = containerRef.current;
        container.innerHTML = "";
        const views = [];

        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const scale = 1.0;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.display = "block";
          const ctx = canvas.getContext("2d");

          await page.render({ canvasContext: ctx, viewport }).promise;

          const wrapper = document.createElement("div");
          wrapper.style.position = "relative";
          wrapper.style.marginBottom = "12px";
          wrapper.style.display = "flex";
          wrapper.style.justifyContent = "center";
          wrapper.dataset.pageNumber = i;
          wrapper.appendChild(canvas);
          container.appendChild(wrapper);

          views.push({ pageNumber: i, el: wrapper });
        }

        setPageViews(views);
        setLoading(false);
        if (onReady) onReady({ numPages: doc.numPages });
      } catch (err) {
        console.error("[PdfPane] error while loading/rendering PDF:", err);
        setError(String(err));
        setLoading(false);
      }
    }

    loadPdf();
    return () => {
      cancelled = true;
    };
  }, [fileUrl, onReady]);

  const computeRectsFromChunk = useCallback(
    (chunk) => {
      if (!chunk || pageViews.length === 0) return [];
      const view = pageViews.find((v) => v.pageNumber === chunk.page);
      if (!view) return [];
      const pageEl = view.el;
      const containerRect = containerRef.current.getBoundingClientRect();
      const pageRect = pageEl.getBoundingClientRect();
      const [nx0, ny0, nx1, ny1] = chunk.bbox_normalized;
      const left =
        pageRect.left - containerRect.left + nx0 * pageRect.width;
      const top =
        pageRect.top - containerRect.top + ny0 * pageRect.height;
      const width = Math.max(2, (nx1 - nx0) * pageRect.width);
      const height = Math.max(2, (ny1 - ny0) * pageRect.height);
      return [
        {
          id: chunk.chunk_id,
          left,
          top,
          width,
          height,
          page: chunk.page
        }
      ];
    },
    [pageViews]
  );

  const scheduleRecompute = useCallback(() => {
    if (rafPending.current) return;
    rafPending.current = true;
    requestAnimationFrame(() => {
      rafPending.current = false;
      const chunk = latestSelected.current;
      if (!chunk) {
        setHighlights([]);
        return;
      }
      const rects = computeRectsFromChunk(chunk);
      setHighlights(rects);
      if (rects.length) {
        const r = rects[0];
        const v = pageViews.find((pv) => pv.pageNumber === r.page);
        if (v && containerRef.current) {
          const pageEl = v.el;
          const container = containerRef.current;
          const pageTop = pageEl.offsetTop;
          const centerScroll = Math.max(
            0,
            pageTop -
              container.clientHeight / 2 +
              pageEl.clientHeight / 2
          );
          container.scrollTo({ top: centerScroll, behavior: "smooth" });
        }
      }
    });
  }, [computeRectsFromChunk, pageViews]);

  useEffect(() => {
    latestSelected.current = selectedChunk;
    scheduleRecompute();
  }, [selectedChunk, scheduleRecompute]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => {
      if (!latestSelected.current) return;
      scheduleRecompute();
    };
    const onResize = () => {
      if (!latestSelected.current) return;
      scheduleRecompute();
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(() => {
      if (!latestSelected.current) return;
      scheduleRecompute();
    });
    ro.observe(container);
    const mo = new MutationObserver(() => {
      if (!latestSelected.current) return;
      setTimeout(scheduleRecompute, 50);
    });
    mo.observe(container, { childList: true, subtree: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      mo.disconnect();
    };
  }, [scheduleRecompute]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="pdf-card">
        <div className="pdf-toolbar">
          <div className="title">PDF Viewer</div>
          <div className="controls">
            <div className="small">
              {loading ? "Loading…" : error ? "Error" : "Ready"}
            </div>
          </div>
        </div>

        <div className="pdf-viewer" style={{ position: "relative" }}>
          {error && (
            <div
              style={{
                padding: 12,
                background: "#fee",
                border: "1px solid #fbb",
                borderRadius: 6,
                margin: 12,
                color: "#600",
                zIndex: 10
              }}
            >
              <strong>PDF error:</strong>
              <div style={{ marginTop: 8 }}>{error}</div>
              <div style={{ marginTop: 8, fontSize: 12 }}>
                Check DevTools console for more details.
              </div>
            </div>
          )}

          <div
            ref={containerRef}
            style={{
              position: "relative",
              height: "calc(70vh - 48px)",
              overflow: "auto",
              padding: 12
            }}
          />

          {/* simple highlight overlay */}
          <div
            style={{
              position: "absolute",
              left: 12,
              top: 48,
              right: 12,
              bottom: 12,
              pointerEvents: "none"
            }}
          >
            {highlights.map((h) => (
              <div
                key={h.id}
                className="highlight"
                style={{
                  position: "absolute",
                  left: `${h.left}px`,
                  top: `${h.top}px`,
                  width: `${h.width}px`,
                  height: `${h.height}px`
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
