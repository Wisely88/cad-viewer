/**
 * DXF 解析器核心实现
 * 纯 TypeScript、零外部依赖，支持 Group Code 解析、图层、块定义及多级嵌套 INSERT 展开
 */

import type {
  DxfDocument,
  DxfLayer,
  DxfBlock,
  DxfEntity,
  LineEntity,
  CircleEntity,
  ArcEntity,
  EllipseEntity,
  LwpolylineEntity,
  LwpolylineVertex,
  PolylineEntity,
  TextEntity,
  MTextEntity,
  InsertEntity,
  DimensionEntity,
  SplineEntity,
  SolidEntity,
  Face3DEntity,
  Point3D
} from './dxf-types.ts';
import { getColorFromAci } from './dxf-types.ts';
import { computeBoundingBox, computeEntityBoundingBox } from './bounding-box.ts';

interface DxfPair {
  code: number;
  value: string;
}

/**
 * 2D 仿射变换矩阵 (3x3 Matrix)
 * 用于严谨表达 AutoCAD 块嵌套 (INSERT)、基准点位移、旋转、缩放与镜像
 * [ a  c  tx ]
 * [ b  d  ty ]
 * [ 0  0  1  ]
 */
export class Matrix3 {
  public a: number;
  public b: number;
  public c: number;
  public d: number;
  public tx: number;
  public ty: number;

  constructor(
    a: number = 1,
    b: number = 0,
    c: number = 0,
    d: number = 1,
    tx: number = 0,
    ty: number = 0
  ) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.tx = tx;
    this.ty = ty;
  }

  public static identity(): Matrix3 {
    return new Matrix3(1, 0, 0, 1, 0, 0);
  }

  public static translation(tx: number, ty: number): Matrix3 {
    return new Matrix3(1, 0, 0, 1, tx, ty);
  }

  public static rotation(angleDeg: number): Matrix3 {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return new Matrix3(cos, sin, -sin, cos, 0, 0);
  }

  public static scale(sx: number, sy: number): Matrix3 {
    return new Matrix3(sx, 0, 0, sy, 0, 0);
  }

  public multiply(m: Matrix3): Matrix3 {
    return new Matrix3(
      this.a * m.a + this.c * m.b,
      this.b * m.a + this.d * m.b,
      this.a * m.c + this.c * m.d,
      this.b * m.c + this.d * m.d,
      this.a * m.tx + this.c * m.ty + this.tx,
      this.b * m.tx + this.d * m.ty + this.ty
    );
  }

  public transformPoint(p: { x: number; y: number }): { x: number; y: number } {
    return {
      x: this.a * p.x + this.c * p.y + this.tx,
      y: this.b * p.x + this.d * p.y + this.ty
    };
  }

  public transformVector(v: { x: number; y: number }): { x: number; y: number } {
    return {
      x: this.a * v.x + this.c * v.y,
      y: this.b * v.x + this.d * v.y
    };
  }

  public determinant(): number {
    return this.a * this.d - this.c * this.b;
  }
}

/**
 * 清理 MTEXT 格式控制码，提取纯文本
 */
export function cleanMText(raw: string): string {
  if (!raw) return '';
  let text = raw;
  // 替换段落分隔符
  text = text.replace(/\\P/g, '\n');
  text = text.replace(/\\X/g, '\n');
  // 替换字体、颜色、对齐等控制码，如 \A1;, \fArial|b0|i0|c134|p49;, \C1;
  text = text.replace(/\\A[0-2];/g, '');
  text = text.replace(/\\C\d+;/g, '');
  text = text.replace(/\\c\d+;/g, '');
  text = text.replace(/\\f[^;]+;/g, '');
  text = text.replace(/\\F[^;]+;/g, '');
  text = text.replace(/\\H[^;]+;/g, '');
  text = text.replace(/\\W[^;]+;/g, '');
  text = text.replace(/\\T[^;]+;/g, '');
  text = text.replace(/\\Q[^;]+;/g, '');
  // 去除下划线、上划线控制码
  text = text.replace(/\\[LloO]/g, '');
  // 去除堆叠文本 \S1/2; => 1/2
  text = text.replace(/\\S([^;^]+)\^([^;]*);/g, '$1/$2');
  text = text.replace(/\\S([^;]+);/g, '$1');
  // 去除花括号
  text = text.replace(/[{}]/g, '');
  // 转义反斜杠
  text = text.replace(/\\\\/g, '\\');
  return text.trim();
}

/**
 * 将多段线中含有凸度 (Bulge) 的圆弧线段切分为平滑线段
 * bulge = tan(includedAngle / 4)
 */
export function interpolateBulge(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  bulge: number,
  tolerance: number = 8
): Array<{ x: number; y: number }> {
  if (!bulge || Math.abs(bulge) < 1e-6) {
    return [p2];
  }

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const chordLen = Math.hypot(dx, dy);
  if (chordLen < 1e-6) return [p2];

  const theta = 4 * Math.atan(bulge);
  const radius = Math.abs(chordLen / (2 * Math.sin(theta / 2)));

  // 弦的中点
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;

  // 弦垂线方向单位向量 (从弦指向圆心)
  const normX = -dy / chordLen;
  const normY = dx / chordLen;
  const distToCenter = (chordLen / 2) / Math.tan(theta / 2);

  const cx = mx + normX * distToCenter;
  const cy = my + normY * distToCenter;

  const startAngle = Math.atan2(p1.y - cy, p1.x - cx);
  let endAngle = Math.atan2(p2.y - cy, p2.x - cx);

  if (bulge > 0 && endAngle < startAngle) {
    endAngle += 2 * Math.PI;
  } else if (bulge < 0 && endAngle > startAngle) {
    endAngle -= 2 * Math.PI;
  }

  const steps = Math.max(4, Math.min(64, Math.ceil(Math.abs(theta) / (Math.PI / tolerance))));
  const points: Array<{ x: number; y: number }> = [];

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const angle = startAngle + t * (endAngle - startAngle);
    points.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle)
    });
  }

  return points;
}

