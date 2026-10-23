// Build: bundle every card listed in src/index.js into one minified file, dist/linwood-cards.js.
// That single file is what HACS downloads from the GitHub Release and Home Assistant serves locally.
//
// Each card is minified on its own and wrapped in its own function scope, so top-level names can't collide and an
// error in one card is logged without stopping the rest. Version and commit come from the environment (CI sets them):
//   LINWOOD_VERSION=v2.41.0 GITHUB_SHA=<sha> node tools/build.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { transform } from 'esbuild';
import { files } from '../src/index.js';

const root = new URL('../', import.meta.url);
const version = process.env.LINWOOD_VERSION || 'dev';
const sha = (process.env.GITHUB_SHA || 'local').slice(0, 7);

const parts = [];
for (const f of files) {
  const src = await readFile(new URL(`src/${f}`, root), 'utf8');
  // Cards were written as ES modules (strict mode); keep that inside each wrapper.
  const { code } = await transform(`run(${JSON.stringify(f)},function(){"use strict";\n${src}\n});`, {
    minify: true, target: 'es2020', legalComments: 'none', sourcefile: f, loader: 'js',
  });
  parts.push(code.trim());
}

const out = `/* Linwood Cards ${version} (${sha}) — built from github.com/ergoat48/linwood-cards. Installed and served locally by HACS. */
(()=>{if(window.LinwoodCards){console.warn("[Linwood] cards already loaded",window.LinwoodCards);return}
const ok=[],failed=[],run=(f,fn)=>{try{fn();ok.push(f)}catch(e){failed.push(f);console.error("[Linwood] "+f+":",e)}};
${parts.join('\n')}
window.LinwoodCards={version:${JSON.stringify(version)},sha:${JSON.stringify(sha)},files:ok,failed};
console.info("%c Linwood cards %c ${version} · ${sha}"+(failed.length?" · "+failed.length+" failed":"")+" ","background:#a78bfa;color:#140f24;font-weight:700;border-radius:3px 0 0 3px","background:#1f2937;color:#e5e7eb;border-radius:0 3px 3px 0")})();
`;

await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/linwood-cards.js', root), out);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
let raw = 0;
for (const f of files) raw += (await readFile(new URL(`src/${f}`, root))).length;
console.log(`dist/linwood-cards.js  ${version} (${sha})  ${files.length} cards  source ${kb(raw)} → ${kb(out.length)} minified → ${kb(gzipSync(out).length)} gzipped`);
