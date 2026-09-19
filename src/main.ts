/**
 * CAD Viewer 应用主入口
 * 装配解析器、渲染器、相机控制器、测量工具及 DOM 交互界面
 */

import { DxfParser } from './parser/dxf-parser.ts';
import { convertDwgBufferToDxfString, inspectDwgHeader, type DwgHeaderInfo } from './parser/dwg-converter.ts';
import { CadRenderer } from './renderer/cad-renderer.ts';
import { CameraController } from './renderer/camera-controller.ts';
import { MeasureEngine } from './tools/measure-tool.ts';
import type { DxfEntity, DxfDocument, LineEntity, CircleEntity, ArcEntity, LwpolylineEntity, TextEntity, MTextEntity } from './parser/dxf-types.ts';
import {
  SAMPLE_MECHANICAL_FLANGE,
  SAMPLE_ARCHITECTURAL_PLAN,
  SAMPLE_BULGE_CURVED_PROFILE
} from './samples/fixtures.ts';

// 核心实例
const parser = new DxfParser();
const measureEngine = new MeasureEngine();

// DOM 元素引用
const canvas = document.getElementById('cad-canvas') as HTMLCanvasElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const btnOpenFile = document.getElementById('btn-open-file') as HTMLButtonElement;
const sampleSelect = document.getElementById('sample-select') as HTMLSelectElement;

const btnFitView = document.getElementById('btn-fit-view') as HTMLButtonElement;
const btnZoomIn = document.getElementById('btn-zoom-in') as HTMLButtonElement;
const btnZoomOut = document.getElementById('btn-zoom-out') as HTMLButtonElement;
const btnZoomReset = document.getElementById('btn-zoom-reset') as HTMLButtonElement;

const btnToolSelect = document.getElementById('btn-tool-select') as HTMLButtonElement;
const btnToolDist = document.getElementById('btn-tool-dist') as HTMLButtonElement;
const btnToolAngle = document.getElementById('btn-tool-angle') as HTMLButtonElement;
const btnToolClear = document.getElementById('btn-tool-clear') as HTMLButtonElement;

const btnToggleCrosshair = document.getElementById('btn-toggle-crosshair') as HTMLButtonElement;
const btnToggleSnap = document.getElementById('btn-toggle-snap') as HTMLButtonElement;
const btnToggleTheme = document.getElementById('btn-toggle-theme') as HTMLButtonElement;
const btnDwgHelp = document.getElementById('btn-dwg-help') as HTMLButtonElement;

const layersContainer = document.getElementById('layers-list-container') as HTMLDivElement;
const layerTotalCount = document.getElementById('layer-total-count') as HTMLSpanElement;
const btnLayersShowAll = document.getElementById('btn-layers-show-all') as HTMLButtonElement;
const btnLayersHideAll = document.getElementById('btn-layers-hide-all') as HTMLButtonElement;

const inspectorContainer = document.getElementById('inspector-container') as HTMLDivElement;
const measureListContainer = document.getElementById('measure-list-container') as HTMLDivElement;
const measureCount = document.getElementById('measure-count') as HTMLSpanElement;

const coordDisplay = document.getElementById('coord-display') as HTMLSpanElement;
const zoomLevelDisplay = document.getElementById('zoom-level-display') as HTMLSpanElement;
const docSummaryDisplay = document.getElementById('doc-summary-display') as HTMLSpanElement;
const statusMessage = document.getElementById('status-message') as HTMLSpanElement;

const dropOverlay = document.getElementById('drop-overlay') as HTMLDivElement;
const dwgModal = document.getElementById('dwg-modal') as HTMLDivElement;
const btnCloseModal = document.getElementById('btn-close-modal') as HTMLButtonElement;

const errorModal = document.getElementById('error-modal') as HTMLDivElement;
const errorModalBody = document.getElementById('error-modal-body') as HTMLDivElement;
const btnCloseErrorModal = document.getElementById('btn-close-error-modal') as HTMLButtonElement;
const btnCopyError = document.getElementById('btn-copy-error') as HTMLButtonElement;
let lastDiagnosticText = '';

