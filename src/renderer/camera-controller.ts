/**
 * 相机控制器：鼠标滚轮锚点缩放、平移拖拽、双击自适应全图与指针跟踪
 */

import type { CadRenderer } from './cad-renderer.ts';
import type { Point2D, DxfEntity } from '../parser/dxf-types.ts';

export interface ControllerCallbacks {
  onCursorMove?: (world: Point2D, screen: Point2D) => void;
  onEntitySelected?: (entity: DxfEntity | null) => void;
  onMeasurementAdded?: () => void;
}

export class CameraController {
  private renderer: CadRenderer;
  private canvas: HTMLCanvasElement;
  private callbacks: ControllerCallbacks;

  private isDragging: boolean = false;
  private isSpacePressed: boolean = false;
  private lastMousePos: Point2D = { x: 0, y: 0 };
  private dragStartPos: Point2D = { x: 0, y: 0 };
  private hasMovedSignificantly: boolean = false;

  constructor(renderer: CadRenderer, canvas: HTMLCanvasElement, callbacks: ControllerCallbacks = {}) {
    this.renderer = renderer;
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.initEvents();
  }

  private initEvents(): void {
    const el = this.canvas;

    el.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
    el.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
    el.addEventListener('dblclick', this.onDblClick.bind(this));
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !this.isSpacePressed) {
        this.isSpacePressed = true;
        this.canvas.style.cursor = 'grab';
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isSpacePressed = false;
        this.canvas.style.cursor = 'crosshair';
      }
    });

    // 触摸板捏合缩放适配
    el.addEventListener('gesturestart', (e) => e.preventDefault());
    el.addEventListener('gesturechange', (e) => e.preventDefault());
  }

  /**
   * 鼠标滚轮缩放：以光标所在世界坐标为不动点锚定缩放
   */
  private onWheel(e: WheelEvent): void {
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // 1. 获取光标当前世界坐标
    const worldBefore = this.renderer.screenToWorld(sx, sy);

    // 2. 计算缩放比
    const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const oldZoom = this.renderer.camera.zoom;
    const newZoom = Math.max(1e-5, Math.min(1e6, oldZoom * zoomFactor));

    // 3. 调整视口中心，确保 worldBefore 在缩放后依然落在屏幕 (sx, sy) 处
    const screenW = rect.width;
    const screenH = rect.height;

    this.renderer.camera.zoom = newZoom;
    this.renderer.camera.centerX = worldBefore.x - (sx - screenW / 2) / newZoom;
    this.renderer.camera.centerY = worldBefore.y + (sy - screenH / 2) / newZoom;

    // 更新光标信息与重新绘制
    this.updateCursor(e);
    this.renderer.requestRender();
  }

  private onMouseDown(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    this.lastMousePos = { x: sx, y: sy };
    this.dragStartPos = { x: sx, y: sy };
    this.hasMovedSignificantly = false;

    // 中键 (1) 或 按住空格键拖拽 或 处于无测量模式下的左键拖动
    if (e.button === 1 || this.isSpacePressed || (e.button === 0 && this.renderer.measureEngine?.currentMode === 'NONE')) {
      this.isDragging = true;
      this.canvas.style.cursor = 'grabbing';
    }
  }

  private onMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (this.isDragging) {
      const dx = sx - this.lastMousePos.x;
      const dy = sy - this.lastMousePos.y;

      if (Math.hypot(sx - this.dragStartPos.x, sy - this.dragStartPos.y) > 3) {
        this.hasMovedSignificantly = true;
      }

      this.renderer.camera.centerX -= dx / this.renderer.camera.zoom;
      this.renderer.camera.centerY += dy / this.renderer.camera.zoom;

      this.lastMousePos = { x: sx, y: sy };
      this.renderer.requestRender();
    }

    this.updateCursor(e);
  }

  private onMouseUp(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (this.isDragging) {
      this.isDragging = false;
      this.canvas.style.cursor = 'crosshair';
    }

    // 若非拖拽操作，则判定为点击拾取或测量取点
    if (!this.hasMovedSignificantly && sx >= 0 && sx <= rect.width && sy >= 0 && sy <= rect.height) {
      this.handleClick(e);
    }
  }

  private onDblClick(e: MouseEvent): void {
    e.preventDefault();
    this.renderer.fitToView();
  }

  private updateCursor(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    this.renderer.cursorScreen = { x: sx, y: sy };
    const rawWorld = this.renderer.screenToWorld(sx, sy);

    // 吸附检测
    let finalWorld = rawWorld;
    if (this.renderer.options.showSnap && this.renderer.getDocument()) {
      const snapTolWorld = 12 / this.renderer.camera.zoom;
      const snap = this.renderer.measureEngine?.findSnapPoint(
        rawWorld,
        this.renderer.getDocument()!.entities,
        snapTolWorld
      ) ?? null;

      this.renderer.activeSnap = snap;
      if (snap) {
        finalWorld = snap.point;
      }
    } else {
      this.renderer.activeSnap = null;
    }

    this.renderer.cursorWorld = finalWorld;

    // 悬停拾取高亮检测 (测量模式下不拾取实体)
    if (this.renderer.measureEngine?.currentMode === 'NONE') {
      this.renderer.hoveredEntity = this.renderer.pickEntity(finalWorld);
    } else {
      this.renderer.hoveredEntity = null;
    }

    this.renderer.requestRender();

    if (this.callbacks.onCursorMove) {
      this.callbacks.onCursorMove(finalWorld, { x: sx, y: sy });
    }
  }

  private handleClick(e: MouseEvent): void {
    const worldPos = this.renderer.cursorWorld;

    // 测量工具优先处理
    if (this.renderer.measureEngine && this.renderer.measureEngine.currentMode !== 'NONE') {
      const completed = this.renderer.measureEngine.addPoint(worldPos);
      this.renderer.requestRender();
      if (completed && this.callbacks.onMeasurementAdded) {
        this.callbacks.onMeasurementAdded();
      }
      return;
    }

    // 实体选择模式
    if (e.button === 0) {
      const picked = this.renderer.pickEntity(worldPos);
      this.renderer.selectedEntity = picked;
      this.renderer.requestRender();

      if (this.callbacks.onEntitySelected) {
        this.callbacks.onEntitySelected(picked);
      }
    }
  }
}
