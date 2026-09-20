# CAD Viewer (DXF / DWG)

本地 2D CAD 查看器。原生 iOS LiteCAD 面向大 DWG；现有 Web/PWA 保留为轻量 DXF/小图备用路线。

## 原生 iOS 路线

原生路线采用：

```text
本地 DWG → LibreDWG C/Objective-C++ → LiteCAD Scene Graph
         → Block Definition + Instance Matrix → Metal
```

当前原生切片已经包含可测试的 `ios/LiteCADCore`、iPhone 文件选择、Metal
视口、LibreDWG C adapter 和 Swift collector。LibreDWG 源码固定到已验证的
commit，并通过脚本构建 iPhoneOS arm64 静态归档；归档不进入仓库，避免把
外部 GPLv3+ 依赖伪装成已审查的发布物。真实 AC1021/R2007 文件已经完成模拟机
和物理 iPhone 回放验证，初版已可用于本地查看、测量、标注、历史重开和 DXF
副本导出。原生 DWG 回写、完整 HATCH 洞口填充和自定义线型传输仍明确不纳入
初版交付。

原生 App 另有独立的 **3D 扫描**入口：

- **家装设计 3D 扫描**：基于 RoomPlan 扫描房间、墙面、门窗和可识别家具。
- **景物静物扫描**：基于 Object Capture + Photogrammetry 将家具、设备、摆件或器件拍摄生成 USDZ。
- 两个模块分别保存扫描文件，并支持重新打开、分享/云端、删除，以及 3D 预览中的旋转、平移和缩放。

## 特色
- 🚀 **纯本地与零后端**：图纸不上传服务器，毫秒级本地直接解析与渲染。
- 🎯 **DXF 优先**：支持 LINE、LWPOLYLINE（Bulge 圆弧插值）、CIRCLE、ARC、ELLIPSE、TEXT、MTEXT、INSERT（多级嵌套块）、DIMENSION。
- 📐 **完整交互**：
  - 滚轮平滑缩放与拖拽平移（以指针为中心）
  - Fit-to-View 全图自适应（准确包围盒算法）
  - 图层管理器（开关可见性、颜色指示）
  - 实体拾取与检查（点击查看坐标、图层、类型、长度、半径等）
  - 测距与测角工具（实时标注）
  - AutoCAD 风格全屏十字光标与实时世界坐标跟踪
- 🔄 **DWG 零授权费支持**：配套 `scripts/dwg-convert.sh`，基于开源 GNU LibreDWG (`dwg2dxf`) 实现本地透明格式转换。

## 快速使用
```bash
# 启动本地开发与查看器服务
npm run dev

# 构建生产包
npm run build
```

## DWG 转换脚本
```bash
./scripts/dwg-convert.sh your_drawing.dwg
# 生成的 DXF 将自动输出，可直接拖入浏览器查看
```