function showErrorModal(file: File, headerInfo: DwgHeaderInfo | null, errorMsg: string): void {
  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
  const sizeKB = (file.size / 1024).toFixed(1);
  const sizeText = file.size > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
  const verName = headerInfo ? `${headerInfo.versionName} [${headerInfo.versionCode}]` : '未知版本';

  lastDiagnosticText = `[CAD Viewer DWG 解析诊断报告]
图纸名称: ${file.name}
文件体积: ${sizeText} (${file.size} 字节)
版本识别: ${verName}
浏览器代理: ${navigator.userAgent}
报错信息: ${errorMsg}
发生时间: ${new Date().toLocaleString()}`;

  errorModalBody.innerHTML = `
    <div style="background: rgba(255, 82, 82, 0.12); border-left: 3px solid #ff5252; padding: 10px 12px; margin-bottom: 12px; border-radius: 4px;">
      <div style="font-weight: 600; color: #ff5252; margin-bottom: 4px;">⚠️ 解码引擎中断原因：</div>
      <div style="word-break: break-all; font-family: monospace; font-size: 12px; color: var(--text-color);">${errorMsg}</div>
    </div>

    <div style="margin-bottom: 12px; font-size: 12px; color: var(--text-muted); line-height: 1.8;">
      <div>📁 <strong>图纸名称：</strong>${file.name}</div>
      <div>📦 <strong>文件体积：</strong>${sizeText}</div>
      <div>🏷 <strong>DWG 版本：</strong>${verName}</div>
    </div>

    <div style="border-top: 1px solid var(--border-color); padding-top: 10px;">
      <div style="font-weight: 600; margin-bottom: 6px; color: var(--accent);">💡 常见诊断与排查途径：</div>
      <ol style="margin: 0; padding-left: 18px; color: var(--text-color); font-size: 12px; line-height: 1.7;">
        <li><strong>天正/插件代理对象 (最常见)：</strong>如果施工图纸使用了“天正建筑 (TArch)”等 ObjectARX 插件绘制，纯前端标准引擎无法直接读取专有代理门窗/墙体。请在 CAD 中输入 <code>TXPOUT</code>（天正整图导出为标准 T3 格式）另存后打开。</li>
        <li><strong>高版本或超大图纸：</strong>若包含超复杂 3D 实体或图纸超过 10MB，可在 Mac 电脑端使用系统级自由软件命令行转换：<br><code style="background: rgba(255,255,255,0.08); padding: 2px 5px; border-radius: 3px; user-select: all;">./scripts/dwg-convert.sh "${file.name}"</code></li>
        <li><strong>导出为 DXF 格式：</strong>在 AutoCAD、中望或浩辰中将图纸「另存为」 <strong>AutoCAD 2004/2000 DXF</strong>，可 100% 顺畅秒开。</li>
      </ol>
    </div>
  `;

  errorModal.classList.add('active');
}

btnCloseErrorModal.addEventListener('click', () => {
  errorModal.classList.remove('active');
});

errorModal.addEventListener('click', (e) => {
  if (e.target === errorModal) {
    errorModal.classList.remove('active');
  }
});

btnCopyError.addEventListener('click', () => {
  if (!lastDiagnosticText) return;
  navigator.clipboard.writeText(lastDiagnosticText).then(() => {
    btnCopyError.textContent = '✅ 已复制诊断信息';
    setTimeout(() => {
      btnCopyError.textContent = '📋 复制诊断日志';
    }, 2000);
  }).catch(() => {
    alert('复制失败，请手动长按复制：\n\n' + lastDiagnosticText);
  });
});

// 移动端抽屉与遮罩
const btnMobileLayers = document.getElementById('btn-mobile-layers') as HTMLButtonElement | null;
const btnMobileInspector = document.getElementById('btn-mobile-inspector') as HTMLButtonElement | null;
const btnCloseLayersDrawer = document.getElementById('btn-close-layers-drawer') as HTMLButtonElement | null;
const btnCloseInspectorDrawer = document.getElementById('btn-close-inspector-drawer') as HTMLButtonElement | null;
const leftLayersPanel = document.getElementById('left-layers-panel') as HTMLElement | null;
const rightInspectorPanel = document.getElementById('right-inspector-panel') as HTMLElement | null;
const mobileBackdrop = document.getElementById('mobile-backdrop') as HTMLDivElement | null;