export class DxfParser {
  /**
   * 解析 DXF 文本
   */
  public parse(content: string, fileName: string = 'drawing.dxf'): DxfDocument {
    const pairs = this.tokenize(content);
    const layers = new Map<string, DxfLayer>();
    const blocks = new Map<string, DxfBlock>();
    const rawEntities: DxfEntity[] = [];

    // 预置 0 图层 (默认图层)
    layers.set('0', {
      name: '0',
      color: '#FFFFFF',
      colorIndex: 7,
      visible: true,
      entityCount: 0
    });

    let i = 0;
    const len = pairs.length;

    while (i < len) {
      const p = pairs[i];
      if (p.code === 0 && p.value === 'SECTION') {
        i++;
        if (i < len && pairs[i].code === 2) {
          const sectionName = pairs[i].value;
          i++;
          if (sectionName === 'TABLES') {
            i = this.parseTables(pairs, i, layers);
          } else if (sectionName === 'BLOCKS') {
            i = this.parseBlocks(pairs, i, blocks);
          } else if (sectionName === 'ENTITIES') {
            i = this.parseEntitiesSection(pairs, i, rawEntities);
          } else {
            // 跳过未知 SECTION
            while (i < len && !(pairs[i].code === 0 && pairs[i].value === 'ENDSEC')) {
              i++;
            }
            if (i < len) i++;
          }
        }
      } else {
        i++;
      }
    }

    // 展开所有 INSERT 实体（基于 3x3 仿射矩阵递归展开 BLOCK 并计算几何变换）
    const flattenedEntities: DxfEntity[] = [];
    for (const ent of rawEntities) {
      if (ent.type === 'INSERT') {
        const expanded = this.expandInsert(ent as InsertEntity, blocks, 0);
        for (let j = 0; j < expanded.length; j++) {
          flattenedEntities.push(expanded[j]);
        }
      } else {
        flattenedEntities.push(ent);
      }
    }

    // 统计图层实体数、同步颜色并预计算每个图元的包围盒
    for (const ent of flattenedEntities) {
      ent.bbox = computeEntityBoundingBox(ent);

      const layerName = ent.layer || '0';
      let layer = layers.get(layerName);
      if (!layer) {
        layer = {
          name: layerName,
          color: ent.color || '#FFFFFF',
          colorIndex: ent.colorIndex ?? 7,
          visible: true,
          entityCount: 0
        };
        layers.set(layerName, layer);
      }
      layer.entityCount = (layer.entityCount || 0) + 1;

      // 若实体未显式指定颜色，则继承图层颜色
      if (!ent.color) {
        ent.color = layer.color;
      }
    }

    // 计算全图包围盒
    const boundingBox = computeBoundingBox(flattenedEntities);

    return {
      layers,
      blocks,
      entities: flattenedEntities,
      boundingBox,
      fileName
    };
  }

  /**
   * 将 DXF 文本切分为 Code/Value 键值对数组 (零多余数组流式扫描，大幅降低手机端内存峰值)
   */
  private tokenize(content: string): DxfPair[] {
    const pairs: DxfPair[] = [];
    let pos = 0;
    const len = content.length;
    let pendingCode: number | null = null;

    while (pos < len) {
      let nextPos = content.indexOf('\n', pos);
      if (nextPos === -1) {
        nextPos = len;
      }

      let endPos = nextPos;
      if (endPos > pos && content.charCodeAt(endPos - 1) === 13) {
        endPos--; // 剔除 \r
      }

      let startPos = pos;
      while (startPos < endPos && content.charCodeAt(startPos) <= 32) {
        startPos++;
      }
      while (endPos > startPos && content.charCodeAt(endPos - 1) <= 32) {
        endPos--;
      }

      if (endPos > startPos) {
        const line = content.substring(startPos, endPos);
        if (pendingCode === null) {
          const code = parseInt(line, 10);
          if (!isNaN(code)) {
            pendingCode = code;
          }
        } else {
          pairs.push({ code: pendingCode, value: line });
          pendingCode = null;
        }
      }

      pos = nextPos + 1;
    }

    return pairs;
  }

  /**
   * 解析 TABLES 节（重点提取 LAYER 表）
   */
  private parseTables(pairs: DxfPair[], startIndex: number, layers: Map<string, DxfLayer>): number {
    let i = startIndex;
    const len = pairs.length;

    while (i < len) {
      const p = pairs[i];
      if (p.code === 0 && p.value === 'ENDSEC') {
        return i + 1;
      }
      if (p.code === 0 && p.value === 'TABLE') {
        i++;
        if (i < len && pairs[i].code === 2) {
          const tableName = pairs[i].value;
          i++;
          if (tableName === 'LAYER') {
            i = this.parseLayerTable(pairs, i, layers);
            continue;
          }
        }
      }
      i++;
    }
    return i;
  }

