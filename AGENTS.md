# cad-viewer 代理协作规范与项目规格

## 一、项目定位与核心边界
1. **项目定位**：纯前端、零授权费、轻量级本地 2D CAD (DXF/DWG) Web 查看器。
2. **核心原则**：
   - **零后端**：图纸完全保留在本地浏览器内存，不上传任何服务器，无需 FastAPI/Docker/数据库。
   - **DXF 核心**：纯 TypeScript 编写 DXF 解析器与图形场景，一次解析，GPU 持续渲染，平移/缩放零重复解析。
   - **DWG 适配**：规避 QCAD Community Edition 闭源插件陷阱，使用开源自由软件 GNU LibreDWG (`dwg2dxf`) 作为本机外部转换适配器。
   - **实体优先级**：LINE → LWPOLYLINE/POLYLINE（支持 Bulge 凸度圆弧插值）→ CIRCLE → ARC → TEXT/MTEXT → INSERT（支持平移/旋转/缩放/嵌套）→ DIMENSION。
   - **完整包围盒**：Fit-to-View 包围盒计算必须覆盖包含圆弧象限极值、多段线、椭圆及展开后的 BLOCK 实体。

## 二、开发与门禁命令
项目根目录下必须保证以下命令通过：
```bash
npm run lint    # tsc --noEmit
npm run test    # node --experimental-strip-types --test tests/**/*.test.ts
npm run build   # tsc && vite build
```

## 三、目录结构
```
cad-viewer/
├── AGENTS.md
├── DEVELOPMENT_GOVERNANCE.md (继承上级治理)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── src/
│   ├── main.ts                     # 应用入口与事件装配
│   ├── parser/                     # DXF 核心解析器
│   │   ├── dxf-types.ts            # DXF 实体定义与 ACI 色表
│   │   ├── dxf-parser.ts           # 流式 Group Code 解析器
│   │   └── bounding-box.ts         # 几何包围盒与 Extents 计算
│   ├── renderer/                   # 2D 绘图与渲染器
│   │   ├── cad-renderer.ts         # 视图变换、图层管理、拾取高亮
│   │   └── camera-controller.ts    # 缩放平移交互控制
│   ├── tools/                      # 测量工具
│   │   └── measure-tool.ts         # 距离/角度测量与吸附
│   └── samples/                    # 内置测试样例
│       └── fixtures.ts             # 机械零件、建筑图与嵌套块样例
├── scripts/
│   └── dwg-convert.sh              # LibreDWG 本机转换脚本
└── tests/
    ├── dxf-parser.test.ts          # 解析器单元测试
    └── bounding-box.test.ts        # 包围盒与空间计算测试
```