function closeAllDrawers(): void {
  leftLayersPanel?.classList.remove('mobile-open');
  rightInspectorPanel?.classList.remove('mobile-open');
  mobileBackdrop?.classList.remove('active');
}

btnMobileLayers?.addEventListener('click', () => {
  const isOpen = leftLayersPanel?.classList.contains('mobile-open');
  closeAllDrawers();
  if (!isOpen) {
    leftLayersPanel?.classList.add('mobile-open');
    mobileBackdrop?.classList.add('active');
  }
});

btnMobileInspector?.addEventListener('click', () => {
  const isOpen = rightInspectorPanel?.classList.contains('mobile-open');
  closeAllDrawers();
  if (!isOpen) {
    rightInspectorPanel?.classList.add('mobile-open');
    mobileBackdrop?.classList.add('active');
  }
});

btnCloseLayersDrawer?.addEventListener('click', closeAllDrawers);
btnCloseInspectorDrawer?.addEventListener('click', closeAllDrawers);
mobileBackdrop?.addEventListener('click', closeAllDrawers);

// 初始化渲染器
const renderer = new CadRenderer(canvas);
renderer.measureEngine = measureEngine;

// 初始化交互控制器
new CameraController(renderer, canvas, {
  onCursorMove: (world) => {
    coordDisplay.textContent = `X: ${world.x.toFixed(2)} mm  Y: ${world.y.toFixed(2)} mm`;
    zoomLevelDisplay.textContent = `缩放: ${(renderer.camera.zoom * 100).toFixed(0)}%`;
  },
  onEntitySelected: (entity) => {
    renderInspector(entity);
  },
  onMeasurementAdded: () => {
    renderMeasurementList();
  }
});

// 监听窗口尺寸变化
window.addEventListener('resize', () => {
  renderer.updateSize();
});

/**
 * 加载并展示 DXF 文档
 */
function loadDxfContent(content: string, fileName: string): void {
  try {
    statusMessage.textContent = '正在解析 DXF...';
    const startTime = performance.now();
    const doc = parser.parse(content, fileName);
    const duration = (performance.now() - startTime).toFixed(1);

    renderer.setDocument(doc);
    renderLayersPanel(doc);
    renderInspector(null);
    measureEngine.clear();
    renderMeasurementList();

    statusMessage.textContent = `就绪 (解析耗时 ${duration}ms)`;
    docSummaryDisplay.textContent = `${fileName} | 图层: ${doc.layers.size} | 实体: ${doc.entities.length}`;
    zoomLevelDisplay.textContent = `缩放: ${(renderer.camera.zoom * 100).toFixed(0)}%`;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    alert(`解析 DXF 失败: ${message}`);
    statusMessage.textContent = '解析出错';
  }
}

/**
 * 渲染左侧图层列表面板
 */
function renderLayersPanel(doc: DxfDocument): void {
  layerTotalCount.textContent = doc.layers.size.toString();
  layersContainer.innerHTML = '';

  doc.layers.forEach((layer) => {
    const item = document.createElement('div');
    item.className = 'layer-item';

    const left = document.createElement('div');
    left.className = 'layer-info';

    const colorPill = document.createElement('div');
    colorPill.className = 'layer-color-pill';
    colorPill.style.backgroundColor = layer.color;
    colorPill.title = `颜色: ${layer.color} (ACI: ${layer.colorIndex})`;

    const nameSpan = document.createElement('span');
    nameSpan.textContent = layer.name;
    nameSpan.title = layer.name;

    left.appendChild(colorPill);
    left.appendChild(nameSpan);

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.style.gap = '6px';

    const countBadge = document.createElement('span');
    countBadge.className = 'layer-count-badge';
    countBadge.textContent = (layer.entityCount || 0).toString();

    const toggleBtn = document.createElement('button');
    toggleBtn.className = `layer-toggle-btn ${layer.visible ? 'visible' : ''}`;
    toggleBtn.textContent = layer.visible ? '👁' : '🚫';
    toggleBtn.title = layer.visible ? '点击隐藏图层' : '点击显示图层';

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      layer.visible = !layer.visible;
      toggleBtn.className = `layer-toggle-btn ${layer.visible ? 'visible' : ''}`;
      toggleBtn.textContent = layer.visible ? '👁' : '🚫';
      renderer.requestRender();
    });

    right.appendChild(countBadge);
    right.appendChild(toggleBtn);

    item.appendChild(left);
    item.appendChild(right);
    layersContainer.appendChild(item);
  });
}

