# CAD Viewer (DXF / DWG)

轻量、零授权费、纯前端的本地 2D CAD 查看器。

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
