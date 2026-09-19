/**
 * CAD 几何包围盒 (BoundingBox / Extents) 高精度计算器
 * 严格支持 LINE、CIRCLE、ARC (象限极值判断)、ELLIPSE、LWPOLYLINE (Bulge 弧段插值)、TEXT/MTEXT
 */

import type {
  BoundingBox,
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
  SolidEntity,
  Face3DEntity
} from './dxf-types.ts';
import { interpolateBulge } from './dxf-parser.ts';

/**
 * 判断特定角度 (度) 是否落在圆弧起止角度区间 [startDeg, endDeg] (逆时针 CCW)
 */
export function isAngleBetween(deg: number, startDeg: number, endDeg: number): boolean {
  // 归一化到 [0, 360)
  const norm = (a: number) => ((a % 360) + 360) % 360;
  const a = norm(deg);
  const s = norm(startDeg);
  const e = norm(endDeg);

  if (Math.abs(s - e) < 1e-6) {
    return true; // 接近整圆
  }
  if (s < e) {
    return a >= s && a <= e;
  } else {
    // 跨越 0 度分界线
    return a >= s || a <= e;
  }
}

export function createEmptyBoundingBox(): BoundingBox {
  return {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity
  };
}

export function expandBoundingBoxWithPoint(box: BoundingBox, x: number, y: number): void {
  if (isNaN(x) || isNaN(y)) return;
  if (x < box.minX) box.minX = x;
  if (y < box.minY) box.minY = y;
  if (x > box.maxX) box.maxX = x;
  if (y > box.maxY) box.maxY = y;
}

/**
 * 计算单个实体的包围盒
 */
export function computeEntityBoundingBox(ent: DxfEntity): BoundingBox {
  const box = createEmptyBoundingBox();

  switch (ent.type) {
    case 'LINE': {
      const l = ent as LineEntity;
      expandBoundingBoxWithPoint(box, l.start.x, l.start.y);
      expandBoundingBoxWithPoint(box, l.end.x, l.end.y);
      break;
    }

    case 'CIRCLE': {
      const c = ent as CircleEntity;
      expandBoundingBoxWithPoint(box, c.center.x - c.radius, c.center.y - c.radius);
      expandBoundingBoxWithPoint(box, c.center.x + c.radius, c.center.y + c.radius);
      break;
    }

    case 'ARC': {
      const a = ent as ArcEntity;
      const rad = Math.PI / 180;
      const sRad = a.startAngle * rad;
      const eRad = a.endAngle * rad;

      // 起点与终点
      expandBoundingBoxWithPoint(box, a.center.x + a.radius * Math.cos(sRad), a.center.y + a.radius * Math.sin(sRad));
      expandBoundingBoxWithPoint(box, a.center.x + a.radius * Math.cos(eRad), a.center.y + a.radius * Math.sin(eRad));

      // 检查四象限极值点 (0°, 90°, 180°, 270°)
      if (isAngleBetween(0, a.startAngle, a.endAngle)) {
        expandBoundingBoxWithPoint(box, a.center.x + a.radius, a.center.y);
      }
      if (isAngleBetween(90, a.startAngle, a.endAngle)) {
        expandBoundingBoxWithPoint(box, a.center.x, a.center.y + a.radius);
      }
      if (isAngleBetween(180, a.startAngle, a.endAngle)) {
        expandBoundingBoxWithPoint(box, a.center.x - a.radius, a.center.y);
      }
      if (isAngleBetween(270, a.startAngle, a.endAngle)) {
        expandBoundingBoxWithPoint(box, a.center.x, a.center.y - a.radius);
      }
      break;
    }

    case 'LWPOLYLINE':
    case 'POLYLINE': {
      const poly = ent as (LwpolylineEntity | PolylineEntity);
      const vertices = poly.vertices;
      const vLen = vertices.length;
      if (vLen === 0) break;

      for (let i = 0; i < vLen; i++) {
        const v1 = vertices[i];
        expandBoundingBoxWithPoint(box, v1.x, v1.y);

        if (v1.bulge && Math.abs(v1.bulge) > 1e-6) {
          const nextIdx = (i + 1 < vLen) ? i + 1 : (poly.isClosed ? 0 : -1);
          if (nextIdx >= 0) {
            const v2 = vertices[nextIdx];
            const arcPoints = interpolateBulge(v1, v2, v1.bulge, 16);
            for (const p of arcPoints) {
              expandBoundingBoxWithPoint(box, p.x, p.y);
            }
          }
        }
      }
      break;
    }

    case 'ELLIPSE': {
      const el = ent as EllipseEntity;
      const cx = el.center.x;
      const cy = el.center.y;
      const ax = el.majorAxisEndPoint.x;
      const ay = el.majorAxisEndPoint.y;
      const r = el.axisRatio;

      // 旋转椭圆极值包围盒
      const halfWidth = Math.sqrt(ax * ax + Math.pow(-ay * r, 2));
      const halfHeight = Math.sqrt(ay * ay + Math.pow(ax * r, 2));
      expandBoundingBoxWithPoint(box, cx - halfWidth, cy - halfHeight);
      expandBoundingBoxWithPoint(box, cx + halfWidth, cy + halfHeight);
      break;
    }

    case 'TEXT':
    case 'MTEXT': {
      const t = ent as (TextEntity | MTextEntity);
      const px = t.position.x;
      const py = t.position.y;
      const h = t.height || 2.5;
      const textLen = t.text ? t.text.length : 1;
      const w = textLen * h * 0.65;
      const rad = ((t.rotation || 0) * Math.PI) / 180;
      const cosR = Math.cos(rad);
      const sinR = Math.sin(rad);

      // 估算四个角点
      const corners = [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h }
      ];
      for (const c of corners) {
        const rx = c.x * cosR - c.y * sinR + px;
        const ry = c.x * sinR + c.y * cosR + py;
        expandBoundingBoxWithPoint(box, rx, ry);
      }
      break;
    }

    case 'SPLINE': {
      const sp = ent as SplineEntity;
      for (const cp of sp.controlPoints) {
        expandBoundingBoxWithPoint(box, cp.x, cp.y);
      }
      break;
    }

    case 'SOLID':
    case '3DFACE': {
      const s = ent as (SolidEntity | Face3DEntity);
      for (const pt of s.points) {
        expandBoundingBoxWithPoint(box, pt.x, pt.y);
      }
      break;
    }

    default:
      break;
  }

  return box;
}

