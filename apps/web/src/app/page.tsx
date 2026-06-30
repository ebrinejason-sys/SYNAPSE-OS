import { Bricolage_Grotesque, Inter, IBM_Plex_Mono } from "next/font/google";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["400","600","700","800"], variable: "--syn-display", display: "swap" });
const body = Inter({ subsets: ["latin"], weight: ["400","500","600"], variable: "--syn-body", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400","500"], variable: "--syn-mono", display: "swap" });

function Knot({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M20 12c-9 0-13 8-13 14s4 14 13 14c7 0 9-5 12-10" stroke="var(--syn-teal)" strokeWidth="4" strokeLinecap="round" />
      <path d="M44 52c9 0 13-8 13-14s-4-14-13-14c-7 0-9 5-12 10" stroke="var(--syn-copper)" strokeWidth="4" strokeLinecap="round" />
      <path d="M27 26l6 6-6 6" stroke="var(--syn-teal)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M37 38l-6-6 6-6" stroke="var(--syn-copper)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </svg>
  );
}

export default function Page() {
  const flow = [
    { label: "OPD", note: "Triage & consultation" },
    { label: "Laboratory", note: "Orders & results" },
    { label: "Pharmacy", note: "Dispense & POS" },
    { label: "Billing", note: "Claims & receipts" },
  ];
  const capabilities = [
    { tag: "SynapseOS", title: "Hospital management", copy: "One auditable patient record from triage to discharge — clinical notes, labs, prescriptions and billing on a single timeline, not four disconnected ledgers." },
    { tag: "Synapse Pharm", title: "Pharmacy POS & inventory", copy: "Real point-of-sale with stock movement, expiry tracking and reconciliation. Built to ring a sale on a counter that may lose connectivity mid-transaction." },
    { tag: "Patient app", title: "Records that travel with the patient", copy: "A portable health record the patient controls and can share between facilities — so history doesn't restart at every front desk." },
  ];
  const uganda = ["UGX currency, end to end","MTN MoMo & Airtel Money","+256 number validation","All 135 districts","PDPO-aligned data handling","DHIS2 interoperability"];

  return (
    <main className={`${display.variable} ${body.variable} ${mono.variable} syn-root`}>
      <style>{synCss}</style>
      <header className="syn-nav">
        <a className="syn-brand" href="/"><Knot size={34} /><span>SynapseOS</span></a>
        <nav className="syn-navlinks">
          <a href="#platform">Platform</a>
          <a href="#uganda">Built for Uganda</a>
          <a href="/login">Sign in</a>
          <a className="syn-pill-link" href="/apply">Apply for pilot access</a>
        </nav>
      </header>
      <section className="syn-hero">
        <p className="syn-eyebrow"><span className="syn-dot" /> Now onboarding pilot facilities · Kampala, Uganda</p>
        <h1 className="syn-h1">One patient record across the <span className="syn-teal-ink">whole visit</span> — not four that disagree.</h1>
        <p className="syn-lede">SynapseOS connects OPD, laboratory, pharmacy and billing on a single auditable timeline, with Uganda Clinical Guidelines and AI assistance inside the workflow rather than bolted on beside it.</p>
        <div className="syn-cta-row">
          <a className="syn-btn syn-btn-primary" href="/apply">Apply for pilot access</a>
          <a className="syn-btn syn-btn-ghost" href="#platform">See how it fits together</a>
        </div>
        <div className="syn-hero-mark" aria-hidden="true"><Knot size={160} /></div>
      </section>
      <section className="syn-section" id="flow">
        <p className="syn-kicker">The wedge</p>
        <h2 className="syn-h2">The record follows the patient through every room.</h2>
        <p className="syn-section-lede">In most facilities the patient's story is rewritten at each desk. Here, a single record moves with them — every step writes to the same place.</p>
        <ol className="syn-flow">
          {flow.map((s, i) => (
            <li className="syn-flow-step" key={s.label}>
              <span className="syn-flow-index">{String(i + 1).padStart(2, "0")}</span>
              <span className="syn-flow-label">{s.label}</span>
              <span className="syn-flow-note">{s.note}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="syn-section" id="platform">
        <p className="syn-kicker">The platform</p>
        <h2 className="syn-h2">Three products, one database, one identity.</h2>
        <div className="syn-cards">
          {capabilities.map((c) => (
            <article className="syn-card" key={c.title}>
              <span className="syn-card-tag">{c.tag}</span>
              <h3 className="syn-card-title">{c.title}</h3>
              <p className="syn-card-copy">{c.copy}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="syn-section syn-uganda" id="uganda">
        <p className="syn-kicker">Built for Uganda</p>
        <h2 className="syn-h2">Localised where it actually matters.</h2>
        <p className="syn-section-lede">Not a foreign system with a currency symbol swapped. The constraints of Ugandan healthcare are designed in from the schema up.</p>
        <ul className="syn-tags">{uganda.map((u) => (<li className="syn-tag" key={u}>{u}</li>))}</ul>
      </section>
      <section className="syn-section syn-close">
        <Knot size={56} />
        <h2 className="syn-h2 syn-close-h">We're pre-traction, and saying so.</h2>
        <p className="syn-section-lede">No vanity counters here. We're onboarding our first pilot facilities and building real operational depth before we scale breadth. If you run a clinic or pharmacy in Uganda and want in early, that's exactly who this is for.</p>
        <a className="syn-btn syn-btn-primary" href="/apply">Apply for pilot access</a>
      </section>
      <footer className="syn-footer">
        <div className="syn-foot-brand"><Knot size={28} /><span>Synapse Health Technologies</span></div>
        <nav className="syn-foot-links">
          <a href="/login">Sign in</a>
          <a href="/apply">Apply</a>
          <a href="https://pharm.synapseos.tech">Pharmacy</a>
          <a href="https://app.synapseos.tech">Patient app</a>
        </nav>
        <p className="syn-foot-fine">Kampala, Uganda · synapseos.tech</p>
      </footer>
    </main>
  );
}

const synCss = `
.syn-root{--syn-bg:#07070A;--syn-bg-2:#0c0d12;--syn-ink:#ECECEF;--syn-muted:#9A9AA6;--syn-teal:#1FA6A6;--syn-copper:#E8B84B;--syn-line:rgba(255,255,255,0.08);background:var(--syn-bg);color:var(--syn-ink);font-family:var(--syn-body),system-ui,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.5;overflow-x:hidden;}
.syn-root a{color:inherit;text-decoration:none;}
.syn-teal-ink{color:var(--syn-teal);}
.syn-nav{display:flex;align-items:center;justify-content:space-between;padding:22px clamp(20px,5vw,72px);position:sticky;top:0;z-index:20;background:rgba(7,7,10,0.72);backdrop-filter:blur(10px);border-bottom:1px solid var(--syn-line);}
.syn-brand{display:flex;align-items:center;gap:10px;font-family:var(--syn-display);font-weight:700;font-size:19px;letter-spacing:-0.01em;}
.syn-navlinks{display:flex;align-items:center;gap:clamp(14px,2.4vw,30px);font-size:14px;color:var(--syn-muted);}
.syn-navlinks a:hover{color:var(--syn-ink);}
.syn-pill-link{border:1px solid var(--syn-teal);color:var(--syn-teal)!important;padding:8px 16px;border-radius:999px;}
.syn-pill-link:hover{background:var(--syn-teal);color:var(--syn-bg)!important;}
@media(max-width:680px){.syn-navlinks a:not(.syn-pill-link){display:none;}}
.syn-hero{position:relative;padding:clamp(64px,11vw,150px) clamp(20px,5vw,72px) clamp(56px,9vw,110px);max-width:1180px;margin:0 auto;}
.syn-eyebrow{display:inline-flex;align-items:center;gap:9px;font-family:var(--syn-mono);font-size:12.5px;letter-spacing:0.04em;color:var(--syn-copper);text-transform:uppercase;margin:0 0 26px;}
.syn-dot{width:7px;height:7px;border-radius:50%;background:var(--syn-teal);animation:synPulse 2.4s ease-out infinite;}
.syn-h1{font-family:var(--syn-display);font-weight:800;font-size:clamp(38px,6.4vw,76px);line-height:1.02;letter-spacing:-0.03em;margin:0 0 26px;max-width:14ch;}
.syn-lede{font-size:clamp(16.5px,1.7vw,20px);color:var(--syn-muted);max-width:58ch;margin:0 0 38px;}
.syn-cta-row{display:flex;flex-wrap:wrap;gap:14px;}
.syn-hero-mark{position:absolute;right:clamp(-30px,2vw,40px);top:clamp(40px,8vw,90px);opacity:0.5;pointer-events:none;}
@media(max-width:860px){.syn-hero-mark{display:none;}}
.syn-btn{display:inline-flex;align-items:center;justify-content:center;font-family:var(--syn-display);font-weight:600;font-size:15.5px;padding:14px 26px;border-radius:12px;transition:transform .15s ease,background .15s ease;}
.syn-btn:hover{transform:translateY(-2px);}
.syn-btn-primary{background:var(--syn-teal);color:var(--syn-bg);}
.syn-btn-primary:hover{background:#2bc0c0;}
.syn-btn-ghost{border:1px solid var(--syn-line);color:var(--syn-ink);}
.syn-btn-ghost:hover{border-color:var(--syn-copper);color:var(--syn-copper);}
.syn-section{max-width:1180px;margin:0 auto;padding:clamp(56px,8vw,104px) clamp(20px,5vw,72px);border-top:1px solid var(--syn-line);}
.syn-kicker{font-family:var(--syn-mono);font-size:12.5px;letter-spacing:0.08em;text-transform:uppercase;color:var(--syn-teal);margin:0 0 18px;}
.syn-h2{font-family:var(--syn-display);font-weight:700;font-size:clamp(28px,3.7vw,46px);line-height:1.08;letter-spacing:-0.02em;margin:0 0 18px;max-width:20ch;}
.syn-section-lede{color:var(--syn-muted);font-size:clamp(15.5px,1.5vw,18px);max-width:60ch;margin:0 0 40px;}
.syn-flow{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid var(--syn-line);border-radius:16px;overflow:hidden;}
.syn-flow-step{position:relative;padding:30px 24px;display:flex;flex-direction:column;gap:8px;border-right:1px solid var(--syn-line);}
.syn-flow-step:last-child{border-right:none;}
.syn-flow-step::after{content:"";position:absolute;right:-7px;top:50%;width:13px;height:13px;transform:translateY(-50%) rotate(45deg);border-top:2px solid var(--syn-copper);border-right:2px solid var(--syn-copper);z-index:2;}
.syn-flow-step:last-child::after{display:none;}
.syn-flow-index{font-family:var(--syn-mono);font-size:12px;color:var(--syn-copper);}
.syn-flow-label{font-family:var(--syn-display);font-weight:700;font-size:20px;}
.syn-flow-note{color:var(--syn-muted);font-size:14px;}
@media(max-width:760px){.syn-flow{grid-template-columns:1fr;}.syn-flow-step{border-right:none;border-bottom:1px solid var(--syn-line);}.syn-flow-step:last-child{border-bottom:none;}.syn-flow-step::after{right:50%;top:auto;bottom:-7px;transform:translateX(50%) rotate(135deg);}}
.syn-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;}
.syn-card{background:var(--syn-bg-2);border:1px solid var(--syn-line);border-radius:16px;padding:28px;transition:border-color .2s ease,transform .2s ease;}
.syn-card:hover{border-color:var(--syn-teal);transform:translateY(-3px);}
.syn-card-tag{font-family:var(--syn-mono);font-size:11.5px;letter-spacing:0.05em;text-transform:uppercase;color:var(--syn-copper);}
.syn-card-title{font-family:var(--syn-display);font-weight:700;font-size:21px;margin:14px 0 12px;}
.syn-card-copy{color:var(--syn-muted);font-size:15px;margin:0;}
@media(max-width:820px){.syn-cards{grid-template-columns:1fr;}}
.syn-tags{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:12px;}
.syn-tag{font-family:var(--syn-mono);font-size:13.5px;color:var(--syn-ink);border:1px solid var(--syn-line);border-radius:999px;padding:10px 18px;background:var(--syn-bg-2);}
.syn-tag:hover{border-color:var(--syn-copper);}
.syn-close{text-align:center;display:flex;flex-direction:column;align-items:center;}
.syn-close-h{max-width:18ch;}
.syn-close .syn-section-lede{margin-bottom:34px;}
.syn-footer{max-width:1180px;margin:0 auto;padding:48px clamp(20px,5vw,72px) 72px;border-top:1px solid var(--syn-line);display:flex;flex-wrap:wrap;align-items:center;gap:22px;justify-content:space-between;}
.syn-foot-brand{display:flex;align-items:center;gap:10px;font-family:var(--syn-display);font-weight:600;font-size:16px;}
.syn-foot-links{display:flex;gap:22px;font-size:14px;color:var(--syn-muted);}
.syn-foot-links a:hover{color:var(--syn-ink);}
.syn-foot-fine{font-family:var(--syn-mono);font-size:12px;color:var(--syn-muted);width:100%;margin:8px 0 0;}
@keyframes synPulse{0%{box-shadow:0 0 0 0 rgba(31,166,166,0.55);}70%{box-shadow:0 0 0 9px rgba(31,166,166,0);}100%{box-shadow:0 0 0 0 rgba(31,166,166,0);}}
@supports (animation-timeline: view()){@media (prefers-reduced-motion: no-preference){.syn-section,.syn-hero{animation:synReveal linear both;animation-timeline:view();animation-range:entry 0% entry 42%;}@keyframes synReveal{from{opacity:0;transform:translateY(22px);}to{opacity:1;transform:translateY(0);}}}}
`;
