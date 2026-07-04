import { useState, useRef, useCallback } from "react";
import {
  Sparkles, Plus, LayoutDashboard, FileText, LayoutTemplate, Trash2,
  ScanLine, Wand2, Table as TableIcon, PenTool, Settings, HelpCircle,
  Undo2, Redo2, Share2, Download, ChevronDown, Crop, RotateCw, Sun, SlidersHorizontal,
  RefreshCw, Calendar, Check, Minus, Maximize2, ChevronLeft, ChevronRight, Pencil, Send,
} from "lucide-react";

// ================= data =================
const DEFAULT_DOC = {
  title: "Meeting Notes", date: "June 1, 2025", tag: "Project Meeting",
  sections: [
    { id: "s1", kind: "list", heading: "Agenda", items: ["Discuss Q2 progress", "Budget update"] },
    { id: "s2", kind: "table", heading: "Budget Update", columns: ["Category", "Amount (USD)"],
      rows: [["Marketing", "$4,000"], ["Development", "$12,500"], ["Operations", "$2,300"], ["Total", "$18,800"]], totalRow: true },
    { id: "s3", kind: "numbered", heading: "Action Items", items: ["Review timeline", "Client feedback", "Finalize report"] },
    { id: "s4", kind: "callout", heading: "Next Meeting", lines: ["June 15, 2025"] },
  ],
};

const COLORS = [
  { id: "indigo", hex: "#6D28D9" }, { id: "blue", hex: "#2563EB" }, { id: "green", hex: "#10B981" },
  { id: "orange", hex: "#F59E0B" }, { id: "red", hex: "#EF4444" }, { id: "slate", hex: "#475569" },
];
const FONTS = ["Poppins", "Inter", "Source Serif 4", "Playfair Display", "IBM Plex Mono", "Space Grotesk"];
const TEMPLATES = [
  { id: "aurora", label: "Aurora", accent: "#6D28D9", header: "modern", corner: "square", font: "Poppins" },
  { id: "mint", label: "Mint", accent: "#10B981", header: "classic", corner: "soft", font: "Inter" },
  { id: "sand", label: "Sand", accent: "#D97706", header: "classic", corner: "rounded", font: "Source Serif 4" },
  { id: "onyx", label: "Onyx", accent: "#111827", header: "modern", corner: "square", font: "Space Grotesk" },
];
const DEFAULT_DESIGN = { accent: "#6D28D9", font: "Poppins", size: 12, layout: "balanced", header: "modern", margins: 1, corner: "square" };
const SKINS = [{ id: "violet", label: "Violet", dot: "#6D28D9" }, { id: "ocean", label: "Ocean", dot: "#0E7490" }, { id: "midnight", label: "Midnight", dot: "#1c2333" }];

const ORGANIZE_PROMPT = `You are a document organizer. Read this photo and return ONLY JSON (no fences):
{"title":"...","date":"","tag":"","sections":[{"kind":"list|numbered|table|callout|para","heading":"...","items":["..."],"columns":["..."],"rows":[["..."]],"totalRow":false,"lines":["..."],"text":"..."}]}
Use only the fields each kind needs. Transcribe table numbers exactly; totalRow:true if last row is a total. Valid JSON only.`;

