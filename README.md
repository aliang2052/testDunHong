# 敦煌莫高窟第 96 窟建造全过程

当前代码已回退到 ChatGPT Pro 的 **Round 2** 原始交付，保留其模型、材质、时间轴和 9:16 竖屏构图。网页通过程序化几何、材质、粒子、施工工具和确定性时间轴展示栈道搭建、洞窟开凿、石胎塑形、逐层敷泥、收光、彩绘、壁面装饰和九层楼复原，不嵌入或播放原视频。

当前版本包含 16 个可点击、可独立播放的施工章节，支持暂停、倍速、进度拖拽和桌面自由视角。全部运行资源内联，可离线打开。

> 自动化功能门禁已经通过；程序化模型与参考视频仍存在可见写实度差距。完整结论见 [最终独立验收](docs/FINAL_INDEPENDENT_REVIEW.md)，不能把功能通过误写成 100% 视觉复刻。

## 本地运行

直接打开根目录的 `index.html`，或重新构建：

```bash
node mogao/build.js index.html
```

生成页无需后端、无需网络。

## 源码结构

- `mogao/src/`：程序化几何、材质、场景、时间轴、标注和主程序
- `mogao/lib/`：离线内联的 Three.js
- `mogao/template.html`：界面模板
- `mogao/build.js`：生成单文件 HTML
- `mogao/shot.js`：关键时间点截图自检
- `mogao/verify.js`：16 个关键帧及交互门禁验收
- `docs/CHATGPT_PRO_TASK.md`：详细工程任务、测试和验收标准
- `docs/VIDEO_ANALYSIS.md`：参考视频阶段分析

## 基线信息

- 原工作目录不是 Git 仓库，因此首次推送前没有源 commit。
- 脱敏源码 ZIP：499,688 bytes
- ZIP SHA-256：`320e361da5de551e3f27879c7cbcd17c7c116a522358dca36abf357e79e72fee`
- 参考视频 SHA-256：`bd0a346b84117ddd3fda3f267de5ebeccb95ccaebc1125e312dbf08421cb5df3`
- 原视频不进入 Git 历史。

## 权限与限制

未经用户另行授权，不得部署、修改线上配置、迁移数据或操作真实用户数据。