/**
 * 渲染右侧属性检查器面板
 */
function renderInspector(entity: DxfEntity | null): void {
  if (!entity) {
    inspectorContainer.innerHTML = `
      <div style="color: var(--text-muted); font-size: 12px; text-align: center; margin-top: 20px;">
        点击图纸中的实体以查看属性
      </div>
    `;
    return;
  }

  let html = `
    <div class="prop-group">
      <div class="prop-group-title">基本属性</div>
      <div class="prop-row"><span class="prop-key">类型</span><span class="prop-val">${entity.type}</span></div>
      <div class="prop-row"><span class="prop-key">图层</span><span class="prop-val">${entity.layer}</span></div>
      <div class="prop-row"><span class="prop-key">颜色</span><span class="prop-val">${entity.color || 'ByLayer'}</span></div>
      ${entity.handle ? `<div class="prop-row"><span class="prop-key">句柄</span><span class="prop-val">${entity.handle}</span></div>` : ''}
    </div>
  `;

  html += `<div class="prop-group"><div class="prop-group-title">几何参数</div>`;

  switch (entity.type) {
    case 'LINE': {
      const l = entity as LineEntity;
      const dx = l.end.x - l.start.x;
      const dy = l.end.y - l.start.y;
      const len = Math.hypot(dx, dy);
      html += `
        <div class="prop-row"><span class="prop-key">起点</span><span class="prop-val">(${l.start.x.toFixed(2)}, ${l.start.y.toFixed(2)})</span></div>
        <div class="prop-row"><span class="prop-key">终点</span><span class="prop-val">(${l.end.x.toFixed(2)}, ${l.end.y.toFixed(2)})</span></div>
        <div class="prop-row"><span class="prop-key">长度</span><span class="prop-val">${len.toFixed(2)} mm</span></div>
        <div class="prop-row"><span class="prop-key">角度</span><span class="prop-val">${((Math.atan2(dy, dx) * 180) / Math.PI).toFixed(1)}°</span></div>
      `;
      break;
    }

    case 'CIRCLE': {
      const c = entity as CircleEntity;
      html += `
        <div class="prop-row"><span class="prop-key">圆心</span><span class="prop-val">(${c.center.x.toFixed(2)}, ${c.center.y.toFixed(2)})</span></div>
        <div class="prop-row"><span class="prop-key">半径</span><span class="prop-val">${c.radius.toFixed(2)} mm</span></div>
        <div class="prop-row"><span class="prop-key">直径</span><span class="prop-val">${(c.radius * 2).toFixed(2)} mm</span></div>
        <div class="prop-row"><span class="prop-key">周长</span><span class="prop-val">${(2 * Math.PI * c.radius).toFixed(2)} mm</span></div>
      `;
      break;
    }

    case 'ARC': {
      const a = entity as ArcEntity;
      html += `
        <div class="prop-row"><span class="prop-key">圆心</span><span class="prop-val">(${a.center.x.toFixed(2)}, ${a.center.y.toFixed(2)})</span></div>
        <div class="prop-row"><span class="prop-key">半径</span><span class="prop-val">${a.radius.toFixed(2)} mm</span></div>
        <div class="prop-row"><span class="prop-key">起始角</span><span class="prop-val">${a.startAngle.toFixed(1)}°</span></div>
        <div class="prop-row"><span class="prop-key">终止角</span><span class="prop-val">${a.endAngle.toFixed(1)}°</span></div>
      `;
      break;
    }

    case 'LWPOLYLINE':
    case 'POLYLINE': {
      const p = entity as LwpolylineEntity;
      html += `
        <div class="prop-row"><span class="prop-key">顶点数</span><span class="prop-val">${p.vertices.length}</span></div>
        <div class="prop-row"><span class="prop-key">闭合</span><span class="prop-val">${p.isClosed ? '是' : '否'}</span></div>
      `;
      break;
    }

    case 'TEXT':
    case 'MTEXT': {
      const t = entity as (TextEntity | MTextEntity);
      html += `
        <div class="prop-row"><span class="prop-key">内容</span><span class="prop-val" title="${t.text}">${t.text}</span></div>
        <div class="prop-row"><span class="prop-key">字高</span><span class="prop-val">${t.height.toFixed(2)}</span></div>
        <div class="prop-row"><span class="prop-key">位置</span><span class="prop-val">(${t.position.x.toFixed(2)}, ${t.position.y.toFixed(2)})</span></div>
      `;
      break;
    }

    default:
      break;
  }

  html += `</div>`;
  inspectorContainer.innerHTML = html;
}

