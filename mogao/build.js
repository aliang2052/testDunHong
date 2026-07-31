#!/usr/bin/env node
/* 把 three.module.js + src/*.js 打包进单个 HTML（可直接 file:// 打开） */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = process.argv[2] || path.join(ROOT, '..', '敦煌莫高窟大佛建造全过程.html');

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
const html = tpl.replace('/*__BUNDLE__*/', () => bundle);

fs.writeFileSync(OUT, html, 'utf8');
console.log('已生成:', OUT, (html.length / 1048576).toFixed(2) + ' MB');
console.log('模块顺序:', files.join(' → '));