// ================= utils =================
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgba = (h, a) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; };
const dark = (h, f) => { const [r, g, b] = rgb(h); return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`; };
const RADII = { square: "3px", rounded: "9px", soft: "16px" };
const GAPS = { compact: 0.72, balanced: 1, spacious: 1.4 };
const PADS = ["28px", "40px", "56px"];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
function docVars(d) {
  return { "--ac": d.accent, "--ac-weak": rgba(d.accent, 0.1), "--ac-mid": rgba(d.accent, 0.18), "--ac-strong": dark(d.accent, 0.72),
    "--dfont": `'${d.font}'`, "--dsize": `${d.size * 1.25}px`, "--gap": GAPS[d.layout], "--radius": RADII[d.corner], "--pad": PADS[d.margins] };
}
function sanitize(p = {}) {
  const o = {};
  if (typeof p.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(p.accent)) o.accent = p.accent;
  if (FONTS.includes(p.font)) o.font = p.font;
  if (["modern", "classic", "minimal"].includes(p.header)) o.header = p.header;
  if (["compact", "balanced", "spacious"].includes(p.layout)) o.layout = p.layout;
  if (["square", "rounded", "soft"].includes(p.corner)) o.corner = p.corner;
  if (Number.isInteger(p.margins) && p.margins >= 0 && p.margins <= 2) o.margins = p.margins;
  if (typeof p.size === "number") o.size = Math.max(10, Math.min(18, Math.round(p.size)));
  return o;
}

// ================= app =================
export default function App() {
  const [doc, setDoc] = useState(null);
  const [past, setPast] = useState([]); const [future, setFuture] = useState([]);
  const [design, setDesign] = useState(DEFAULT_DESIGN);
  const [skin, setSkin] = useState("violet");
  const [image, setImage] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  // chat
  const [chat, setChat] = useState([]); const [remaining, setRemaining] = useState(3);
  const [input, setInput] = useState(""); const [thinking, setThinking] = useState(false);
  const fileRef = useRef(null);

  const commit = (next) => { setPast((p) => [...p, doc]); setFuture([]); setDoc(next); };
  const undo = () => { if (!past.length) return; setFuture((f) => [doc, ...f]); setDoc(past[past.length - 1]); setPast((p) => p.slice(0, -1)); };
  const redo = () => { if (!future.length) return; setPast((p) => [...p, doc]); setDoc(future[0]); setFuture((f) => f.slice(1)); };
  const setD = (patch) => setDesign((s) => ({ ...s, ...patch }));
  const useTemplate = (t) => setDesign((s) => ({ ...s, accent: t.accent, header: t.header, corner: t.corner, font: t.font }));
  const apply = () => { setApplied(true); setTimeout(() => setApplied(false), 1400); };

  const onFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => { const img = new Image(); img.onload = () => {
      const sc = Math.min(1, 1500 / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      const url = c.toDataURL("image/jpeg", 0.85);
      const b64 = url.split(",")[1]; setImage({ dataUrl: url, base64: b64 }); organize(b64);
    }; img.src = e.target.result; };
    reader.readAsDataURL(file);
  }, [doc]);

  const organize = async (base64) => {
    setBusy(true);
    try {
      const res = await fetch("/.netlify/functions/organize", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mediaType: "image/jpeg" }) });
      const data = await res.json();
      const txt = (data.result || "").replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(txt); parsed.sections = (parsed.sections || []).map((s, i) => ({ ...s, id: "u" + i }));
      commit(parsed);
    } catch { /* keep current */ } setBusy(false);
  };

  const rotateImage = () => {
    if (!image) return;
    const img = new Image();
    img.onload = () => {
      const w = img.width, h = img.height;
      const c = document.createElement("canvas");
      c.width = h; c.height = w;
      const ctx = c.getContext("2d");
      ctx.translate(h / 2, w / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -w / 2, -h / 2);
      const url = c.toDataURL("image/jpeg", 0.85);
      setImage({ dataUrl: url, base64: url.split(",")[1] });
    };
    img.src = image.dataUrl;
  };

  const sendChat = async () => {
    const q = input.trim(); if (!q || remaining <= 0 || thinking) return;
    setChat((c) => [...c, { role: "user", text: q }]); setInput(""); setThinking(true);
    const sys = `You turn a plain-language look request into document design settings. Current settings: ${JSON.stringify(design)}. Allowed values — font: one of ${FONTS.join(", ")}; header: modern|classic|minimal; layout: compact|balanced|spacious; corner: square|rounded|soft; margins: 0 (tight) | 1 (normal) | 2 (wide); size: 10-18; accent: any hex like "#1e3a8a". The document is titled "${doc?.title || "an untitled document"}". User request: "${q}". Respond ONLY with JSON: {"reply":"one short friendly sentence","design":{ only the fields to change }}.`;
    try {
      const res = await fetch("/.netlify/functions/customize", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: sys }) });
      const data = await res.json();
      const txt = (data.result || "").replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(txt); const clean = sanitize(parsed.design || {});
      setD(clean);
      const changed = Object.keys(clean).length;
      setChat((c) => [...c, { role: "ai", text: parsed.reply || (changed ? "Done — updated the look." : "I couldn't map that to a setting. Try naming a color, font, spacing, or header.") }]);
    } catch {
      setChat((c) => [...c, { role: "ai", text: "That one didn't land — try describing a color, font, spacing, or header style." }]);
    }
    setRemaining((n) => n - 1); setThinking(false);
  };

  const addSuggestion = (kind) => {
    if (!doc) return;
    const id = "sg" + Date.now();
    const map = {
      exec: { id, kind: "para", heading: "Executive Summary", text: "The team reviewed Q2 progress and approved a total budget of $18,800 across marketing, development, and operations. Three action items were assigned, with a follow-up on June 15." },
      takeaways: { id, kind: "list", heading: "Key Takeaways", items: ["Q2 is on track pending budget sign-off.", "Development is the largest line at $12,500.", "Timeline review is the priority action."] },
      attendees: { id, kind: "list", heading: "Attendees", items: ["Fazal Rehman (chair)", "Project team", "Finance lead"] },
    };
    const s = map[kind];
    commit(kind === "exec" ? { ...doc, sections: [s, ...doc.sections] } : { ...doc, sections: [...doc.sections, s] });
  };

  return (
    <div className={"pw skin-" + skin}>
      <style>{CSS}</style>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />

      {/* sidebar */}
      <aside className="side">
        <div className="brand">
          <div className="brand-ic"><Sparkles size={20} /></div>
          <div><div className="brand-n">PaperWise AI</div><div className="brand-s">From Paper to Perfect Documents</div></div>
        </div>
        <button className="newscan" onClick={() => fileRef.current?.click()}><Plus size={18} /> New Scan</button>
        <nav className="nav">
          <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active />
          <NavItem icon={<FileText size={18} />} label="My Documents" />
          <NavItem icon={<LayoutTemplate size={18} />} label="Templates" />
          <NavItem icon={<Trash2 size={18} />} label="Trash" />
          <div className="nav-h">Tools</div>
          <NavItem icon={<ScanLine size={18} />} label="Scan & Upload" onClick={() => fileRef.current?.click()} />
          <NavItem icon={<Wand2 size={18} />} label="AI Organize" />
          <NavItem icon={<TableIcon size={18} />} label="Accounting Sheet" />
          <NavItem icon={<PenTool size={18} />} label="Drawing to Doc" />
          <div className="nav-h">Account</div>
          <NavItem icon={<Settings size={18} />} label="Settings" />
          <NavItem icon={<HelpCircle size={18} />} label="Help & Support" />
        </nav>
        <div className="appearance">
          <div className="app-k">Appearance</div>
          <div className="skins">
            {SKINS.map((s) => (
              <button key={s.id} className={"skinbtn " + (skin === s.id ? "on" : "")} onClick={() => setSkin(s.id)}>
                <span className="skin-dot" style={{ background: s.dot }} />{s.label}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* main */}
      <main className="main">
        <header className="top">
          <div className="top-title">
            {doc ? (
              editingTitle ? (
                <input className="title-in" autoFocus value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} onBlur={() => setEditingTitle(false)} onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)} />
              ) : (<><h1>{doc.title || "Untitled"}</h1><button className="ic-btn" onClick={() => setEditingTitle(true)}><Pencil size={15} /></button></>)
            ) : (<h1 className="untitled">New document</h1>)}
            {doc && <span className="saved"><Check size={14} /> All changes saved</span>}
          </div>
          <div className="top-actions">
            <button className="ic-btn" onClick={undo} disabled={!past.length}><Undo2 size={17} /></button>
            <button className="ic-btn" onClick={redo} disabled={!future.length}><Redo2 size={17} /></button>
            <button className="btn-ghost"><Share2 size={15} /> Share</button>
            <div className="export-wrap">
              <button className="btn-primary" onClick={() => setExportOpen((o) => !o)} disabled={!doc}><Download size={15} /> Export <ChevronDown size={14} /></button>
              {exportOpen && (
                <div className="menu" onMouseLeave={() => setExportOpen(false)}>
                  <button onClick={() => { window.print(); setExportOpen(false); }}>PDF (print)</button>
                  <button onClick={() => { exportHtml(doc, design); setExportOpen(false); }}>Styled HTML</button>
                  <button onClick={() => { exportMd(doc); setExportOpen(false); }}>Markdown (plain)</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="stepper">
          {[["Capture", "Upload or Scan", ScanLine], ["Process", "OCR & AI", Wand2], ["Organize", "Structure Data", FileText], ["Export", "PDF, Excel, etc.", Download]].map(([t, s, Ic], i) => (
            <div className="step" key={t}>
              <div className={"step-ic i" + i}><Ic size={17} /></div>
              <div><div className="step-t"><b>{i + 1}.</b> {t}</div><div className="step-s">{s}</div></div>
              {i < 3 && <ChevronRight className="step-arrow" size={18} />}
            </div>
          ))}
        </div>

        <div className="work">
          <section className="pane">
            <div className="pane-h"><span>Original Scan</span><button className="chip-btn" onClick={() => fileRef.current?.click()}><RotateCw size={13} /> Retake</button></div>
            <div className={"scan" + (dragOver ? " dragover" : "")}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); onFile(e.dataTransfer.files && e.dataTransfer.files[0]); }}>
              {image ? <img src={image.dataUrl} alt="Scanned page" /> : (<button className="scan-empty" onClick={() => fileRef.current?.click()}><div className="scan-empty-ic"><ScanLine size={26} /></div><div className="scan-empty-t">Scan or drop a page</div><div className="scan-empty-s">Click to choose a photo, or drag one here</div></button>)}
              {busy && <div className="scan-busy"><div className="spin" /> Reading page…</div>}
              <div className="drop-hint"><ScanLine size={22} /><span>Drop your page to scan</span></div>
            </div>
            <div className="scan-tools">
              <button className="tool soon" title="Coming soon"><Crop size={16} /><span>Crop</span></button>
              <button className="tool" onClick={rotateImage} disabled={!image}><RotateCw size={16} /><span>Rotate</span></button>
              <button className="tool soon" title="Coming soon"><Sun size={16} /><span>Enhance</span></button>
              <button className="tool soon" title="Coming soon"><SlidersHorizontal size={16} /><span>Filters</span></button>
              <button className="tool" onClick={() => image && organize(image.base64)} disabled={!image}><RefreshCw size={16} /><span>Re-scan</span></button>
            </div>
            <div className="zoom"><button><Minus size={15} /></button><span>100%</span><button><Plus size={15} /></button><button className="mz"><Maximize2 size={14} /></button></div>
          </section>

          <section className="pane">
            <div className="pane-h"><span>AI Organized Document</span><button className="chip-btn"><Pencil size={13} /> Edit Text</button></div>
            <div className="doc-scroll">
              {doc ? (
                <article className="page" style={docVars(design)}>
                  <DocHeader doc={doc} header={design.header} />
                  {doc.sections.map((s) => <Section key={s.id} s={s} />)}
                </article>
              ) : (
                <div className="doc-empty"><div className="doc-empty-ic"><FileText size={26} /></div><div className="doc-empty-t">Your organized document appears here</div><div className="doc-empty-s">Scan or drop a page to get started</div></div>
              )}
            </div>
            <div className="pager"><button><ChevronLeft size={16} /></button><span>1 / 1</span><button><ChevronRight size={16} /></button></div>
          </section>
        </div>

        {doc && (
          <div className="footer-row">
            <div className="suggest">
              <div className="suggest-h"><Sparkles size={15} /> AI Suggestions</div>
              <div className="suggest-btns">
                <button onClick={() => addSuggestion("exec")}>Add Executive Summary</button>
                <button onClick={() => addSuggestion("takeaways")}>Add Key Takeaways</button>
                <button onClick={() => addSuggestion("attendees")}>Add Meeting Attendees</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* design panel */}
      <aside className="design">
        <div className="design-h"><span>Design & Aesthetics</span></div>

        {/* ---- AI customize chat ---- */}
        <div className="ai-cust">
          <div className="ai-h"><Sparkles size={15} /> Customize with AI</div>
          <p className="ai-sub">Describe the look you want — “elegant and warm, navy accent, tighter spacing.”</p>
          {chat.length > 0 && (
            <div className="ai-log">
              {chat.map((m, i) => <div key={i} className={"bub " + m.role}>{m.text}</div>)}
              {thinking && <div className="bub ai thinking"><span /><span /><span /></div>}
            </div>
          )}
          <div className="ai-input">
            <input value={input} disabled={remaining <= 0 || thinking} placeholder={remaining > 0 ? "Type a request…" : "Demo limit reached"}
              onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} />
            <button onClick={sendChat} disabled={remaining <= 0 || thinking || !input.trim()}><Send size={15} /></button>
          </div>
          <div className="ai-count">{remaining > 0 ? `${remaining} of 3 requests left` : "3 of 3 requests used"}</div>
        </div>

        <div className="d-sec"><div className="d-k">Template Style</div>
          <div className="tpl-grid">
            {TEMPLATES.map((t) => (
              <button key={t.id} className={"tpl " + (design.accent === t.accent && design.header === t.header ? "on" : "")} onClick={() => useTemplate(t)}>
                <div className="tpl-prev" style={{ background: t.id === "onyx" ? "#1f2430" : "#fff" }}>
                  <span className="tpl-bar" style={{ background: t.accent }} /><span className="tpl-ln" /><span className="tpl-ln short" />
                </div><span className="tpl-l">{t.label}</span>
              </button>))}
          </div>
        </div>

        <div className="d-sec"><div className="d-k">Color Theme</div>
          <div className="swatches">{COLORS.map((c) => <button key={c.id} className={"sw " + (design.accent === c.hex ? "on" : "")} style={{ background: c.hex }} onClick={() => setD({ accent: c.hex })} aria-label={c.id} />)}</div>
        </div>

        <div className="d-sec"><div className="d-k">Font Family</div>
          <select className="sel" value={design.font} onChange={(e) => setD({ font: e.target.value })}>{FONTS.map((f) => <option key={f} value={f}>{f}</option>)}</select>
        </div>

        <div className="d-sec"><div className="d-k">Font Size</div>
          <div className="slider-row"><input type="range" min="10" max="18" value={design.size} onChange={(e) => setD({ size: +e.target.value })} /><span className="slider-v">{design.size}pt</span></div>
        </div>

        <div className="d-sec"><div className="d-k">Layout</div>
          <div className="seg3">{["compact", "balanced", "spacious"].map((l) => <button key={l} className={design.layout === l ? "on" : ""} onClick={() => setD({ layout: l })}>{cap(l)}</button>)}</div>
        </div>

        <div className="d-sec"><div className="d-k">Header Style</div>
          <div className="seg3 tall">{[["modern", "Modern"], ["classic", "Classic"], ["minimal", "Minimal"]].map(([h, l]) => (
            <button key={h} className={design.header === h ? "on" : ""} onClick={() => setD({ header: h })}><span className={"hprev " + h} /><span>{l}</span></button>))}</div>
        </div>

        <div className="d-sec"><div className="d-k">Page Margins</div>
          <div className="slider-row"><input type="range" min="0" max="2" value={design.margins} onChange={(e) => setD({ margins: +e.target.value })} /><span className="slider-v">{["Tight", "Normal", "Wide"][design.margins]}</span></div>
        </div>

        <div className="d-sec"><div className="d-k">Corner Style</div>
          <div className="seg3">{["square", "rounded", "soft"].map((c) => <button key={c} className={design.corner === c ? "on" : ""} onClick={() => setD({ corner: c })}>{cap(c)}</button>)}</div>
        </div>

        <button className={"apply " + (applied ? "done" : "")} onClick={apply}>{applied ? <><Check size={16} /> Applied</> : <><Check size={16} /> Apply to Document</>}</button>
      </aside>
    </div>
  );
}

// ================= pieces =================
function NavItem({ icon, label, active, onClick }) { return <button className={"nav-i " + (active ? "on" : "")} onClick={onClick}>{icon}<span>{label}</span></button>; }
function DocHeader({ doc, header }) {
  return (
    <div className={"dhead " + header}>
      <h1 className="d-title">{doc.title}</h1>
      {(doc.date || doc.tag) && <div className="d-meta">{doc.date && <span><Calendar size={13} /> {doc.date}</span>}{doc.tag && <span><FileText size={13} /> {doc.tag}</span>}</div>}
    </div>
  );
}
function Section({ s }) {
  return (
    <div className="d-section">
      <h2 className="d-h">{s.heading}</h2>
      {s.kind === "para" && <p className="d-p">{s.text}</p>}
      {s.kind === "list" && <ul className="d-ul">{(s.items || []).map((i, k) => <li key={k}>{i}</li>)}</ul>}
      {s.kind === "numbered" && <ol className="d-ol">{(s.items || []).map((i, k) => <li key={k}><span className="num">{k + 1}</span>{i}</li>)}</ol>}
      {s.kind === "table" && (
        <div className="d-tw"><table className="d-table"><thead><tr>{(s.columns || []).map((c, i) => <th key={i} className={i ? "r" : ""}>{c}</th>)}</tr></thead>
          <tbody>{(s.rows || []).map((r, ri) => <tr key={ri} className={s.totalRow && ri === s.rows.length - 1 ? "total" : ""}>{r.map((c, ci) => <td key={ci} className={ci ? "r" : ""}>{c}</td>)}</tr>)}</tbody></table></div>)}
      {s.kind === "callout" && <div className="d-callout"><Calendar size={18} /><div><div className="cal-h">{s.heading}</div>{(s.lines || []).map((l, k) => <div key={k} className="cal-l">{l}</div>)}</div></div>}
    </div>
  );
}
function ScanFacsimile() {
  const L = [{ t: "Project Meeting – 6/1/2025", head: true }, { t: "" }, { t: "– Discuss Q2 progress" }, { t: "– Budget update" },
    { t: "    – Marketing – $4,000" }, { t: "    – Development – $12,500" }, { t: "    – Operations – $2,300" }, { t: "        Total – $18,800" },
    { t: "" }, { t: "– Action Items:" }, { t: "    1. Review timeline" }, { t: "    2. Client feedback" }, { t: "    3. Finalize report" }, { t: "" }, { t: "Next meeting: 6/15/2025  ★" }];
  return <div className="facs">{L.map((l, i) => <div key={i} className={"fl" + (l.head ? " fh" : "")} style={{ transform: `rotate(${(i % 3 - 1) * 0.35}deg)` }}>{l.t}</div>)}</div>;
}

// ================= exports =================
function esc(s) { return (s || "").toString().replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
function save(t, name, mime) { const b = new Blob([t], { type: mime }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = name; a.click(); URL.revokeObjectURL(u); }
const slug = (s) => (s || "document").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function exportMd(doc) {
  let m = `# ${doc.title}\n\n${doc.date ? `_${doc.date}_ · ${doc.tag}\n\n` : ""}`;
  doc.sections.forEach((s) => { m += `## ${s.heading}\n\n`;
    if (s.kind === "para") m += `${s.text}\n\n`;
    if (s.kind === "list") { (s.items || []).forEach((i) => (m += `- ${i}\n`)); m += "\n"; }
    if (s.kind === "numbered") { (s.items || []).forEach((i, k) => (m += `${k + 1}. ${i}\n`)); m += "\n"; }
    if (s.kind === "callout") { (s.lines || []).forEach((l) => (m += `> ${l}\n`)); m += "\n"; }
    if (s.kind === "table") { m += `| ${s.columns.join(" | ")} |\n| ${s.columns.map(() => "---").join(" | ")} |\n`; s.rows.forEach((r) => (m += `| ${r.join(" | ")} |\n`)); m += "\n"; } });
  save(m, slug(doc.title) + ".md", "text/markdown");
}
function exportHtml(doc, d) {
  const a = d.accent, aw = rgba(a, 0.1), as = dark(a, 0.72), rad = RADII[d.corner], pad = PADS[d.margins], size = d.size * 1.25;
  const head = d.header === "modern"
    ? `<div style="background:${a};color:#fff;padding:20px 22px;border-radius:${rad} ${rad} 0 0;margin:-${pad} -${pad} 22px"><h1 style="margin:0;font-size:${size * 1.7}px">${esc(doc.title)}</h1><div style="opacity:.85;font-size:13px;margin-top:6px">${esc(doc.date)} · ${esc(doc.tag)}</div></div>`
    : `<h1 style="font-size:${size * 1.7}px;margin:0 0 4px;${d.header === "classic" ? `border-bottom:3px solid ${a};padding-bottom:8px;` : "border-bottom:1px solid #e5e7eb;padding-bottom:8px;"}">${esc(doc.title)}</h1><div style="color:#6b7280;font-size:13px;margin-bottom:18px">${esc(doc.date)} · ${esc(doc.tag)}</div>`;
  const body = doc.sections.map((s) => {
    let x = `<h2 style="color:${a};font-size:${size * 1.1}px;margin:22px 0 8px">${esc(s.heading)}</h2>`;
    if (s.kind === "para") x += `<p style="line-height:1.65">${esc(s.text)}</p>`;
    if (s.kind === "list") x += `<ul>${s.items.map((i) => `<li style="margin:5px 0">${esc(i)}</li>`).join("")}</ul>`;
    if (s.kind === "numbered") x += `<ol>${s.items.map((i) => `<li style="margin:5px 0">${esc(i)}</li>`).join("")}</ol>`;
    if (s.kind === "callout") x += `<div style="background:${aw};border-radius:${rad};padding:14px 16px"><b style="color:${as}">${esc(s.heading)}</b>${s.lines.map((l) => `<div>${esc(l)}</div>`).join("")}</div>`;
    if (s.kind === "table") x += `<table style="width:100%;border-collapse:collapse;margin-top:6px"><tr>${s.columns.map((c, i) => `<th style="text-align:${i ? "right" : "left"};background:#f8f9fb;padding:9px 12px;border-bottom:1px solid #e5e7eb;font-size:13px">${esc(c)}</th>`).join("")}</tr>${s.rows.map((r, ri) => { const tot = s.totalRow && ri === s.rows.length - 1; return `<tr>${r.map((c, ci) => `<td style="text-align:${ci ? "right" : "left"};padding:9px 12px;border-bottom:1px solid #eef0f3;${tot ? `background:${aw};color:${as};font-weight:600` : ""}">${esc(c)}</td>`).join("")}</tr>`; }).join("")}</table>`;
    return x; }).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(doc.title)}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Inter:wght@400;600&family=Source+Serif+4:wght@400;600&family=Playfair+Display:wght@500;700&family=IBM+Plex+Mono:wght@500&family=Space+Grotesk:wght@500;600&display=swap');
