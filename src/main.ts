/**
 * CAD Viewer 应用主入口
 * 装配解析器、渲染器、相机控制器、测量工具及 DOM 交互界面
 */

import { DxfParser } from './parser/dxf-parser.ts';
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

fileInput.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      loadDxfContent(reader.result, file.name);
    }
  };
  reader.readAsText(file);
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

  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.dxf')) {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        loadDxfContent(reader.result, file.name);
      }
    };
    reader.readAsText(file);
  } else if (fileName.endsWith('.dwg')) {
    alert(
      `检测到 DWG 二进制格式文件: ${file.name}。\n\n请在终端中使用配套的自由软件转换脚本转换为 DXF：\n./scripts/dwg-convert.sh "${file.name}"\n转换后拖入本窗口即可查看。`
    );
  } else {
    alert('请选择或拖入 .dxf 格式文件。');
  }
});

// 默认直接载入机械法兰样例图，立即可见
loadDxfContent(SAMPLE_MECHANICAL_FLANGE, 'mechanical-flange-pcd210.dxf');
