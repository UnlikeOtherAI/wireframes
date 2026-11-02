'use strict';

// Chrome for the catalogue page itself. Deliberately plain: the page is a
// frame around the wireframe, so nothing here should compete with what is
// being shown inside `.cat-demo`.

const catalogueStyles = `
:root{--cat-ink:#111827;--cat-ink-2:#4b5563;--cat-ink-3:#6b7280;--cat-line:#e5e7eb;
--cat-bg:#ffffff;--cat-bg-2:#f9fafb;--cat-code:#1f2937}
*{box-sizing:border-box}
body{margin:0;background:var(--cat-bg);color:var(--cat-ink);
font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:15px;line-height:1.55}
a{color:inherit}
.cat-shell{display:grid;grid-template-columns:240px minmax(0,1fr);align-items:start;max-width:1400px;margin:0 auto}

.cat-side{position:sticky;top:0;max-height:100vh;overflow:auto;padding:28px 20px;border-right:1px solid var(--cat-line)}
.cat-side h1{margin:0 0 4px;font-size:17px;font-weight:650}
.cat-side p{margin:0 0 20px;font-size:12px;color:var(--cat-ink-3)}
.cat-side h2{margin:18px 0 6px;font-size:11px;font-weight:600;letter-spacing:.08em;
text-transform:uppercase;color:var(--cat-ink-3)}
.cat-side ul{list-style:none;margin:0;padding:0}
.cat-side li a{display:block;padding:3px 0;font-size:13px;color:var(--cat-ink-2);text-decoration:none}
.cat-side li a:hover{color:var(--cat-ink);text-decoration:underline}

.cat-main{padding:28px 32px 96px;min-width:0}
.cat-intro{max-width:70ch;margin:0 0 32px}
.cat-intro h2{margin:0 0 8px;font-size:22px;font-weight:650}
.cat-intro p{margin:0 0 10px;color:var(--cat-ink-2)}
.cat-family{margin:0 0 10px;padding-top:24px;font-size:13px;font-weight:600;
letter-spacing:.08em;text-transform:uppercase;color:var(--cat-ink-3);
border-top:1px solid var(--cat-line)}

.cat-item{padding:18px 0 26px;border-bottom:1px solid var(--cat-line)}
.cat-head{display:flex;align-items:baseline;flex-wrap:wrap;gap:10px;margin-bottom:4px}
.cat-name{font-size:17px;font-weight:650;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.cat-frame{font-size:11px;font-weight:500;color:var(--cat-ink-3);
border:1px solid var(--cat-line);border-radius:10px;padding:1px 9px}
.cat-summary{margin:0 0 14px;color:var(--cat-ink-2);max-width:70ch}

.cat-demo{padding:20px;border:1px solid var(--cat-line);border-radius:8px;background:var(--cat-bg-2)}
.cat-demo.cat-demo-dark{background:#f3f4f6}
.cat-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;margin-top:14px}
@media (max-width:980px){.cat-shell{grid-template-columns:1fr}
.cat-side{position:static;max-height:none;border-right:none;border-bottom:1px solid var(--cat-line)}
.cat-split{grid-template-columns:1fr}}

.cat-code{margin:0;padding:12px 14px;border-radius:8px;background:var(--cat-code);color:#e5e7eb;
font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.6;
overflow-x:auto;white-space:pre-wrap;word-break:break-word}
.cat-props{width:100%;border-collapse:collapse;font-size:12.5px}
.cat-props th{text-align:left;font-weight:600;color:var(--cat-ink-3);padding:0 10px 6px 0;
border-bottom:1px solid var(--cat-line);font-size:11px;letter-spacing:.05em;text-transform:uppercase}
.cat-props td{padding:5px 10px 5px 0;border-bottom:1px solid var(--cat-line);vertical-align:top}
.cat-props td:first-child{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;white-space:nowrap}
.cat-props .cat-primary:after{content:"primary";margin-left:8px;font-family:inherit;font-size:10px;
color:var(--cat-ink-3);border:1px solid var(--cat-line);border-radius:8px;padding:0 6px}
.cat-aliases{margin:12px 0 0;font-size:12.5px;color:var(--cat-ink-3)}
.cat-aliases code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
`.trim();

module.exports = { catalogueStyles };