body{font-family:'${d.font}',sans-serif;font-size:${size}px;color:#1f2430;max-width:760px;margin:40px auto;padding:0 20px}.page{background:#fff;border:1px solid #eceef1;border-radius:${rad};padding:${pad}}h2:first-of-type{margin-top:0}ul,ol{padding-left:22px;margin:6px 0}</style></head><body><div class="page">${head}${body}</div></body></html>`;
  save(html, slug(doc.title) + ".html", "text/html");
}

// ================= styles =================
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Source+Serif+4:wght@400;600&family=Playfair+Display:wght@500;700&family=IBM+Plex+Mono:wght@500&family=Space+Grotesk:wght@500;600&family=Caveat:wght@500;600&display=swap');

/* ---- skin variables ---- */
.pw{--brand:#6D28D9;--brand-2:#7c3aed;--brand-weak:#f1ecfb;--on-brand:#fff;
  --bg:radial-gradient(1200px 600px at 80% -5%, #efeafc 0%, #f6f7f9 40%);--surface:#fff;--surface-2:#f6f7f9;
  --ink:#1f2430;--mut:#6b7280;--line:#eceef1;--shadow:0 1px 2px rgba(20,20,40,.04),0 10px 26px rgba(20,20,50,.05);}
.pw.skin-ocean{--brand:#0E7490;--brand-2:#0891b2;--brand-weak:#e2f4f7;
  --bg:radial-gradient(1200px 600px at 80% -5%, #e3f4f6 0%, #f5f8f9 42%);}
.pw.skin-midnight{--brand:#8b7cf6;--brand-2:#a78bfa;--brand-weak:#2a2740;--on-brand:#fff;
  --bg:#14171e;--surface:#20242e;--surface-2:#191d25;--ink:#e8eaed;--mut:#98a0ac;--line:#2b303b;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 12px 30px rgba(0,0,0,.35);}

.pw{display:grid;grid-template-columns:250px 1fr 306px;min-height:100vh;background:var(--bg);color:var(--ink);font-family:'Inter',system-ui,sans-serif;font-size:14px;}
.pw *{box-sizing:border-box;} .pw button{font-family:inherit;cursor:pointer;}
@media(max-width:1180px){.pw{grid-template-columns:224px 1fr;}.design{display:none;}}
@media(max-width:820px){.pw{grid-template-columns:1fr;}.side{display:none;}}

/* sidebar */
.side{background:var(--surface);border-right:1px solid var(--line);padding:18px 14px;display:flex;flex-direction:column;gap:14px;}
.brand{display:flex;gap:10px;align-items:center;}
.brand-ic{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,var(--brand-2),var(--brand));color:#fff;display:grid;place-items:center;box-shadow:0 4px 12px var(--brand-weak);}
.brand-n{font-family:'Poppins';font-weight:700;font-size:16px;color:var(--ink);}
.brand-s{font-size:11px;color:var(--mut);}
.newscan{background:linear-gradient(135deg,var(--brand-2),var(--brand));color:#fff;border:none;border-radius:11px;padding:11px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:7px;box-shadow:0 6px 16px rgba(109,40,217,.22);}
.nav{display:flex;flex-direction:column;gap:2px;flex:1;}
.nav-h{font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);opacity:.75;padding:14px 10px 5px;}
.nav-i{display:flex;align-items:center;gap:11px;padding:9px 10px;border-radius:10px;border:none;background:none;color:var(--mut);font-size:13.5px;text-align:left;width:100%;transition:.14s;}
.nav-i:hover{background:var(--brand-weak);color:var(--brand);}
.nav-i.on{background:var(--brand-weak);color:var(--brand);font-weight:600;}
.appearance{border-top:1px solid var(--line);padding-top:12px;}
.app-k{font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);opacity:.75;margin-bottom:8px;padding:0 6px;}
.skins{display:flex;flex-direction:column;gap:5px;}
.skinbtn{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:10px;border:1px solid transparent;background:none;color:var(--ink);font-size:13px;text-align:left;}
.skinbtn:hover{background:var(--surface-2);}
.skinbtn.on{border-color:var(--brand);background:var(--brand-weak);color:var(--brand);font-weight:600;}
.skin-dot{width:16px;height:16px;border-radius:50%;box-shadow:0 0 0 2px var(--surface),0 0 0 3px var(--line);}

/* main */
.main{display:flex;flex-direction:column;min-width:0;}
.top{display:flex;justify-content:space-between;align-items:center;padding:14px 22px;background:var(--surface);border-bottom:1px solid var(--line);gap:12px;flex-wrap:wrap;}
.top-title{display:flex;align-items:center;gap:10px;}
.top-title h1{font-family:'Poppins';font-size:18px;font-weight:600;margin:0;color:var(--ink);}
.title-in{font-family:'Poppins';font-size:18px;font-weight:600;border:1px solid var(--brand);border-radius:8px;padding:3px 8px;outline:none;background:var(--surface);color:var(--ink);}
.saved{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;color:#22c55e;margin-left:6px;}
.top-actions{display:flex;align-items:center;gap:8px;}
.ic-btn{background:var(--surface-2);border:1px solid var(--line);border-radius:9px;width:34px;height:34px;display:grid;place-items:center;color:var(--mut);}
.ic-btn:disabled{opacity:.4;} .ic-btn:hover:not(:disabled){color:var(--brand);}
.btn-ghost{display:inline-flex;align-items:center;gap:7px;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:8px 14px;font-weight:500;font-size:13.5px;color:var(--ink);}
.btn-primary{display:inline-flex;align-items:center;gap:7px;background:linear-gradient(135deg,var(--brand-2),var(--brand));color:#fff;border:none;border-radius:10px;padding:9px 15px;font-weight:600;font-size:13.5px;box-shadow:0 6px 16px rgba(109,40,217,.22);}
.export-wrap{position:relative;}
.menu{position:absolute;right:0;top:44px;background:var(--surface);border:1px solid var(--line);border-radius:11px;box-shadow:var(--shadow);padding:6px;z-index:20;min-width:170px;}
.menu button{display:block;width:100%;text-align:left;padding:9px 11px;border:none;background:none;border-radius:8px;font-size:13.5px;color:var(--ink);}
.menu button:hover{background:var(--brand-weak);color:var(--brand);}

.stepper{display:flex;gap:8px;padding:14px 22px;background:var(--surface);border-bottom:1px solid var(--line);flex-wrap:wrap;}
.step{display:flex;align-items:center;gap:9px;padding-right:8px;flex:1;min-width:150px;}
.step-ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:#fff;flex-shrink:0;}
.i0{background:#8b5cf6;}.i1{background:#3b82f6;}.i2{background:#10b981;}.i3{background:#f59e0b;}
.step-t{font-size:13px;font-weight:600;color:var(--ink);}.step-t b{color:var(--mut);}.step-s{font-size:11.5px;color:var(--mut);}
.step-arrow{color:var(--line);margin-left:auto;}

.work{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:18px 22px;}
@media(max-width:900px){.work{grid-template-columns:1fr;}}
.pane{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px;display:flex;flex-direction:column;box-shadow:var(--shadow);}
.pane-h{display:flex;justify-content:space-between;align-items:center;font-weight:600;font-size:14px;margin-bottom:12px;color:var(--ink);}
.chip-btn{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--mut);background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:5px 10px;}
.scan{position:relative;border-radius:12px;overflow:hidden;background:#efe9dc;border:1px solid #e5ddc9;min-height:300px;}
.scan img{width:100%;display:block;}
.scan-busy{position:absolute;inset:0;background:rgba(255,255,255,.78);display:flex;align-items:center;justify-content:center;gap:10px;font-weight:600;color:var(--brand);}
.spin{width:26px;height:26px;border-radius:50%;border:3px solid #ddd;border-top-color:var(--brand);animation:sp .8s linear infinite;}
@keyframes sp{to{transform:rotate(360deg);}}
.facs{background:repeating-linear-gradient(#fdfbf4 0 28px,#e9e2cf 28px 29px);padding:22px 24px;font-family:'Caveat',cursive;color:#2c3038;min-height:300px;}
.fl{font-size:20px;line-height:29px;white-space:pre;}.fh{font-size:24px;font-weight:600;text-decoration:underline;}
.scan-tools{display:flex;justify-content:space-around;margin-top:12px;padding-top:12px;border-top:1px solid var(--line);}
.tool{display:flex;flex-direction:column;align-items:center;gap:4px;background:none;border:none;color:var(--mut);font-size:11px;}
.tool:hover{color:var(--brand);}
.zoom{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;}
.zoom button{width:30px;height:30px;border:1px solid var(--line);background:var(--surface);border-radius:8px;display:grid;place-items:center;color:var(--mut);}
.zoom span{font-size:12.5px;color:var(--mut);min-width:44px;text-align:center;}

.doc-scroll{flex:1;overflow:auto;background:var(--surface-2);border-radius:12px;padding:16px;max-height:560px;}
.page{background:#fff;color:#1f2430;border:1px solid #eceef1;border-radius:var(--radius);padding:var(--pad);font-family:var(--dfont),sans-serif;font-size:var(--dsize);line-height:calc(1.55 * var(--gap));box-shadow:0 4px 20px rgba(0,0,0,.06);}
.dhead.modern{background:var(--ac);color:#fff;margin:calc(-1 * var(--pad)) calc(-1 * var(--pad)) 20px;padding:20px 22px;border-radius:var(--radius) var(--radius) 0 0;}
.dhead.modern .d-meta{color:rgba(255,255,255,.85);}
.dhead.classic .d-title{border-bottom:3px solid var(--ac);padding-bottom:8px;}
.dhead.minimal .d-title{border-bottom:1px solid #e5e7eb;padding-bottom:8px;}
.d-title{font-family:var(--dfont);font-weight:700;font-size:calc(var(--dsize) * 1.75);margin:0 0 6px;}
.d-meta{display:flex;gap:16px;font-size:12.5px;color:#6b7280;margin-bottom:4px;}
.d-meta span{display:inline-flex;align-items:center;gap:5px;}
.d-section{margin-top:calc(18px * var(--gap));}
.d-h{color:var(--ac);font-family:var(--dfont);font-weight:600;font-size:calc(var(--dsize) * 1.08);margin:0 0 calc(8px * var(--gap));padding-bottom:5px;border-bottom:1px solid var(--ac-weak);}
.d-p{margin:0;line-height:calc(1.65 * var(--gap));color:#374151;}
.d-ul,.d-ol{margin:0;padding-left:20px;color:#374151;}.d-ul li,.d-ol li{margin:calc(5px * var(--gap)) 0;}
.d-ol{list-style:none;padding-left:0;}.d-ol li{display:flex;align-items:center;gap:10px;}
.d-ol .num{width:22px;height:22px;border-radius:50%;background:var(--ac);color:#fff;display:grid;place-items:center;font-size:12px;font-weight:600;flex-shrink:0;}
.d-tw{overflow-x:auto;border:1px solid #eceef1;border-radius:var(--radius);}
.d-table{width:100%;border-collapse:collapse;font-size:calc(var(--dsize) * 0.95);}
.d-table th{background:#f8f9fb;text-align:left;padding:10px 13px;font-weight:600;border-bottom:1px solid #eceef1;color:#374151;}
.d-table td{padding:9px 13px;border-bottom:1px solid #f1f3f5;color:#374151;}
.d-table .r{text-align:right;}
.d-table tr.total td{background:var(--ac-weak);color:var(--ac-strong);font-weight:700;}
.d-callout{display:flex;gap:12px;align-items:flex-start;background:var(--ac-weak);color:var(--ac-strong);border-radius:var(--radius);padding:14px 16px;}
.cal-h{font-weight:600;}.cal-l{font-size:calc(var(--dsize) * 0.95);}
.pager{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:12px;}
.pager button{width:30px;height:30px;border:1px solid var(--line);background:var(--surface);border-radius:8px;display:grid;place-items:center;color:var(--mut);}
.pager span{font-size:12.5px;color:var(--mut);}

.footer-row{display:grid;grid-template-columns:1fr;gap:16px;padding:0 22px 22px;}
@media(max-width:900px){.footer-row{grid-template-columns:1fr;}}
.suggest{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px 16px;box-shadow:var(--shadow);}
.suggest-h{display:inline-flex;align-items:center;gap:7px;font-weight:600;font-size:13.5px;color:var(--brand);margin-bottom:10px;}
.suggest-btns{display:flex;gap:9px;flex-wrap:wrap;}
.suggest-btns button{background:var(--brand-weak);border:1px solid transparent;color:var(--brand);font-size:12.5px;font-weight:500;padding:8px 13px;border-radius:9px;}
.suggest-btns button:hover{filter:brightness(.97);}
.ready{display:flex;align-items:center;gap:10px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.28);border-radius:16px;padding:14px 18px;color:#16a34a;}
.ready b{display:block;font-size:13.5px;}.ready span{font-size:12px;opacity:.85;}

/* design panel */
.design{background:var(--surface);border-left:1px solid var(--line);padding:18px 16px;overflow-y:auto;max-height:100vh;position:sticky;top:0;}
.design-h{font-family:'Poppins';font-weight:600;font-size:15px;margin-bottom:15px;color:var(--ink);}
.ai-cust{background:linear-gradient(135deg,var(--brand-weak),transparent);border:1px solid var(--line);border-radius:13px;padding:13px;margin-bottom:18px;}
.ai-h{display:inline-flex;align-items:center;gap:7px;font-weight:600;font-size:13.5px;color:var(--brand);}
.ai-sub{font-size:11.5px;color:var(--mut);margin:6px 0 10px;line-height:1.45;}
.ai-log{display:flex;flex-direction:column;gap:6px;margin-bottom:10px;max-height:180px;overflow:auto;}
.bub{font-size:12.5px;padding:7px 10px;border-radius:10px;max-width:88%;line-height:1.4;}
.bub.user{align-self:flex-end;background:var(--brand);color:#fff;border-bottom-right-radius:3px;}
.bub.ai{align-self:flex-start;background:var(--surface-2);color:var(--ink);border-bottom-left-radius:3px;}
.bub.thinking{display:flex;gap:4px;}
.bub.thinking span{width:6px;height:6px;border-radius:50%;background:var(--mut);animation:bl 1s infinite;}
.bub.thinking span:nth-child(2){animation-delay:.15s;}.bub.thinking span:nth-child(3){animation-delay:.3s;}
@keyframes bl{0%,100%{opacity:.3;}50%{opacity:1;}}
.ai-input{display:flex;gap:6px;}
.ai-input input{flex:1;min-width:0;padding:8px 11px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink);font-size:13px;outline:none;}
.ai-input input:focus{border-color:var(--brand);}
.ai-input button{width:36px;border:none;border-radius:9px;background:var(--brand);color:#fff;display:grid;place-items:center;}
.ai-input button:disabled{opacity:.4;}
.ai-count{font-size:10.5px;color:var(--mut);margin-top:7px;text-align:right;}

.d-sec{margin-bottom:18px;}
.d-k{font-size:12.5px;font-weight:600;color:var(--ink);margin-bottom:9px;}
.tpl-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;}
.tpl{border:2px solid var(--line);border-radius:10px;padding:5px;background:var(--surface);display:flex;flex-direction:column;gap:4px;align-items:center;}
.tpl.on{border-color:var(--brand);}
.tpl-prev{width:100%;height:52px;border-radius:6px;border:1px solid #edeef0;padding:6px;display:flex;flex-direction:column;gap:4px;overflow:hidden;}
.tpl-bar{height:8px;border-radius:2px;width:70%;}.tpl-ln{height:4px;border-radius:2px;background:#e3e6ea;}.tpl-ln.short{width:60%;}
.tpl-l{font-size:10px;color:var(--mut);}
.swatches{display:flex;gap:9px;}
.sw{width:28px;height:28px;border-radius:50%;border:2px solid var(--surface);box-shadow:0 0 0 1px var(--line);}
.sw.on{box-shadow:0 0 0 2px var(--brand);}
.sel{width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:10px;background:var(--surface);font-size:13.5px;color:var(--ink);}
.slider-row{display:flex;align-items:center;gap:12px;}
.slider-row input[type=range]{flex:1;accent-color:var(--brand);}
.slider-v{font-size:12.5px;color:var(--mut);min-width:52px;text-align:right;}
.seg3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
.seg3 button{border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:9px 4px;font-size:12.5px;color:var(--mut);display:flex;flex-direction:column;align-items:center;gap:5px;}
.seg3 button.on{border-color:var(--brand);background:var(--brand-weak);color:var(--brand);font-weight:600;}
.hprev{width:100%;height:20px;border-radius:5px;border:1px solid var(--line);}
.hprev.modern{background:var(--brand);}
.hprev.classic{background:linear-gradient(var(--surface) 60%,var(--mut) 60% 72%,var(--surface) 72%);}
.hprev.minimal{background:linear-gradient(var(--surface) 70%,var(--line) 70% 74%,var(--surface) 74%);}
.apply{width:100%;background:linear-gradient(135deg,var(--brand-2),var(--brand));color:#fff;border:none;border-radius:11px;padding:12px;font-weight:600;font-size:14px;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 6px 18px rgba(109,40,217,.28);margin-top:4px;}
.apply.done{background:#16a34a;box-shadow:none;}

.scan.dragover{outline:2px dashed var(--brand);outline-offset:-6px;}
.drop-hint{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:rgba(109,40,217,.1);color:var(--brand);font-weight:600;font-size:14px;pointer-events:none;}
.scan.dragover .drop-hint{display:flex;}
.tool:disabled{opacity:.4;cursor:default;}
.tool:disabled:hover{color:var(--mut);}
.tool.soon{opacity:.45;cursor:default;}
.tool.soon:hover{color:var(--mut);}

.top-title h1.untitled{color:var(--mut);font-weight:500;}
.btn-primary:disabled{opacity:.5;box-shadow:none;cursor:default;}
.scan-empty{width:100%;min-height:300px;border:none;background:var(--surface);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer;color:var(--mut);}
.scan-empty:hover{color:var(--brand);}
.scan-empty-ic{width:56px;height:56px;border-radius:16px;background:var(--brand-weak);color:var(--brand);display:grid;place-items:center;margin-bottom:4px;}
.scan-empty-t{font-weight:600;font-size:15px;color:var(--ink);}
.scan-empty-s{font-size:13px;}
.doc-empty{min-height:300px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;color:var(--mut);padding:28px;}
.doc-empty-ic{width:56px;height:56px;border-radius:16px;background:var(--surface);border:1px solid var(--line);color:var(--mut);display:grid;place-items:center;margin-bottom:4px;}
.doc-empty-t{font-weight:600;font-size:15px;color:var(--ink);}
.doc-empty-s{font-size:13px;}

@media print{
  .pw{display:block;background:#fff;}
  .side,.design,.top,.stepper,.footer-row,.pane:first-child,.pane-h,.pager{display:none !important;}
  .main,.work,.pane{display:block;margin:0;padding:0;border:none;box-shadow:none;}
  .doc-scroll{overflow:visible;max-height:none;background:#fff;padding:0;}
  .page{border:none;box-shadow:none;}
}
`;
