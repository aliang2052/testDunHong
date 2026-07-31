# Round 2 独立验收记录

## 结论

Round 2 的功能门禁通过，但视觉门禁不通过，暂不进入主分支。

## 已通过

- 所有 `mogao/src/*.js` 与 `mogao/build.js` 通过 `node --check`。
- `node mogao/build.js` 成功生成离线单文件网页。
- 重新构建文件大小：1,512,857 bytes。
- 重新构建 SHA-256：`c88f823a56302f0efd01e11e3a337b1a3d42882b2e8afe851b5ad034b530098f`。
- 重新构建文件与 Pro 交付 HTML 逐字节一致。
- 第三方 Three.js 文件与基线一致。
- 独立浏览器验证通过：16 个章节、章节点击后播放、播放/暂停、2 倍速、自由视角、390×844 布局、16 个绝对时间关键帧、无远程请求、无 `<video>`、无页面异常。

## 阻断性视觉问题

- 20 秒栈道施工镜头被屋檐与构件遮挡，主体不可读。
- 25–49 秒崖壁仍表现为大面积平面木纹，缺少砂岩体积、侵蚀层次、洞窟深度与可信阴影。
- 60–86 秒工具、木桩与泥团比例失真并存在悬浮，部分镜头被近裁或背景板切断。
- 92 秒佛像仍有明显玩具/卡通感，螺发、五官、衣褶、头光和表面材质缺少历史质感。
- 101/106 秒壁画阶段严重裁切，绝大部分画面为空白崖壁，施工对象仅在右侧露出一小部分。
- 112/116 秒九层楼仍接近简化积木，斗拱、瓦片、木材粗糙度、环境雾和空间阴影不足。

## 证据

- 独立报告：`mogao-evidence/verification-pro/report.json`
- 独立关键帧：`mogao-evidence/verification-pro/t*.png`
- 独立联系表：`mogao-evidence/verification-pro/contact.png`
- 反馈用压缩联系表：`mogao-evidence/verification-pro/contact-review.jpg`

Round 3 已把上述问题、独立截图和 540p 压缩参考视频反馈给 ChatGPT Pro，要求在保持功能门禁的同时修正。