  /**
   * 解析 LAYER 表中的每一项
   */
  private parseLayerTable(pairs: DxfPair[], startIndex: number, layers: Map<string, DxfLayer>): number {
    let i = startIndex;
    const len = pairs.length;

    while (i < len) {
      const p = pairs[i];
      if (p.code === 0 && p.value === 'ENDTAB') {
        return i + 1;
      }
      if (p.code === 0 && p.value === 'LAYER') {
        i++;
        let name = '';
        let colorIndex = 7;
        let isFrozen = false;
        let isOff = false;
        let lineType = 'CONTINUOUS';

        while (i < len && pairs[i].code !== 0) {
          const { code, value } = pairs[i];
          if (code === 2) {
            name = value;
          } else if (code === 62) {
            const rawColor = parseInt(value, 10);
            if (rawColor < 0) {
              isOff = true;
              colorIndex = Math.abs(rawColor);
            } else {
              colorIndex = rawColor;
            }
          } else if (code === 70) {
            const flags = parseInt(value, 10);
            if ((flags & 1) !== 0) {
              isFrozen = true;
            }
          } else if (code === 6) {
            lineType = value;
          }
          i++;
        }

        if (name) {
          layers.set(name, {
            name,
            color: getColorFromAci(colorIndex),
            colorIndex,
            visible: !isFrozen && !isOff,
            lineType,
            entityCount: 0
          });
        }
      } else {
        i++;
      }
    }
    return i;
  }

  /**
   * 解析 BLOCKS 节
   */
  private parseBlocks(pairs: DxfPair[], startIndex: number, blocks: Map<string, DxfBlock>): number {
    let i = startIndex;
    const len = pairs.length;

    while (i < len) {
      const p = pairs[i];
      if (p.code === 0 && p.value === 'ENDSEC') {
        return i + 1;
      }
      if (p.code === 0 && p.value === 'BLOCK') {
        i++;
        let blockName = '';
        const basePoint: Point3D = { x: 0, y: 0, z: 0 };
        const blockEntities: DxfEntity[] = [];

        while (i < len && pairs[i].code !== 0) {
          const { code, value } = pairs[i];
          if (code === 2) blockName = value;
          else if (code === 10) basePoint.x = parseFloat(value);
          else if (code === 20) basePoint.y = parseFloat(value);
          else if (code === 30) basePoint.z = parseFloat(value);
          i++;
        }

        // 解析块内部实体直至 ENDBLK
        while (i < len && !(pairs[i].code === 0 && pairs[i].value === 'ENDBLK')) {
          if (pairs[i].code === 0) {
            const { entity, nextIndex } = this.parseEntity(pairs, i);
            if (Array.isArray(entity)) {
              for (let k = 0; k < entity.length; k++) {
                blockEntities.push(entity[k]);
              }
            } else if (entity) {
              blockEntities.push(entity);
            }
            i = nextIndex;
          } else {
            i++;
          }
        }
        if (i < len && pairs[i].code === 0 && pairs[i].value === 'ENDBLK') {
          i++;
        }

        if (blockName) {
          blocks.set(blockName, {
            name: blockName,
            basePoint,
            entities: blockEntities
          });
        }
      } else {
        i++;
      }
    }
    return i;
  }

  /**
   * 解析 ENTITIES 节
   */
  private parseEntitiesSection(pairs: DxfPair[], startIndex: number, entities: DxfEntity[]): number {
    let i = startIndex;
    const len = pairs.length;

    while (i < len) {
      const p = pairs[i];
      if (p.code === 0 && p.value === 'ENDSEC') {
        return i + 1;
      }
      if (p.code === 0) {
        const { entity, nextIndex } = this.parseEntity(pairs, i);
        if (Array.isArray(entity)) {
          for (let k = 0; k < entity.length; k++) {
            entities.push(entity[k]);
          }
        } else if (entity) {
          entities.push(entity);
        }
        i = nextIndex;
      } else {
        i++;
      }
    }
    return i;
  }