/**
 * 渲染测量记录面板
 */
function renderMeasurementList(): void {
  const list = measureEngine.measurements;
  measureCount.textContent = list.length.toString();

  if (list.length === 0) {
    measureListContainer.innerHTML = `
      <div style="color: var(--text-muted); font-size: 12px; text-align: center; margin-top: 10px;">
        暂无测量数据
      </div>
    `;
    return;
  }

  let html = '';
  list.forEach((m, idx) => {
    if (m.type === 'DISTANCE') {
      html += `
        <div style="font-size: 11px; padding: 4px; margin-bottom: 4px; background: rgba(0,255,170,0.08); border-left: 3px solid ${m.color}; border-radius: 2px;">
          <strong>#${idx + 1} 距离: ${m.distance.toFixed(2)} mm</strong><br>
          <span style="color: var(--text-muted); font-size: 10px;">ΔX: ${m.deltaX.toFixed(2)} | ΔY: ${m.deltaY.toFixed(2)}</span>
        </div>
      `;
    } else if (m.type === 'ANGLE') {
      html += `
        <div style="font-size: 11px; padding: 4px; margin-bottom: 4px; background: rgba(255,204,0,0.08); border-left: 3px solid ${m.color}; border-radius: 2px;">
          <strong>#${idx + 1} 夹角: ${m.angleDeg.toFixed(1)}°</strong>
        </div>
      `;
    }
  });

  measureListContainer.innerHTML = html;
}

// 按钮模式切换函数
function setActiveToolButton(btn: HTMLButtonElement): void {
  [btnToolSelect, btnToolDist, btnToolAngle].forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
}

// 事件绑定
btnOpenFile.addEventListener('click', () => fileInput.click());

/**
 * 统一处理外部传入的文件 (自动识别并支持 DXF 与 DWG 双格式直接读取)
 */
async function handleIncomingFile(file: File): Promise<void> {
  const fileName = file.name;
  const lower = fileName.toLowerCase();

  if (lower.endsWith('.dxf')) {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        loadDxfContent(reader.result, fileName);
      }
    };
    reader.readAsText(file);
  } else if (lower.endsWith('.dwg')) {
    let headerInfo: DwgHeaderInfo | null = null;
    try {
      statusMessage.textContent = '正在读取 DWG 文件数据...';
      const arrayBuffer = await file.arrayBuffer();
      headerInfo = inspectDwgHeader(arrayBuffer);
      console.log('检测到 DWG 文件:', fileName, '版本:', headerInfo);

      const dxfString = await convertDwgBufferToDxfString(arrayBuffer, (msg) => {
        statusMessage.textContent = msg;
      });
      loadDxfContent(dxfString, fileName);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('DWG 解码失败:', err);
      showErrorModal(file, headerInfo, msg);
      statusMessage.textContent = 'DWG 解码中断 (已展开诊断详情)';
    }
  } else {
    alert('请选择或拖入 .dxf 或 .dwg 格式图纸文件。');
  }
}

fileInput.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  handleIncomingFile(file);
  fileInput.value = '';
});

// 样例选择
sampleSelect.addEventListener('change', () => {
  const val = sampleSelect.value;
  if (val === 'FLANGE') {
    loadDxfContent(SAMPLE_MECHANICAL_FLANGE, 'mechanical-flange-pcd210.dxf');
  } else if (val === 'ARCH') {
    loadDxfContent(SAMPLE_ARCHITECTURAL_PLAN, 'architectural-floor-plan.dxf');
  } else if (val === 'BULGE') {
    loadDxfContent(SAMPLE_BULGE_CURVED_PROFILE, 'bulge-curved-profile.dxf');
  }
});

