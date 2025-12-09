import React, { useState } from "react";

export default function Sidebar({ chunks = [], onSelectChunk = ()=>{}, onSearch = ()=>{} }) {
  const [query, setQuery] = useState("");

  return (
    <div className="chunk-card">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
        <div style={{fontWeight:700}}>Chunks</div>
        <form onSubmit={(e)=>{ e.preventDefault(); onSearch(query); }}>
          <input placeholder="Search" value={query} onChange={e=>setQuery(e.target.value)} style={{padding:6,borderRadius:6,border:'1px solid #e6e9f2'}} />
          <button className="btn" type="submit" style={{padding:'6px 10px', marginLeft:8}}>Search</button>
        </form>
      </div>

      <div>
        {chunks.length === 0 && <div style={{color:'#6b7280'}}>No chunks available</div>}
        {chunks.map((c, idx)=>(
          <div key={c.chunk_id} className="chunk-row" onClick={()=>onSelectChunk(c)}>
            <div className="chunk-id">{idx+1}</div>
            <div className="chunk-title">{c.text}</div>
            <div className="chunk-meta">Page {c.page}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
