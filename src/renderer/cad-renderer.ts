/**
 * CAD 2D 绘图与视口渲染引擎
 * 支持高精度世界-屏幕坐标映射、图层可见性快速切换、实体拾取高亮、AutoCAD 风格十字光标
 */

import type {
  DxfDocument,
  DxfEntity,
  LineEntity,
  CircleEntity,
  ArcEntity,
  EllipseEntity,
  LwpolylineEntity,
  PolylineEntity,
  TextEntity,
  MTextEntity,
  SplineEntity,
  Point2D,
  BoundingBox
} from '../parser/dxf-types.ts';
import { interpolateBulge } from '../parser/dxf-parser.ts';
import { isAngleBetween } from '../parser/bounding-box.ts';
import type { MeasureEngine, SnapResult } from '../tools/measure-tool.ts';

export interface CameraState {
  centerX: number; // 视口中心所对应的世界坐标 X
  centerY: number; // 视口中心所对应的世界坐标 Y
  zoom: number;    // 缩放系数 (屏幕像素 / 世界单位)
}

export interface RenderOptions {
  theme: 'DARK' | 'LIGHT';
  showCrosshair: boolean;
  showSnap: boolean;
}

export class CadRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private doc: DxfDocument | null = null;

  public camera: CameraState = {
    centerX: 0,
    centerY: 0,
    zoom: 1.0
  };

  public options: RenderOptions = {
    theme: 'DARK',
    showCrosshair: true,
    showSnap: true
  };

  public selectedEntity: DxfEntity | null = null;
  public hoveredEntity: DxfEntity | null = null;
  public cursorWorld: Point2D = { x: 0, y: 0 };
  public cursorScreen: Point2D = { x: 0, y: 0 };
  public activeSnap: SnapResult | null = null;
  public measureEngine: MeasureEngine | null = null;

  private dpr: number = 1.0;
  private animationFrameId: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Canvas 2D rendering context not supported');
    }
    this.ctx = context;
    this.updateSize();
  }

  public updateSize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1.0;
    this.canvas.width = Math.max(1, Math.floor(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * this.dpr));
    this.requestRender();
  }

  public setDocument(doc: DxfDocument): void {
    this.doc = doc;
    this.selectedEntity = null;
    this.hoveredEntity = null;
    this.fitToView();
  }

  public getDocument(): DxfDocument | null {
    return this.doc;
  }

  /**
   * 自适应全图 (Fit to View / Zoom Extents)
   */
  public fitToView(): void {
    if (!this.doc) return;
    const bbox: BoundingBox = this.doc.boundingBox;
    const w = bbox.maxX - bbox.minX;
    const h = bbox.maxY - bbox.minY;

    if (w <= 0 || h <= 0) return;

    this.camera.centerX = (bbox.minX + bbox.maxX) / 2;
    this.camera.centerY = (bbox.minY + bbox.maxY) / 2;

    const screenW = this.canvas.width / this.dpr;
    const screenH = this.canvas.height / this.dpr;

    // 留出 8% 边距
    const margin = 0.92;
    const zoomX = (screenW * margin) / w;
    const zoomY = (screenH * margin) / h;

    this.camera.zoom = Math.min(zoomX, zoomY);
    this.requestRender();
  }

  /**
   * 坐标转换：世界坐标 (CAD) -> 屏幕像素坐标 (Canvas)
   * CAD Y 朝上，屏幕 Y 朝下
   */
  public worldToScreen(wx: number, wy: number): Point2D {
    const screenW = this.canvas.width / this.dpr;
    const screenH = this.canvas.height / this.dpr;
    return {
      x: (wx - this.camera.centerX) * this.camera.zoom + screenW / 2,
      y: screenH / 2 - (wy - this.camera.centerY) * this.camera.zoom
    };
  }

  /**
   * 坐标转换：屏幕像素坐标 (Canvas) -> 世界坐标 (CAD)
   */
  public screenToWorld(sx: number, sy: number): Point2D {
    const screenW = this.canvas.width / this.dpr;
    const screenH = this.canvas.height / this.dpr;
    return {
      x: (sx - screenW / 2) / this.camera.zoom + this.camera.centerX,
      y: this.camera.centerY - (sy - screenH / 2) / this.camera.zoom
    };
  }

  public requestRender(): void {
    if (this.animationFrameId !== null) return;
    this.animationFrameId = requestAnimationFrame(() => {
      this.animationFrameId = null;
      this.render();
    });
  }

  /**
   * 主渲染管线
   */
  public render(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.save();
    // 支持 Retina / High-DPI
    ctx.scale(this.dpr, this.dpr);
    const screenW = w / this.dpr;
    const screenH = h / this.dpr;

    // 1. 清屏与绘制背景
    const isDark = this.options.theme === 'DARK';
    ctx.fillStyle = isDark ? '#181A1F' : '#F5F6F8';
    ctx.fillRect(0, 0, screenW, screenH);

    // 绘制微弱网格参考原点 (0, 0)
    this.drawOriginAndAxes(ctx, screenW, screenH, isDark);

    // 2. 绘制 DXF 图纸实体
    if (this.doc) {
      this.drawEntities(ctx, isDark);
    }

    // 3. 绘制实体高亮 (Selected & Hovered)
    if (this.hoveredEntity && this.hoveredEntity !== this.selectedEntity) {
      this.highlightEntity(ctx, this.hoveredEntity, '#00E5FF', 1.5);
    }
    if (this.selectedEntity) {
      this.highlightEntity(ctx, this.selectedEntity, '#FFD700', 2.5);
    }

    // 4. 绘制测量标注与引线
    if (this.measureEngine) {
      this.drawMeasurements(ctx, isDark);
    }

    // 5. 绘制吸附指示器
    if (this.options.showSnap && this.activeSnap) {
      this.drawSnapIndicator(ctx, this.activeSnap);
    }

    // 6. 绘制 AutoCAD 十字光标 (Crosshair)
    if (this.options.showCrosshair) {
      this.drawCrosshair(ctx, screenW, screenH, isDark);
    }

    ctx.restore();
  }

  private drawOriginAndAxes(
    ctx: CanvasRenderingContext2D,
    screenW: number,
    screenH: number,
    isDark: boolean
  ): void {
    const origin = this.worldToScreen(0, 0);

    // 坐标轴辅助虚线
    ctx.save();
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    // X 轴
    ctx.beginPath();
    ctx.moveTo(0, origin.y);
    ctx.lineTo(screenW, origin.y);
    ctx.stroke();

    // Y 轴
    ctx.beginPath();
    ctx.moveTo(origin.x, 0);
    ctx.lineTo(origin.x, screenH);
    ctx.stroke();

    // 原点标记 (小十字与红色/绿色轴标)
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    // +X (红)
    ctx.strokeStyle = '#FF4444';
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x + 30, origin.y);
    ctx.stroke();

    // +Y (绿)
    ctx.strokeStyle = '#44FF44';
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x, origin.y - 30);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 绘制所有实体（按图层批量与可见性快速过滤）
   */
  private drawEntities(ctx: CanvasRenderingContext2D, isDark: boolean): void {
    if (!this.doc) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const defaultColor = isDark ? '#FFFFFF' : '#111111';

    for (const ent of this.doc.entities) {
      const layer = this.doc.layers.get(ent.layer);
      // 图层隐藏跳过
      if (layer && !layer.visible) continue;

      let strokeColor = ent.color || (layer ? layer.color : defaultColor);
      // 亮色主题反转纯白色
      if (!isDark && (strokeColor.toUpperCase() === '#FFFFFF' || strokeColor.toUpperCase() === '#FFF')) {
        strokeColor = '#111111';
      }

      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = strokeColor;
      ctx.lineWidth = 1.2;

      this.renderSingleEntityGeometry(ctx, ent);
    }

    ctx.restore();
  }

  private renderSingleEntityGeometry(ctx: CanvasRenderingContext2D, ent: DxfEntity): void {
    switch (ent.type) {
      case 'LINE': {
        const l = ent as LineEntity;
        const p1 = this.worldToScreen(l.start.x, l.start.y);
        const p2 = this.worldToScreen(l.end.x, l.end.y);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        break;
      }

      case 'CIRCLE': {
        const c = ent as CircleEntity;
        const center = this.worldToScreen(c.center.x, c.center.y);
        const rScreen = c.radius * this.camera.zoom;
        if (rScreen > 0.5) {
          ctx.beginPath();
          ctx.arc(center.x, center.y, rScreen, 0, 2 * Math.PI);
          ctx.stroke();
        }
        break;
      }

      case 'ARC': {
        const a = ent as ArcEntity;
        const center = this.worldToScreen(a.center.x, a.center.y);
        const rScreen = a.radius * this.camera.zoom;
        if (rScreen > 0.5) {
          const rad = Math.PI / 180;
          // CAD 逆时针角度在屏幕坐标 (Y 向下) 中对应 Math.atan2 顺时针方向
          const startScreenRad = -a.startAngle * rad;
          const endScreenRad = -a.endAngle * rad;
          ctx.beginPath();
          // anticlockwise: true (从 start 顺时针/屏幕逆时针转到 end)
          ctx.arc(center.x, center.y, rScreen, startScreenRad, endScreenRad, true);
          ctx.stroke();
        }
        break;
      }

      case 'LWPOLYLINE':
      case 'POLYLINE': {
        const poly = ent as (LwpolylineEntity | PolylineEntity);
        const v = poly.vertices;
        if (v.length < 2) break;

        ctx.beginPath();
        const first = this.worldToScreen(v[0].x, v[0].y);
        ctx.moveTo(first.x, first.y);

        for (let i = 0; i < v.length; i++) {
          const v1 = v[i];
          const nextIdx = (i + 1 < v.length) ? i + 1 : (poly.isClosed ? 0 : -1);
          if (nextIdx < 0) break;

          const v2 = v[nextIdx];
          if (v1.bulge && Math.abs(v1.bulge) > 1e-6) {
            const arcPts = interpolateBulge(v1, v2, v1.bulge, 16);
            for (const pt of arcPts) {
              const sp = this.worldToScreen(pt.x, pt.y);
              ctx.lineTo(sp.x, sp.y);
            }
          } else {
            const sp = this.worldToScreen(v2.x, v2.y);
            ctx.lineTo(sp.x, sp.y);
          }
        }

        if (poly.isClosed) {
          ctx.closePath();
        }
        ctx.stroke();
        break;
      }

      case 'ELLIPSE': {
        const el = ent as EllipseEntity;
        const center = this.worldToScreen(el.center.x, el.center.y);
        const majX = el.majorAxisEndPoint.x * this.camera.zoom;
        const majY = -el.majorAxisEndPoint.y * this.camera.zoom; // 反转 Y
        const radiusX = Math.hypot(majX, majY);
        const radiusY = radiusX * el.axisRatio;
        const rotation = Math.atan2(majY, majX);

        if (radiusX > 0.5) {
          ctx.save();
          ctx.translate(center.x, center.y);
          ctx.rotate(rotation);
          ctx.beginPath();
          ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, 2 * Math.PI);
          ctx.stroke();
          ctx.restore();
        }
        break;
      }

      case 'TEXT':
      case 'MTEXT': {
        const t = ent as (TextEntity | MTextEntity);
        const text = t.text;
        if (!text) break;

        const p = this.worldToScreen(t.position.x, t.position.y);
        const fontSizePx = Math.max(1, t.height * this.camera.zoom);

        // LOD: 字符在屏幕太小时跳过绘制以提速
        if (fontSizePx < 4) break;

        ctx.save();
        ctx.font = `${fontSizePx}px "Menlo", "Consolas", sans-serif`;
        ctx.textBaseline = 'bottom';
        ctx.translate(p.x, p.y);
        ctx.rotate((-t.rotation * Math.PI) / 180);

        const lines = text.split('\n');
        lines.forEach((line, idx) => {
          ctx.fillText(line, 0, idx * fontSizePx * 1.2);
        });
        ctx.restore();
        break;
      }

      case 'SPLINE': {
        const sp = ent as SplineEntity;
        if (sp.controlPoints.length < 2) break;
        ctx.beginPath();
        const p0 = this.worldToScreen(sp.controlPoints[0].x, sp.controlPoints[0].y);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < sp.controlPoints.length; i++) {
          const pi = this.worldToScreen(sp.controlPoints[i].x, sp.controlPoints[i].y);
          ctx.lineTo(pi.x, pi.y);
        }
        if (sp.isClosed) ctx.closePath();
        ctx.stroke();
        break;
      }

      default:
        break;
    }
  }

  /**
   * 高亮选中的图元
   */
  private highlightEntity(
    ctx: CanvasRenderingContext2D,
    ent: DxfEntity,
    color: string,
    lineWidth: number
  ): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    this.renderSingleEntityGeometry(ctx, ent);
    ctx.restore();
  }

  /**
   * 绘制十字光标 (AutoCAD 风格)
   */
  private drawCrosshair(
    ctx: CanvasRenderingContext2D,
    screenW: number,
    screenH: number,
    isDark: boolean
  ): void {
    const x = this.cursorScreen.x;
    const y = this.cursorScreen.y;

    ctx.save();
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)';
    ctx.lineWidth = 1;

    // 全屏横向与纵向虚线光标
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(screenW, y);
    ctx.moveTo(x, 0);
    ctx.lineTo(x, screenH);
    ctx.stroke();

    // 准心小矩形框 (Pickbox)
    const boxSize = 8;
    ctx.strokeRect(x - boxSize / 2, y - boxSize / 2, boxSize, boxSize);
    ctx.restore();
  }

  /**
   * 绘制特征吸附标记
   */
  private drawSnapIndicator(ctx: CanvasRenderingContext2D, snap: SnapResult): void {
    const sp = this.worldToScreen(snap.point.x, snap.point.y);
    ctx.save();
    ctx.strokeStyle = '#00FF66';
    ctx.lineWidth = 2;

    const s = 7;
    if (snap.type === 'ENDPOINT') {
      // 绿正方形
      ctx.strokeRect(sp.x - s, sp.y - s, s * 2, s * 2);
    } else if (snap.type === 'MIDPOINT') {
      // 绿三角形
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y - s);
      ctx.lineTo(sp.x - s, sp.y + s);
      ctx.lineTo(sp.x + s, sp.y + s);
      ctx.closePath();
      ctx.stroke();
    } else if (snap.type === 'CENTER') {
      // 绿圆形
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, s, 0, 2 * Math.PI);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * 绘制测量线、圆弧与文字标注
   */
  private drawMeasurements(ctx: CanvasRenderingContext2D, isDark: boolean): void {
    if (!this.measureEngine) return;

    ctx.save();

    // 1. 绘制已固化的测量
    for (const m of this.measureEngine.measurements) {
      if (m.type === 'DISTANCE') {
        const s1 = this.worldToScreen(m.p1.x, m.p1.y);
        const s2 = this.worldToScreen(m.p2.x, m.p2.y);

        ctx.strokeStyle = m.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.stroke();

        // 两端端点
        ctx.fillStyle = m.color;
        ctx.beginPath();
        ctx.arc(s1.x, s1.y, 4, 0, 2 * Math.PI);
        ctx.arc(s2.x, s2.y, 4, 0, 2 * Math.PI);
        ctx.fill();

        // 标签背景与文字
        const midX = (s1.x + s2.x) / 2;
        const midY = (s1.y + s2.y) / 2;
        const label = `L: ${m.distance.toFixed(2)} (ΔX: ${m.deltaX.toFixed(2)}, ΔY: ${m.deltaY.toFixed(2)})`;

        ctx.font = '12px "Menlo", monospace';
        const tw = ctx.measureText(label).width;

        ctx.fillStyle = isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.85)';
        ctx.fillRect(midX - tw / 2 - 4, midY - 18, tw + 8, 20);
        ctx.strokeStyle = m.color;
        ctx.strokeRect(midX - tw / 2 - 4, midY - 18, tw + 8, 20);

        ctx.fillStyle = m.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, midX, midY - 8);
      } else if (m.type === 'ANGLE') {
        const s1 = this.worldToScreen(m.p1.x, m.p1.y);
        const sv = this.worldToScreen(m.vertex.x, m.vertex.y);
        const s2 = this.worldToScreen(m.p2.x, m.p2.y);

        ctx.strokeStyle = m.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(sv.x, sv.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.stroke();

        const label = `∠ ${m.angleDeg.toFixed(1)}°`;
        ctx.font = '12px "Menlo", monospace';
        const tw = ctx.measureText(label).width;

        ctx.fillStyle = isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.85)';
        ctx.fillRect(sv.x - tw / 2 - 4, sv.y - 24, tw + 8, 20);
        ctx.fillStyle = m.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, sv.x, sv.y - 14);
      }
    }

    // 2. 绘制正在进行中的交互虚线
    if (this.measureEngine.activePoints.length > 0) {
      const active = this.measureEngine.activePoints;
      ctx.strokeStyle = '#00FFCC';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);

      ctx.beginPath();
      const first = this.worldToScreen(active[0].x, active[0].y);
      ctx.moveTo(first.x, first.y);

      for (let i = 1; i < active.length; i++) {
        const p = this.worldToScreen(active[i].x, active[i].y);
        ctx.lineTo(p.x, p.y);
      }
      ctx.lineTo(this.cursorScreen.x, this.cursorScreen.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * 实体拾取与碰撞检测 (Raycasting / Picking)
   */
  public pickEntity(worldPos: Point2D): DxfEntity | null {
    if (!this.doc) return null;

    // 容差：屏幕 8 像素转换为世界坐标距离
    const tolerance = 8 / this.camera.zoom;

    // 从后往前反向遍历，优先选中上层绘制的实体
    for (let i = this.doc.entities.length - 1; i >= 0; i--) {
      const ent = this.doc.entities[i];
      const layer = this.doc.layers.get(ent.layer);
      if (layer && !layer.visible) continue;

      if (this.isPointNearEntity(worldPos, ent, tolerance)) {
        return ent;
      }
    }

    return null;
  }

  private isPointNearEntity(pt: Point2D, ent: DxfEntity, tol: number): boolean {
    switch (ent.type) {
      case 'LINE': {
        const l = ent as LineEntity;
        return this.distanceToSegment(pt, l.start, l.end) <= tol;
      }

      case 'CIRCLE': {
        const c = ent as CircleEntity;
        const d = Math.hypot(pt.x - c.center.x, pt.y - c.center.y);
        return Math.abs(d - c.radius) <= tol;
      }

      case 'ARC': {
        const a = ent as ArcEntity;
        const d = Math.hypot(pt.x - a.center.x, pt.y - a.center.y);
        if (Math.abs(d - a.radius) > tol) return false;

        const deg = (Math.atan2(pt.y - a.center.y, pt.x - a.center.x) * 180) / Math.PI;
        return isAngleBetween(deg, a.startAngle, a.endAngle);
      }

      case 'LWPOLYLINE':
      case 'POLYLINE': {
        const poly = ent as (LwpolylineEntity | PolylineEntity);
        const v = poly.vertices;
        for (let i = 0; i < v.length; i++) {
          const nextIdx = (i + 1 < v.length) ? i + 1 : (poly.isClosed ? 0 : -1);
          if (nextIdx < 0) break;
          if (this.distanceToSegment(pt, v[i], v[nextIdx]) <= tol) {
            return true;
          }
        }
        return false;
      }

      case 'TEXT':
      case 'MTEXT': {
        const t = ent as (TextEntity | MTextEntity);
        const d = Math.hypot(pt.x - t.position.x, pt.y - t.position.y);
        return d <= Math.max(t.height * 2, tol * 2);
      }

      default:
        return false;
    }
  }

  private distanceToSegment(p: Point2D, a: { x: number; y: number }, b: { x: number; y: number }): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-6) return Math.hypot(p.x - a.x, p.y - a.y);

    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    return Math.hypot(p.x - projX, p.y - projY);
  }
}
