/**
 * 测量工具引擎：支持距离测量、角度测量与特征吸附 (Snap)
 */

import type { Point2D, DxfEntity, LineEntity, CircleEntity, ArcEntity, LwpolylineEntity } from '../parser/dxf-types.ts';

export interface DistanceMeasurement {
  id: string;
  type: 'DISTANCE';
  p1: Point2D;
  p2: Point2D;
  distance: number;
  deltaX: number;
  deltaY: number;
  color: string;
}

export interface AngleMeasurement {
  id: string;
  type: 'ANGLE';
  p1: Point2D; // 射线 1
  vertex: Point2D; // 顶点
  p2: Point2D; // 射线 2
  angleDeg: number;
  color: string;
}

export type Measurement = DistanceMeasurement | AngleMeasurement;

export interface SnapResult {
  point: Point2D;
  type: 'ENDPOINT' | 'MIDPOINT' | 'CENTER';
  distance: number;
}

export class MeasureEngine {
  public measurements: Measurement[] = [];
  public activePoints: Point2D[] = [];
  public currentMode: 'NONE' | 'DISTANCE' | 'ANGLE' = 'NONE';

  public setMode(mode: 'NONE' | 'DISTANCE' | 'ANGLE'): void {
    this.currentMode = mode;
    this.activePoints = [];
  }

  public clear(): void {
    this.measurements = [];
    this.activePoints = [];
  }

  /**
   * 处理用户点击拾取点
   */
  public addPoint(point: Point2D): Measurement | null {
    if (this.currentMode === 'NONE') return null;

    this.activePoints.push({ ...point });

    if (this.currentMode === 'DISTANCE' && this.activePoints.length === 2) {
      const [p1, p2] = this.activePoints;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy);

      const m: DistanceMeasurement = {
        id: `dist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'DISTANCE',
        p1,
        p2,
        distance: dist,
        deltaX: Math.abs(dx),
        deltaY: Math.abs(dy),
        color: '#00FFAA'
      };

      this.measurements.push(m);
      this.activePoints = [];
      return m;
    }

    if (this.currentMode === 'ANGLE' && this.activePoints.length === 3) {
      // activePoints: [p1, vertex, p2]
      const [p1, vertex, p2] = this.activePoints;
      const v1x = p1.x - vertex.x;
      const v1y = p1.y - vertex.y;
      const v2x = p2.x - vertex.x;
      const v2y = p2.y - vertex.y;

      const dot = v1x * v2x + v1y * v2y;
      const mag1 = Math.hypot(v1x, v1y);
      const mag2 = Math.hypot(v2x, v2y);

      let angleDeg = 0;
      if (mag1 > 1e-6 && mag2 > 1e-6) {
        const cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
        angleDeg = (Math.acos(cosTheta) * 180) / Math.PI;
      }

      const m: AngleMeasurement = {
        id: `angle_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'ANGLE',
        p1,
        vertex,
        p2,
        angleDeg,
        color: '#FFCC00'
      };

      this.measurements.push(m);
      this.activePoints = [];
      return m;
    }

    return null;
  }

  /**
   * 特征点吸附 (Snap)：寻找光标附近的端点、中点或圆心
   */
  public findSnapPoint(
    cursorWorld: Point2D,
    entities: DxfEntity[],
    snapToleranceWorld: number
  ): SnapResult | null {
    let bestSnap: SnapResult | null = null;
    let minDistance = snapToleranceWorld;

    const checkPoint = (pt: Point2D, type: 'ENDPOINT' | 'MIDPOINT' | 'CENTER') => {
      const d = Math.hypot(pt.x - cursorWorld.x, pt.y - cursorWorld.y);
      if (d < minDistance) {
        minDistance = d;
        bestSnap = { point: pt, type, distance: d };
      }
    };

    for (const ent of entities) {
      switch (ent.type) {
        case 'LINE': {
          const l = ent as LineEntity;
          checkPoint({ x: l.start.x, y: l.start.y }, 'ENDPOINT');
          checkPoint({ x: l.end.x, y: l.end.y }, 'ENDPOINT');
          checkPoint({ x: (l.start.x + l.end.x) / 2, y: (l.start.y + l.end.y) / 2 }, 'MIDPOINT');
          break;
        }

        case 'CIRCLE': {
          const c = ent as CircleEntity;
          checkPoint({ x: c.center.x, y: c.center.y }, 'CENTER');
          break;
        }

        case 'ARC': {
          const a = ent as ArcEntity;
          checkPoint({ x: a.center.x, y: a.center.y }, 'CENTER');
          const rad = Math.PI / 180;
          checkPoint({
            x: a.center.x + a.radius * Math.cos(a.startAngle * rad),
            y: a.center.y + a.radius * Math.sin(a.startAngle * rad)
          }, 'ENDPOINT');
          checkPoint({
            x: a.center.x + a.radius * Math.cos(a.endAngle * rad),
            y: a.center.y + a.radius * Math.sin(a.endAngle * rad)
          }, 'ENDPOINT');
          break;
        }

        case 'LWPOLYLINE': {
          const poly = ent as LwpolylineEntity;
          const v = poly.vertices;
          for (let i = 0; i < v.length; i++) {
            checkPoint({ x: v[i].x, y: v[i].y }, 'ENDPOINT');
            if (i + 1 < v.length) {
              checkPoint({ x: (v[i].x + v[i + 1].x) / 2, y: (v[i].y + v[i + 1].y) / 2 }, 'MIDPOINT');
            }
          }
          break;
        }

        default:
          break;
      }
    }

    return bestSnap;
  }
}
