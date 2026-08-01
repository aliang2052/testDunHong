# 敦煌莫高窟第 96 窟建造全过程

这是参考 116.373 秒竖屏视频制作的交互式实时 3D 网页源码。它通过程序化几何、材质、粒子、施工工具和确定性时间轴展示栈道搭建、洞窟开凿、石胎塑形、逐层敷泥、收光、彩绘、壁面装饰和九层楼复原，不嵌入或播放原视频。

当前 Round 8 版本包含 16 个可点击、可独立播放的施工章节，支持暂停、倍速、进度拖拽和桌面自由视角。最终画布按产品要求采用 16:9 横屏构图；Three.js 与业务代码内联，佛像和崖体使用仓库内本地资产，不依赖网络。

Round 8 已针对栈道、洞窟开凿、坐佛比例、插桩/敷泥、壁画、风蚀崖体和九层楼终景完成独立视觉修正。完整证据与诚实边界见 [Round 8 独立验收](docs/ROUND8_INDEPENDENT_REVIEW.md)。

## 本地运行

推荐启动本地静态服务：

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

然后访问 `http://127.0.0.1:4173/`。也可以直接打开根目录的 `index.html`。重新构建：

```bash
node mogao/build.js index.html
```

生成页无需后端和外部网络。

## 源码结构

- `mogao/src/`：程序化几何、材质、场景、时间轴、标注和主程序
- `mogao/lib/`：离线内联的 Three.js
- `mogao/template.html`：界面模板
- `mogao/build.js`：生成单文件 HTML
- `mogao/shot.js`：关键时间点截图自检
- `mogao/verify.js`：16 个关键帧及交互门禁验收
- `mogao/verify-round8.js`：默认暂停、章节边界和 604×816 DPR2 专项门禁
- `docs/CHATGPT_PRO_TASK.md`：详细工程任务、测试和验收标准
- `docs/VIDEO_ANALYSIS.md`：参考视频阶段分析
- `docs/ROUND8_INDEPENDENT_REVIEW.md`：Round 8 修改、证据、哈希与剩余风险

## 基线信息

- 原工作目录不是 Git 仓库，因此首次推送前没有源 commit。
- 脱敏源码 ZIP：499,688 bytes
- ZIP SHA-256：`320e361da5de551e3f27879c7cbcd17c7c116a522358dca36abf357e79e72fee`
- 参考视频 SHA-256：`bd0a346b84117ddd3fda3f267de5ebeccb95ccaebc1125e312dbf08421cb5df3`
- 原视频不进入 Git 历史。

## 权限与限制

未经用户另行授权，不得部署、修改线上配置、迁移数据或操作真实用户数据。
