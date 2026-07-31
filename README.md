# 敦煌莫高窟第 96 窟建造全过程

这是参考 116.373 秒竖屏视频制作的交互式实时 3D 网页源码。目标是通过程序化几何、材质、粒子和时间轴展示栈道搭建、洞窟开凿、石胎塑形、逐层敷泥、收光、彩绘、壁画和九层楼复原，而不是嵌入或播放原视频。

> 当前仓库首次提交的是待重制基线。用户已经否决现有视觉表现，原因是施工变化不够明显，主观感受近似静态图片。外部工程师必须阅读 [任务说明](docs/CHATGPT_PRO_TASK.md)，不能把当前效果当作已验收成品。

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