  /**
   * 解析单个实体 (支持返回单个实体或因网格/边界展开后的实体数组)
   */
  private parseEntity(pairs: DxfPair[], startIndex: number): { entity: DxfEntity | DxfEntity[] | null; nextIndex: number } {
    const entityType = pairs[startIndex].value.toUpperCase();
    let i = startIndex + 1;
    const len = pairs.length;

    let layer = '0';
    let handle = '';
    let colorIndex: number | undefined;
    let lineType: string | undefined;

    // 通用属性收集与专用结构构建
    switch (entityType) {
      case 'LINE': {
        const start: Point3D = { x: 0, y: 0, z: 0 };
        const end: Point3D = { x: 0, y: 0, z: 0 };
        while (i < len && pairs[i].code !== 0) {
          const { code, value } = pairs[i];
          if (code === 8) layer = value;
          else if (code === 5) handle = value;
          else if (code === 62) colorIndex = parseInt(value, 10);
          else if (code === 6) lineType = value;
          else if (code === 10) start.x = parseFloat(value);
          else if (code === 20) start.y = parseFloat(value);
          else if (code === 30) start.z = parseFloat(value);
          else if (code === 11) end.x = parseFloat(value);
          else if (code === 21) end.y = parseFloat(value);
          else if (code === 31) end.z = parseFloat(value);
          i++;
        }
        const line: LineEntity = {
          type: 'LINE',
          layer,
          handle,
          start,
          end,
          colorIndex,
          color: colorIndex !== undefined ? getColorFromAci(colorIndex) : undefined,
          lineType
        };
        return { entity: line, nextIndex: i };
      }

      case 'CIRCLE': {
        const center: Point3D = { x: 0, y: 0, z: 0 };
        let radius = 0;
        while (i < len && pairs[i].code !== 0) {
          const { code, value } = pairs[i];
          if (code === 8) layer = value;
          else if (code === 5) handle = value;
          else if (code === 62) colorIndex = parseInt(value, 10);
          else if (code === 6) lineType = value;
          else if (code === 10) center.x = parseFloat(value);
          else if (code === 20) center.y = parseFloat(value);
          else if (code === 30) center.z = parseFloat(value);
          else if (code === 40) radius = parseFloat(value);
          i++;
        }
        const circle: CircleEntity = {
          type: 'CIRCLE',
          layer,
          handle,
          center,
          radius,
          colorIndex,
          color: colorIndex !== undefined ? getColorFromAci(colorIndex) : undefined,
          lineType
        };
        return { entity: circle, nextIndex: i };
      }

      case 'ARC': {
        const center: Point3D = { x: 0, y: 0, z: 0 };
        let radius = 0;
        let startAngle = 0;
        let endAngle = 360;
        while (i < len && pairs[i].code !== 0) {
          const { code, value } = pairs[i];
          if (code === 8) layer = value;
          else if (code === 5) handle = value;
          else if (code === 62) colorIndex = parseInt(value, 10);
          else if (code === 6) lineType = value;
          else if (code === 10) center.x = parseFloat(value);
          else if (code === 20) center.y = parseFloat(value);
          else if (code === 30) center.z = parseFloat(value);
          else if (code === 40) radius = parseFloat(value);
          else if (code === 50) startAngle = parseFloat(value);
          else if (code === 51) endAngle = parseFloat(value);
          i++;
        }
        const arc: ArcEntity = {
          type: 'ARC',
          layer,
          handle,
          center,
          radius,
          startAngle,
          endAngle,
          colorIndex,
          color: colorIndex !== undefined ? getColorFromAci(colorIndex) : undefined,
          lineType
        };
        return { entity: arc, nextIndex: i };
      }

      case 'LWPOLYLINE': {
        const vertices: LwpolylineVertex[] = [];
        let isClosed = false;
        let currentVertex: LwpolylineVertex | null = null;

        while (i < len && pairs[i].code !== 0) {
          const { code, value } = pairs[i];
          if (code === 8) layer = value;
          else if (code === 5) handle = value;
          else if (code === 62) colorIndex = parseInt(value, 10);
          else if (code === 6) lineType = value;
          else if (code === 70) {
            isClosed = (parseInt(value, 10) & 1) === 1;
          } else if (code === 10) {
            currentVertex = { x: parseFloat(value), y: 0 };
            vertices.push(currentVertex);
          } else if (code === 20) {
            if (currentVertex) currentVertex.y = parseFloat(value);
          } else if (code === 42) {
            if (currentVertex) currentVertex.bulge = parseFloat(value);
          }
          i++;
        }

        const lwpoly: LwpolylineEntity = {
          type: 'LWPOLYLINE',
          layer,
          handle,
          vertices,
          isClosed,
          colorIndex,
          color: colorIndex !== undefined ? getColorFromAci(colorIndex) : undefined,
          lineType
        };
        return { entity: lwpoly, nextIndex: i };
      }

      case 'POLYLINE': {
        let isClosed = false;
        let polyFlags = 0;
        while (i < len && pairs[i].code !== 0) {
          const { code, value } = pairs[i];
          if (code === 8) layer = value;
          else if (code === 5) handle = value;
          else if (code === 62) colorIndex = parseInt(value, 10);
          else if (code === 6) lineType = value;
          else if (code === 70) {
            polyFlags = parseInt(value, 10);
            isClosed = (polyFlags & 1) === 1;
          }
          i++;
        }

        const isPolyfaceMesh = (polyFlags & 64) === 64;
        const rawVertices: Array<{ x: number; y: number; z: number; flags: number; bulge?: number; f1?: number; f2?: number; f3?: number; f4?: number }> = [];

        // 解析 VERTEX 系列直至 SEQEND
        while (i < len && !(pairs[i].code === 0 && pairs[i].value === 'SEQEND')) {
          if (pairs[i].code === 0 && pairs[i].value === 'VERTEX') {
            i++;
            let vx = 0;
            let vy = 0;
            let vz = 0;
            let vflags = 0;
            let vbulge: number | undefined;
            let f1: number | undefined;
            let f2: number | undefined;
            let f3: number | undefined;
            let f4: number | undefined;

            while (i < len && pairs[i].code !== 0) {
              const { code, value } = pairs[i];
              if (code === 10) vx = parseFloat(value);
              else if (code === 20) vy = parseFloat(value);
              else if (code === 30) vz = parseFloat(value);
              else if (code === 70) vflags = parseInt(value, 10);
              else if (code === 42) vbulge = parseFloat(value);
              else if (code === 71) f1 = parseInt(value, 10);
              else if (code === 72) f2 = parseInt(value, 10);
              else if (code === 73) f3 = parseInt(value, 10);
              else if (code === 74) f4 = parseInt(value, 10);
              i++;
            }
            rawVertices.push({ x: vx, y: vy, z: vz, flags: vflags, bulge: vbulge, f1, f2, f3, f4 });
          } else {
            i++;
          }
        }
        if (i < len && pairs[i].code === 0 && pairs[i].value === 'SEQEND') {
          i++;
        }

        if (isPolyfaceMesh) {
          // 多面体网格：分离顶点坐标与面索引
          const meshCoords: Point3D[] = [];
          const generatedLines: LineEntity[] = [];

          for (const rv of rawVertices) {
            const isFace = rv.f1 !== undefined || rv.f2 !== undefined || rv.f3 !== undefined;
            if (!isFace) {
              // 顶点坐标
              meshCoords.push({ x: rv.x, y: rv.y, z: rv.z });
            } else {
              // 面定义 (1-based 索引，负数代表隐藏边)
              const idxs = [rv.f1, rv.f2, rv.f3, rv.f4].filter((n): n is number => n !== undefined && n !== 0);
              for (let k = 0; k < idxs.length; k++) {
                const nextK = (k + 1) % idxs.length;
                const iA = Math.abs(idxs[k]) - 1;
                const iB = Math.abs(idxs[nextK]) - 1;
                if (iA >= 0 && iA < meshCoords.length && iB >= 0 && iB < meshCoords.length && iA !== iB) {
                  generatedLines.push({
                    type: 'LINE',
                    layer,
                    handle,
                    start: meshCoords[iA],
                    end: meshCoords[iB],
                    colorIndex,
                    color: colorIndex !== undefined ? getColorFromAci(colorIndex) : undefined,
                    lineType
                  });
                }
              }
            }
          }
          return { entity: generatedLines.length > 0 ? generatedLines : null, nextIndex: i };
        }

        // 普通 2D/3D 多段线：过滤被样条曲线平滑替换的原多边形控制顶点
        const hasSplineFit = (polyFlags & 4) === 4;
        const vertices: LwpolylineVertex[] = [];
        for (const rv of rawVertices) {
          if (hasSplineFit && (rv.flags & 16) === 16) {
            continue;
          }
          vertices.push({
            x: rv.x,
            y: rv.y,
            bulge: rv.bulge
          });
        }

        const poly: PolylineEntity = {
          type: 'POLYLINE',
          layer,
          handle,
          vertices,
          isClosed,
          colorIndex,
          color: colorIndex !== undefined ? getColorFromAci(colorIndex) : undefined,
          lineType
        };
        return { entity: poly, nextIndex: i };
      }

      case 'TEXT': {
        let text = '';
        const position: Point3D = { x: 0, y: 0, z: 0 };
        let height = 2.5;
        let rotation = 0;
        let halign = 0;
        let valign = 0;

        while (i < len && pairs[i].code !== 0) {
          const { code, value } = pairs[i];
          if (code === 8) layer = value;
          else if (code === 5) handle = value;
          else if (code === 62) colorIndex = parseInt(value, 10);
          else if (code === 6) lineType = value;
          else if (code === 1) text = value;
          else if (code === 10) position.x = parseFloat(value);
          else if (code === 20) position.y = parseFloat(value);
          else if (code === 30) position.z = parseFloat(value);
          else if (code === 40) height = parseFloat(value);
          else if (code === 50) rotation = parseFloat(value);
          else if (code === 72) halign = parseInt(value, 10);
          else if (code === 73) valign = parseInt(value, 10);
          i++;
        }
        const textEntity: TextEntity = {
          type: 'TEXT',
          layer,
          handle,
          text,
          position,
          height,
          rotation,
          halign,
          valign,
          colorIndex,
          color: colorIndex !== undefined ? getColorFromAci(colorIndex) : undefined,
          lineType
        };
        return { entity: textEntity, nextIndex: i };
      }

      case 'ATTRIB':
      case 'ATTDEF': {
        let text = '';
        const position: Point3D = { x: 0, y: 0, z: 0 };
        let height = 2.5;
        let rotation = 0;
        let halign = 0;
        let valign = 0;

        while (i < len && pairs[i].code !== 0) {
          const { code, value } = pairs[i];
          if (code === 8) layer = value;
          else if (code === 5) handle = value;
          else if (code === 62) colorIndex = parseInt(value, 10);
          else if (code === 6) lineType = value;
          else if (code === 1) text = value;
          else if (code === 10) position.x = parseFloat(value);
          else if (code === 20) position.y = parseFloat(value);
          else if (code === 30) position.z = parseFloat(value);
          else if (code === 40) height = parseFloat(value);
          else if (code === 50) rotation = parseFloat(value);
          else if (code === 72) halign = parseInt(value, 10);
          else if (code === 74 || code === 73) valign = parseInt(value, 10);
          i++;
        }
        const textEntity: TextEntity = {
          type: 'TEXT',
          layer,
          handle,
          text: cleanMText(text),
          position,
          height,
          rotation,
          halign,
          valign,
          colorIndex,
          color: colorIndex !== undefined ? getColorFromAci(colorIndex) : undefined,
          lineType
        };
        return { entity: textEntity, nextIndex: i };
      }

      case 'MTEXT': {
        let textParts: string[] = [];
        const position: Point3D = { x: 0, y: 0, z: 0 };
        let height = 2.5;
        let rotation = 0;
        let attachmentPoint = 1;

        while (i < len && pairs[i].code !== 0) {
          const { code, value } = pairs[i];
          if (code === 8) layer = value;
          else if (code === 5) handle = value;
          else if (code === 62) colorIndex = parseInt(value, 10);
          else if (code === 6) lineType = value;
          else if (code === 1 || code === 3) textParts.push(value);
          else if (code === 10) position.x = parseFloat(value);
          else if (code === 20) position.y = parseFloat(value);
          else if (code === 30) position.z = parseFloat(value);
          else if (code === 40) height = parseFloat(value);
          else if (code === 50) rotation = parseFloat(value);
          else if (code === 71) attachmentPoint = parseInt(value, 10);
          i++;
        }

        const rawText = textParts.join('');
        const mtext: MTextEntity = {
          type: 'MTEXT',
          layer,
          handle,
          text: cleanMText(rawText),
          position,
          height,
          rotation,
          attachmentPoint,
          colorIndex,
          color: colorIndex !== undefined ? getColorFromAci(colorIndex) : undefined,
          lineType
        };
        return { entity: mtext, nextIndex: i };
      }

      case 'INSERT': {
        let blockName = '';
        const position: Point3D = { x: 0, y: 0, z: 0 };
        const scale: Point3D = { x: 1, y: 1, z: 1 };
        let rotation = 0;
        let extrusion: Point3D | undefined;

        while (i < len && pairs[i].code !== 0) {
          const { code, value } = pairs[i];
          if (code === 8) layer = value;
          else if (code === 5) handle = value;
          else if (code === 62) colorIndex = parseInt(value, 10);
          else if (code === 6) lineType = value;
          else if (code === 2) blockName = value;
          else if (code === 10) position.x = parseFloat(value);
          else if (code === 20) position.y = parseFloat(value);
          else if (code === 30) position.z = parseFloat(value);
          else if (code === 41) scale.x = parseFloat(value);
          else if (code === 42) scale.y = parseFloat(value);
          else if (code === 43) scale.z = parseFloat(value);
          else if (code === 50) rotation = parseFloat(value);
          else if (code === 210) {
            extrusion = extrusion || { x: 0, y: 0, z: 1 };
            extrusion.x = parseFloat(value);
          } else if (code === 220) {
            extrusion = extrusion || { x: 0, y: 0, z: 1 };
            extrusion.y = parseFloat(value);
          } else if (code === 230) {
            extrusion = extrusion || { x: 0, y: 0, z: 1 };
            extrusion.z = parseFloat(value);
          }
          i++;
        }

        const insert: InsertEntity = {
          type: 'INSERT',
          layer,
          handle,
          blockName,
          position,
          scale,
          rotation,
          extrusion,
          colorIndex,
          color: colorIndex !== undefined ? getColorFromAci(colorIndex) : undefined,
          lineType
        };
        return { entity: insert, nextIndex: i };
      }

      case 'ELLIPSE': {
        const center: Point3D = { x: 0, y: 0, z: 0 };
        const majorAxisEndPoint: Point3D = { x: 1, y: 0, z: 0 };
        let axisRatio = 1.0;
        let startAngle = 0;
        let endAngle = 2 * Math.PI;

        while (i < len && pairs[i].code !== 0) {
          const { code, value } = pairs[i];
          if (code === 8) layer = value;
          else if (code === 5) handle = value;
          else if (code === 62) colorIndex = parseInt(value, 10);
          else if (code === 6) lineType = value;
          else if (code === 10) center.x = parseFloat(value);
          else if (code === 20) center.y = parseFloat(value);
          else if (code === 30) center.z = parseFloat(value);
          else if (code === 11) majorAxisEndPoint.x = parseFloat(value);
          else if (code === 21) majorAxisEndPoint.y = parseFloat(value);
          else if (code === 31) majorAxisEndPoint.z = parseFloat(value);
          else if (code === 40) axisRatio = parseFloat(value);
          else if (code === 41) startAngle = parseFloat(value);
          else if (code === 42) endAngle = parseFloat(value);
          i++;
        }

        const ellipse: EllipseEntity = {
          type: 'ELLIPSE',
          layer,
          handle,
          center,
          majorAxisEndPoint,
          axisRatio,
          startAngle,
          endAngle,
          colorIndex,
          color: colorIndex !== undefined ? getColorFromAci(colorIndex) : undefined,
          lineType
        };
        return { entity: ellipse, nextIndex: i };
      }

      case 'DIMENSION': {
        let blockName = '';
        let text = '';
        const defPoint1: Point3D = { x: 0, y: 0, z: 0 };
        const defPoint2: Point3D = { x: 0, y: 0, z: 0 };
        const defPoint3: Point3D = { x: 0, y: 0, z: 0 };

        while (i < len && pairs[i].code !== 0) {
          const { code, value } = pairs[i];
          if (code === 8) layer = value;
          else if (code === 5) handle = value;
          else if (code === 62) colorIndex = parseInt(value, 10);
          else if (code === 6) lineType = value;
          else if (code === 2) blockName = value;
          else if (code === 1) text = value;
          else if (code === 10) defPoint1.x = parseFloat(value);
          else if (code === 20) defPoint1.y = parseFloat(value);
          else if (code === 11) defPoint2.x = parseFloat(value);
          else if (code === 21) defPoint2.y = parseFloat(value);
          else if (code === 13) defPoint3.x = parseFloat(value);
          else if (code === 23) defPoint3.y = parseFloat(value);
          i++;
        }

        const dim: DimensionEntity = {
          type: 'DIMENSION',
          layer,
          handle,
          blockName,
          text: cleanMText(text),
          defPoint1,
          defPoint2,
          defPoint3,
          colorIndex,
          color: colorIndex !== undefined ? getColorFromAci(colorIndex) : undefined,
          lineType
        };
        return { entity: dim, nextIndex: i };
      }

      case 'SPLINE': {
        const controlPoints: Point3D[] = [];
        let degree = 3;
        let isClosed = false;

        let curPoint: Point3D | null = null;
        while (i < len && pairs[i].code !== 0) {
          const { code, value } = pairs[i];
          if (code === 8) layer = value;
          else if (code === 5) handle = value;
          else if (code === 62) colorIndex = parseInt(value, 10);
          else if (code === 6) lineType = value;
          else if (code === 71) degree = parseInt(value, 10);
          else if (code === 70) isClosed = (parseInt(value, 10) & 1) === 1;
          else if (code === 10) {
            curPoint = { x: parseFloat(value), y: 0, z: 0 };
            controlPoints.push(curPoint);
          } else if (code === 20) {
            if (curPoint) curPoint.y = parseFloat(value);
          } else if (code === 30) {
            if (curPoint) curPoint.z = parseFloat(value);
          }
          i++;
        }

        const spline: SplineEntity = {
          type: 'SPLINE',
          layer,
          handle,
          controlPoints,
          degree,
          isClosed,
          colorIndex,
          color: colorIndex !== undefined ? getColorFromAci(colorIndex) : undefined,
          lineType
        };
        return { entity: spline, nextIndex: i };
      }

      case 'SOLID':
      case '3DFACE': {
        const p1: Point3D = { x: 0, y: 0, z: 0 };
        const p2: Point3D = { x: 0, y: 0, z: 0 };
        const p3: Point3D = { x: 0, y: 0, z: 0 };
        const p4: Point3D = { x: 0, y: 0, z: 0 };
        let hasP4 = false;

        while (i < len && pairs[i].code !== 0) {
          const { code, value } = pairs[i];
          if (code === 8) layer = value;
          else if (code === 5) handle = value;
          else if (code === 62) colorIndex = parseInt(value, 10);
          else if (code === 6) lineType = value;
          else if (code === 10) p1.x = parseFloat(value);
          else if (code === 20) p1.y = parseFloat(value);
          else if (code === 30) p1.z = parseFloat(value);
          else if (code === 11) p2.x = parseFloat(value);
          else if (code === 21) p2.y = parseFloat(value);
          else if (code === 31) p2.z = parseFloat(value);
          else if (code === 12) p3.x = parseFloat(value);
          else if (code === 22) p3.y = parseFloat(value);
          else if (code === 32) p3.z = parseFloat(value);
          else if (code === 13) { p4.x = parseFloat(value); hasP4 = true; }
          else if (code === 23) { p4.y = parseFloat(value); hasP4 = true; }
          else if (code === 33) { p4.z = parseFloat(value); hasP4 = true; }
          i++;
        }

        const pts: Point3D[] = entityType === 'SOLID'
          ? [p1, p2, hasP4 ? p4 : p3, p3]
          : [p1, p2, p3, ...(hasP4 && (p4.x !== p3.x || p4.y !== p3.y) ? [p4] : [])];

        const solid: SolidEntity | Face3DEntity = {
          type: entityType === 'SOLID' ? 'SOLID' : '3DFACE',
          layer,
          handle,
          points: pts,
          colorIndex,
          color: colorIndex !== undefined ? getColorFromAci(colorIndex) : undefined,
          lineType
        };
        return { entity: solid, nextIndex: i };
      }

      default: {
        // 未直接支持实体：跳过其所有属性
        while (i < len && pairs[i].code !== 0) {
          i++;
        }
        return { entity: null, nextIndex: i };
      }
    }
  }

