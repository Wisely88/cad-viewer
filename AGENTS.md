# cad-viewer 代理协作规范与项目规格

## 一、项目定位与核心边界
1. **项目定位**：本地 2D CAD 查看器。原生 iOS LiteCAD 是大 DWG 主路线；Web/PWA 保留为零后端的轻量 DXF/小图备用路线。
2. **核心原则**：
   - **零后端**：图纸完全保留在本地浏览器内存，不上传任何服务器，无需 FastAPI/Docker/数据库。
   - **DXF 核心**：纯 TypeScript 编写 DXF 解析器与图形场景，一次解析，GPU 持续渲染，平移/缩放零重复解析。
   - **Web DWG 适配**：规避 QCAD Community Edition 闭源插件陷阱，使用开源自由软件 GNU LibreDWG (`dwg2dxf`) 作为本机外部转换适配器；不把大 DWG 的 WebAssembly/Canvas 性能作为主路线。
   - **原生 DWG 适配**：iOS 通过 C/Objective-C++ bridge 调用原生 LibreDWG，输出紧凑 Scene Graph；渲染层必须保留 BLOCK definition 与 INSERT instance，不得先扁平复制全部实例几何。
   - **实体优先级**：LINE → LWPOLYLINE/POLYLINE（支持 Bulge 凸度圆弧插值）→ CIRCLE → ARC → TEXT/MTEXT → INSERT（支持平移/旋转/缩放/嵌套）→ DIMENSION。
   - **完整包围盒**：Fit-to-View 包围盒计算必须覆盖包含圆弧象限极值、多段线、椭圆及展开后的 BLOCK 实体。

## 二、开发与门禁命令
项目根目录下必须保证以下命令通过：
```bash
npm run lint    # tsc --noEmit
npm run test    # node --experimental-strip-types --test tests/**/*.test.ts
npm run build   # tsc && vite build
```

原生核心可独立验证：
```bash
swift test --package-path ios/LiteCADCore
```
默认 iPhoneOS App target 可无 LibreDWG 归档构建；启用真实 bridge 时，先按
`ios/LibreDWGBridge/README.md` 构建外部 arm64 归档，再执行其中的
bridge-enabled `xcodebuild` 命令。不得把静态构建结果冒充为真实 DWG 真机
解析或性能验证。

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
├── ios/
│   ├── LiteCADCore/             # 可独立测试的 Scene Graph 与几何契约
│   └── LibreDWGBridge/          # 原生 DWG C adapter 与可复现 iOS 构建脚本
├── scripts/
│   └── dwg-convert.sh              # LibreDWG 本机转换脚本
└── tests/
    ├── dxf-parser.test.ts          # 解析器单元测试
    └── bounding-box.test.ts        # 包围盒与空间计算测试
```
