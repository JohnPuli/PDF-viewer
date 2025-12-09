import React, { useState } from "react";
import PdfPane from "./components/PdfPane";
import Sidebar from "./components/Sidebar";
import ChatPane from "./components/ChatPane";
import { extractMock, fetchMetadata } from "./services/mockApi";

export default function App() {
  const [fileUrl, setFileUrl] = useState("/detailed_extraction_layer_report.pdf");
  const [chunks, setChunks] = useState([]);
  const [selectedChunk, setSelectedChunk] = useState(null);

  // initial load: fetch template metadata (optional)
  React.useEffect(() => {
    (async () => {
      try {
        const meta = await fetchMetadata();
        setChunks(meta.chunks);
      } catch (e) {
        console.warn("fetchMetadata failed", e);
      }
    })();
  }, []);

  async function handleFileUpload(e) {
    const file = e?.target?.files?.[0];
    if (!file) return;
    // create blob url for viewer
    const blobUrl = URL.createObjectURL(file);
    setFileUrl(blobUrl);
    // simulate extraction
    const extracted = await extractMock(file);
    setChunks(extracted.chunks);
    setSelectedChunk(null);
  }

  async function handleSearch(query) {
    // optional: call search from mockApi
    // for now, just filter current chunks
    if (!query) {
      const meta = await fetchMetadata();
      setChunks(meta.chunks);
      return;
    }
    const q = query.toLowerCase();
    setChunks(prev => prev.filter(c => c.text.toLowerCase().includes(q)));
  }

  return (
    <div className="app">
      <div className="left-col">
        <div style={{ marginBottom: 12 }}>
          <input type="file" accept="application/pdf" onChange={handleFileUpload} />
        </div>

        <PdfPane fileUrl={fileUrl} selectedChunk={selectedChunk} />

        <Sidebar chunks={chunks} onSelectChunk={setSelectedChunk} onSearch={handleSearch} />
      </div>

      <div className="right-col">
        <ChatPane />
      </div>
    </div>
  );
}