// 视口操作
btnFitView.addEventListener('click', () => renderer.fitToView());
btnZoomIn.addEventListener('click', () => {
  renderer.camera.zoom *= 1.25;
  renderer.requestRender();
  zoomLevelDisplay.textContent = `缩放: ${(renderer.camera.zoom * 100).toFixed(0)}%`;
});
btnZoomOut.addEventListener('click', () => {
  renderer.camera.zoom /= 1.25;
  renderer.requestRender();
  zoomLevelDisplay.textContent = `缩放: ${(renderer.camera.zoom * 100).toFixed(0)}%`;
});
btnZoomReset.addEventListener('click', () => {
  renderer.camera.zoom = 1.0;
  renderer.requestRender();
  zoomLevelDisplay.textContent = `缩放: 100%`;
});

// 测量工具
btnToolSelect.addEventListener('click', () => {
  setActiveToolButton(btnToolSelect);
  measureEngine.setMode('NONE');
  statusMessage.textContent = '实体拾取模式：点击实体查看属性';
  renderer.requestRender();
});

btnToolDist.addEventListener('click', () => {
  setActiveToolButton(btnToolDist);
  measureEngine.setMode('DISTANCE');
  statusMessage.textContent = '测距模式：请依次点击起点与终点';
  renderer.requestRender();
});

btnToolAngle.addEventListener('click', () => {
  setActiveToolButton(btnToolAngle);
  measureEngine.setMode('ANGLE');
  statusMessage.textContent = '测角模式：请依次点击射线端点1、顶点、射线端点2';
  renderer.requestRender();
});

btnToolClear.addEventListener('click', () => {
  measureEngine.clear();
  renderMeasurementList();
  renderer.requestRender();
});

// 选项切换
btnToggleCrosshair.addEventListener('click', () => {
  renderer.options.showCrosshair = !renderer.options.showCrosshair;
  btnToggleCrosshair.classList.toggle('active', renderer.options.showCrosshair);
  renderer.requestRender();
});

btnToggleSnap.addEventListener('click', () => {
  renderer.options.showSnap = !renderer.options.showSnap;
  btnToggleSnap.classList.toggle('active', renderer.options.showSnap);
  renderer.requestRender();
});

btnToggleTheme.addEventListener('click', () => {
  renderer.options.theme = renderer.options.theme === 'DARK' ? 'LIGHT' : 'DARK';
  renderer.requestRender();
});

btnDwgHelp.addEventListener('click', () => {
  dwgModal.classList.add('active');
});

btnCloseModal.addEventListener('click', () => {
  dwgModal.classList.remove('active');
});

dwgModal.addEventListener('click', (e) => {
  if (e.target === dwgModal) {
    dwgModal.classList.remove('active');
  }
});

// 图层全显与全隐
btnLayersShowAll.addEventListener('click', () => {
  if (!renderer.getDocument()) return;
  renderer.getDocument()!.layers.forEach((l) => (l.visible = true));
  renderLayersPanel(renderer.getDocument()!);
  renderer.requestRender();
});

btnLayersHideAll.addEventListener('click', () => {
  if (!renderer.getDocument()) return;
  renderer.getDocument()!.layers.forEach((l) => (l.visible = false));
  renderLayersPanel(renderer.getDocument()!);
  renderer.requestRender();
});

// 文件拖放 (Drag & Drop)
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropOverlay.classList.add('active');
});

window.addEventListener('dragleave', (e) => {
  if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
    dropOverlay.classList.remove('active');
  }
});

window.addEventListener('drop', (e) => {
  e.preventDefault();
  dropOverlay.classList.remove('active');
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  handleIncomingFile(file);
});

// 默认直接载入机械法兰样例图，立即可见
loadDxfContent(SAMPLE_MECHANICAL_FLANGE, 'mechanical-flange-pcd210.dxf');

// 注册 PWA 离线 Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      console.log('PWA ServiceWorker registered with scope:', reg.scope);
      reg.update().catch(() => {});
    }).catch((err) => {
      console.warn('PWA ServiceWorker registration failed:', err);
    });
  });
}