  /**
   * 递归展开 INSERT 实体（基于 3x3 仿射变换矩阵，严谨支持多级嵌套、旋转累加、非等比与负缩放镜像）
   */
  private expandInsert(
    insert: InsertEntity,
    blocks: Map<string, DxfBlock>,
    depth: number,
    visitedBlocks: Set<string> = new Set(),
    parentMatrix: Matrix3 = Matrix3.identity()
  ): DxfEntity[] {
    if (depth > 8 || visitedBlocks.has(insert.blockName)) return [];

    const block = blocks.get(insert.blockName);
    if (!block || !block.entities.length) return [];

    const currentVisited = new Set(visitedBlocks);
    currentVisited.add(insert.blockName);

    const bx = block.basePoint.x || 0;
    const by = block.basePoint.y || 0;
    let sx = insert.scale.x ?? 1;
    let sy = insert.scale.y ?? 1;
    const rot = insert.rotation || 0;
    const tx = insert.position.x;
    const ty = insert.position.y;

    // AutoCAD OCS 法向量翻转处理: 若 extrusion.z 为负 (常见为 0, 0, -1)，X 轴镜像
    if (insert.extrusion && insert.extrusion.z !== undefined && insert.extrusion.z < 0) {
      sx = -sx;
    }

    // 构造当前 INSERT 局部变换矩阵: T(pos) * R(rot) * S(scale) * T(-basePoint)
    const localMatrix = Matrix3.translation(tx, ty)
      .multiply(Matrix3.rotation(rot))
      .multiply(Matrix3.scale(sx, sy))
      .multiply(Matrix3.translation(-bx, -by));

    // 复合累加父级变换矩阵: M = parentMatrix * localMatrix
    const currentMatrix = parentMatrix.multiply(localMatrix);
    const det = currentMatrix.determinant();
    const isMirrored = det < 0;

    // 计算有效缩放系数 (用于半径和字高)
    const effectiveScale = Math.sqrt(
      (currentMatrix.a * currentMatrix.a +
       currentMatrix.b * currentMatrix.b +
       currentMatrix.c * currentMatrix.c +
       currentMatrix.d * currentMatrix.d) / 2
    );

    const expandedList: DxfEntity[] = [];

    for (const child of block.entities) {
      const resolvedLayer = child.layer === '0' ? insert.layer : child.layer;
      const resolvedColor = child.colorIndex === 0 ? insert.color : child.color;
      const resolvedColorIndex = child.colorIndex === 0 ? insert.colorIndex : child.colorIndex;

      switch (child.type) {
        case 'LINE': {
          const l = child as LineEntity;
          const p1 = currentMatrix.transformPoint(l.start);
          const p2 = currentMatrix.transformPoint(l.end);
          expandedList.push({
            ...l,
            layer: resolvedLayer,
            color: resolvedColor,
            colorIndex: resolvedColorIndex,
            start: { x: p1.x, y: p1.y, z: l.start.z },
            end: { x: p2.x, y: p2.y, z: l.end.z }
          });
          break;
        }

        case 'CIRCLE': {
          const c = child as CircleEntity;
          const center = currentMatrix.transformPoint(c.center);
          expandedList.push({
            ...c,
            layer: resolvedLayer,
            color: resolvedColor,
            colorIndex: resolvedColorIndex,
            center: { x: center.x, y: center.y, z: c.center.z },
            radius: c.radius * effectiveScale
          });
          break;
        }

        case 'ARC': {
          const a = child as ArcEntity;
          const center = currentMatrix.transformPoint(a.center);
          const rad = Math.PI / 180;
          const vStart = currentMatrix.transformVector({
            x: Math.cos(a.startAngle * rad),
            y: Math.sin(a.startAngle * rad)
          });
          const vEnd = currentMatrix.transformVector({
            x: Math.cos(a.endAngle * rad),
            y: Math.sin(a.endAngle * rad)
          });
          let ang1 = (Math.atan2(vStart.y, vStart.x) * 180 / Math.PI + 360) % 360;
          let ang2 = (Math.atan2(vEnd.y, vEnd.x) * 180 / Math.PI + 360) % 360;

          // 镜像翻转时逆时针方向与起止角对调
          if (isMirrored) {
            const temp = ang1;
            ang1 = ang2;
            ang2 = temp;
          }

          expandedList.push({
            ...a,
            layer: resolvedLayer,
            color: resolvedColor,
            colorIndex: resolvedColorIndex,
            center: { x: center.x, y: center.y, z: a.center.z },
            radius: a.radius * effectiveScale,
            startAngle: ang1,
            endAngle: ang2
          });
          break;
        }

        case 'LWPOLYLINE':
        case 'POLYLINE': {
          const poly = child as (LwpolylineEntity | PolylineEntity);
          const transformedVertices: LwpolylineVertex[] = poly.vertices.map(v => {
            const tp = currentMatrix.transformPoint(v);
            return {
              x: tp.x,
              y: tp.y,
              bulge: isMirrored && v.bulge ? -v.bulge : v.bulge
            };
          });
          expandedList.push({
            ...poly,
            layer: resolvedLayer,
            color: resolvedColor,
            colorIndex: resolvedColorIndex,
            vertices: transformedVertices
          });
          break;
        }

        case 'TEXT': {
          const t = child as TextEntity;
          const pos = currentMatrix.transformPoint(t.position);
          const rad = ((t.rotation || 0) * Math.PI) / 180;
          const dir = currentMatrix.transformVector({ x: Math.cos(rad), y: Math.sin(rad) });
          const newRot = (Math.atan2(dir.y, dir.x) * 180 / Math.PI + 360) % 360;
          expandedList.push({
            ...t,
            layer: resolvedLayer,
            color: resolvedColor,
            colorIndex: resolvedColorIndex,
            position: { x: pos.x, y: pos.y, z: t.position.z },
            height: t.height * effectiveScale,
            rotation: newRot
          });
          break;
        }

        case 'MTEXT': {
          const mt = child as MTextEntity;
          const pos = currentMatrix.transformPoint(mt.position);
          const rad = ((mt.rotation || 0) * Math.PI) / 180;
          const dir = currentMatrix.transformVector({ x: Math.cos(rad), y: Math.sin(rad) });
          const newRot = (Math.atan2(dir.y, dir.x) * 180 / Math.PI + 360) % 360;
          expandedList.push({
            ...mt,
            layer: resolvedLayer,
            color: resolvedColor,
            colorIndex: resolvedColorIndex,
            position: { x: pos.x, y: pos.y, z: mt.position.z },
            height: mt.height * effectiveScale,
            rotation: newRot
          });
          break;
        }

        case 'ELLIPSE': {
          const el = child as EllipseEntity;
          const center = currentMatrix.transformPoint(el.center);
          const maj = currentMatrix.transformVector(el.majorAxisEndPoint);
          expandedList.push({
            ...el,
            layer: resolvedLayer,
            color: resolvedColor,
            colorIndex: resolvedColorIndex,
            center: { x: center.x, y: center.y, z: el.center.z },
            majorAxisEndPoint: { x: maj.x, y: maj.y, z: 0 }
          });
          break;
        }

        case 'SOLID':
        case '3DFACE': {
          const s = child as (SolidEntity | Face3DEntity);
          const transformedPts = s.points.map(p => {
            const tp = currentMatrix.transformPoint(p);
            return { x: tp.x, y: tp.y, z: p.z };
          });
          expandedList.push({
            ...s,
            layer: resolvedLayer,
            color: resolvedColor,
            colorIndex: resolvedColorIndex,
            points: transformedPts
          });
          break;
        }

        case 'INSERT': {
          // 嵌套 INSERT 递归处理：直接向下累乘传递 currentMatrix！
          const nestedInsert = child as InsertEntity;
          const nestedResolvedLayer = nestedInsert.layer === '0' ? resolvedLayer : nestedInsert.layer;
          const nestedResolvedColor = nestedInsert.colorIndex === 0 ? resolvedColor : nestedInsert.color;
          const nestedResolvedColorIndex = nestedInsert.colorIndex === 0 ? resolvedColorIndex : nestedInsert.colorIndex;
          const synthesized: InsertEntity = {
            ...nestedInsert,
            layer: nestedResolvedLayer,
            color: nestedResolvedColor,
            colorIndex: nestedResolvedColorIndex
          };
          const nestedExpanded = this.expandInsert(synthesized, blocks, depth + 1, currentVisited, currentMatrix);
          for (let k = 0; k < nestedExpanded.length; k++) {
            expandedList.push(nestedExpanded[k]);
          }
          break;
        }

        default:
          break;
      }
    }

    return expandedList;
  }
}
