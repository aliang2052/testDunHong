#!/usr/bin/env node
/* 把 three.module.js + src/*.js 打包进单个 HTML（可直接 file:// 打开） */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const OUT = process.argv[2] || path.join(ROOT, '..', '敦煌莫高窟大佛建造全过程.html');
const BUDDHA_ASSET = path.join(ROOT, 'assets', 'buddha-reference-v3.glb');

/* --- 0. 校验并读取用户确认的 v3 彩绘佛像 --- */
const glb = fs.readFileSync(BUDDHA_ASSET);
if (glb.length < 20 || glb.readUInt32LE(0) !== 0x46546c67 || glb.readUInt32LE(4) !== 2) {
  console.error('buddha-reference-v3.glb 不是有效的 GLB 2.0 文件');
  process.exit(1);
}
if (glb.readUInt32LE(8) !== glb.length) {
  console.error('buddha-reference-v3.glb 声明长度与文件长度不一致');
  process.exit(1);
}
let glbJson = null;
let glbOffset = 12;
while (glbOffset < glb.length) {
  const chunkLength = glb.readUInt32LE(glbOffset);
  const chunkType = glb.readUInt32LE(glbOffset + 4);
  const chunkEnd = glbOffset + 8 + chunkLength;
  if (chunkEnd > glb.length) {
    console.error('buddha-reference-v3.glb chunk 越界');
    process.exit(1);
  }
  if (chunkType === 0x4e4f534a) {
    glbJson = JSON.parse(glb.toString('utf8', glbOffset + 8, chunkEnd));
  }
  glbOffset = chunkEnd;
}
if (!glbJson || glbOffset !== glb.length || glbJson.asset?.version !== '2.0') {
  console.error('buddha-reference-v3.glb 缺少有效 glTF 2.0 JSON');
  process.exit(1);
}
if ((glbJson.extensionsRequired || []).length || (glbJson.images || []).length || (glbJson.animations || []).length || (glbJson.skins || []).length) {
  console.error('v3 模型出现当前离线解析器不支持的扩展、图片、动画或骨骼');
  process.exit(1);
}
const glbSha256 = crypto.createHash('sha256').update(glb).digest('hex');
const glbBase64 = glb.toString('base64');

/* --- 1. three.js：把末尾的 export {...} 转成 const THREE = {...} --- */
let three = fs.readFileSync(path.join(ROOT, 'lib', 'three.module.js'), 'utf8');

if (/^\s*import\s/m.test(three)) {
  console.error('three.module.js 含有外部 import，无法内联');
  process.exit(1);
}

const m = three.match(/export\s*\{([\s\S]*?)\}\s*;?\s*$/);
if (!m) { console.error('找不到 three 的 export 语句'); process.exit(1); }

const names = m[1].split(',').map(s => s.trim()).filter(Boolean).map(s => {
  const as = s.split(/\s+as\s+/);
  return as.length === 2 ? `${as[1]}: ${as[0]}` : s;
});
/* three 内部有 clamp/lerp 等与本项目重名的顶层符号 —— 包进 IIFE 隔离 */
three = 'const THREE = (function(){\n'
  + three.slice(0, m.index)
  + `\nreturn { ${names.join(', ')} };\n})();\n`;

/* --- 2. 按文件名排序拼接 src --- */
const srcDir = path.join(ROOT, 'src');
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js')).sort();
let code = '';
for (const f of files) {
  let s = fs.readFileSync(path.join(srcDir, f), 'utf8');
  s = s.replace(/^\s*import[\s\S]*?;\s*$/gm, '');
  s = s.replace(/^\s*export\s+/gm, '');
  code += `\n/* ===== ${f} ===== */\n` + s + '\n';
}

/* --- 3. 注入模板 --- */
const tpl = fs.readFileSync(path.join(ROOT, 'template.html'), 'utf8');
const bundle = three + '\n' + code;
if (bundle.includes('</script')) {
  console.error('打包内容含有 </script，需要转义');
  process.exit(1);
}
for (const marker of ['/*__BUNDLE__*/', '/*__BUDDHA_GLB_BASE64__*/', '__BUDDHA_GLB_BYTES__', '__BUDDHA_GLB_SHA256__']) {
  if (!tpl.includes(marker)) {
    console.error('模板缺少占位符:', marker);
    process.exit(1);
  }
}
const html = tpl
  .replace('/*__BUDDHA_GLB_BASE64__*/', () => glbBase64)
  .replace('__BUDDHA_GLB_BYTES__', String(glb.length))
  .replace('__BUDDHA_GLB_SHA256__', glbSha256)
  .replace('/*__BUNDLE__*/', () => bundle);

fs.writeFileSync(OUT, html, 'utf8');
console.log('已生成:', OUT, (html.length / 1048576).toFixed(2) + ' MB');
console.log('彩绘佛像:', path.relative(ROOT, BUDDHA_ASSET), glb.length + ' bytes', glbSha256);
console.log('模块顺序:', files.join(' → '));