export function computeBoundingBox(entities: DxfEntity[]): BoundingBox {
  const box = createEmptyBoundingBox();

  for (const ent of entities) {
    if (!ent.bbox) {
      ent.bbox = computeEntityBoundingBox(ent);
    }
    if (isFinite(ent.bbox.minX) && isFinite(ent.bbox.minY)) {
      expandBoundingBoxWithPoint(box, ent.bbox.minX, ent.bbox.minY);
      expandBoundingBoxWithPoint(box, ent.bbox.maxX, ent.bbox.maxY);
    }
  }

  // 若无有效图元或计算为空，则给一个标准默认盒
  if (!isFinite(box.minX) || !isFinite(box.minY)) {
    return { minX: -100, minY: -100, maxX: 100, maxY: 100 };
  }

  // 避免长或宽为 0 导致缩放除以 0
  if (Math.abs(box.maxX - box.minX) < 1e-4) {
    box.minX -= 10;
    box.maxX += 10;
  }
  if (Math.abs(box.maxY - box.minY) < 1e-4) {
    box.minY -= 10;
    box.maxY += 10;
  }

  return box;
}

/**
 * 计算图纸的主体核心聚焦包围盒 (Focus Bounding Box)
 * 优先采纳 AutoCAD HEADER 变量 $EXTMIN/$EXTMAX；若不存在或无效，则通过分位数采样过滤外侧几公里游离的离群外部参照 (XREF)
 */
export function computeFocusBoundingBox(
  entities: DxfEntity[],
  headerExtents?: BoundingBox,
  fullBox?: BoundingBox
): BoundingBox {
  // 1. 若 DXF HEADER 声明了有效的 $EXTMIN / $EXTMAX 模型空间范围，优先使用
  if (
    headerExtents &&
    isFinite(headerExtents.minX) &&
    isFinite(headerExtents.maxX) &&
    isFinite(headerExtents.minY) &&
    isFinite(headerExtents.maxY) &&
    headerExtents.maxX - headerExtents.minX > 1 &&
    headerExtents.maxY - headerExtents.minY > 1
  ) {
    return {
      minX: headerExtents.minX,
      minY: headerExtents.minY,
      maxX: headerExtents.maxX,
      maxY: headerExtents.maxY
    };
  }

  const baseBox = fullBox || computeBoundingBox(entities);
  const n = entities.length;
  if (n < 50) {
    return { ...baseBox };
  }

  // 2. 均匀分位数采样 (快速 2000 点抽样，执行耗时 < 2ms)
  const sampleLimit = Math.min(n, 2000);
  const step = Math.max(1, Math.floor(n / sampleLimit));
  const xs: number[] = [];
  const ys: number[] = [];

  for (let i = 0; i < n; i += step) {
    const b = entities[i].bbox;
    if (b && isFinite(b.minX) && isFinite(b.maxX)) {
      xs.push((b.minX + b.maxX) / 2);
      ys.push((b.minY + b.maxY) / 2);
    }
  }

  if (xs.length < 10) {
    return { ...baseBox };
  }

  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);

  // 过滤前 2% 与后 2% 的极端离群点
  const q02x = xs[Math.floor(xs.length * 0.02)];
  const q98x = xs[Math.floor(xs.length * 0.98)];
  const q02y = ys[Math.floor(ys.length * 0.02)];
  const q98y = ys[Math.floor(ys.length * 0.98)];

  // 为聚焦包围盒留出 5% 缓冲区
  const padX = Math.max((q98x - q02x) * 0.05, 50);
  const padY = Math.max((q98y - q02y) * 0.05, 50);

  return {
    minX: Math.max(baseBox.minX, q02x - padX),
    minY: Math.max(baseBox.minY, q02y - padY),
    maxX: Math.min(baseBox.maxX, q98x + padX),
    maxY: Math.min(baseBox.maxY, q98y + padY)
  };
}
