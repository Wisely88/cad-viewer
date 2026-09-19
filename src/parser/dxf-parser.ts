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
  Point3D
} from './dxf-types.ts';
import { getColorFromAci } from './dxf-types.ts';
import { computeBoundingBox } from './bounding-box.ts';

interface DxfPair {
  code: number;
  value: string;
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

    // 展开所有 INSERT 实体（递归解析 BLOCK 引用并计算复合坐标变换）
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

    // 统计图层实体数并同步颜色
    for (const ent of flattenedEntities) {
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
            if (entity) {
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
        if (entity) {
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
   * 解析单个实体
   */
  private parseEntity(pairs: DxfPair[], startIndex: number): { entity: DxfEntity | null; nextIndex: number } {
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
        while (i < len && pairs[i].code !== 0) {
          const { code, value } = pairs[i];
          if (code === 8) layer = value;
          else if (code === 5) handle = value;
          else if (code === 62) colorIndex = parseInt(value, 10);
          else if (code === 6) lineType = value;
          else if (code === 70) {
            isClosed = (parseInt(value, 10) & 1) === 1;
          }
          i++;
        }

        const vertices: LwpolylineVertex[] = [];
        // 解析 VERTEX 系列直至 SEQEND
        while (i < len && !(pairs[i].code === 0 && pairs[i].value === 'SEQEND')) {
          if (pairs[i].code === 0 && pairs[i].value === 'VERTEX') {
            i++;
            const v: LwpolylineVertex = { x: 0, y: 0 };
            while (i < len && pairs[i].code !== 0) {
              const { code, value } = pairs[i];
              if (code === 10) v.x = parseFloat(value);
              else if (code === 20) v.y = parseFloat(value);
              else if (code === 42) v.bulge = parseFloat(value);
              i++;
            }
            vertices.push(v);
          } else {
            i++;
          }
        }
        if (i < len && pairs[i].code === 0 && pairs[i].value === 'SEQEND') {
          i++;
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
   * 递归展开 INSERT 实体（复合仿射变换：平移 * 旋转 * 缩放）
   * 包含防死循环递归深度限制 (最大深度 8) 与环状引用检测
   */
  private expandInsert(
    insert: InsertEntity,
    blocks: Map<string, DxfBlock>,
    depth: number,
    visitedBlocks: Set<string> = new Set()
  ): DxfEntity[] {
    if (depth > 8 || visitedBlocks.has(insert.blockName)) return [];

    const block = blocks.get(insert.blockName);
    if (!block || !block.entities.length) return [];

    const currentVisited = new Set(visitedBlocks);
    currentVisited.add(insert.blockName);

    const rad = (insert.rotation * Math.PI) / 180;
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);
    const sx = insert.scale.x ?? 1;
    const sy = insert.scale.y ?? 1;
    const tx = insert.position.x;
    const ty = insert.position.y;

    // 变换点计算
    const transformPoint = (p: Point3D): Point3D => {
      // 相对块基准点
      const relX = (p.x - block.basePoint.x) * sx;
      const relY = (p.y - block.basePoint.y) * sy;
      // 旋转 + 平移
      const rotX = relX * cosR - relY * sinR;
      const rotY = relX * sinR + relY * cosR;
      return {
        x: rotX + tx,
        y: rotY + ty,
        z: p.z
      };
    };

    const expandedList: DxfEntity[] = [];

    for (const child of block.entities) {
      // 继承图层与颜色策略：如果子实体是 '0' 图层，继承 INSERT 所在图层；如果颜色是 ByBlock，继承 INSERT 颜色
      const resolvedLayer = child.layer === '0' ? insert.layer : child.layer;
      const resolvedColor = child.colorIndex === 0 ? insert.color : child.color;
      const resolvedColorIndex = child.colorIndex === 0 ? insert.colorIndex : child.colorIndex;

      switch (child.type) {
        case 'LINE': {
          const l = child as LineEntity;
          expandedList.push({
            ...l,
            layer: resolvedLayer,
            color: resolvedColor,
            colorIndex: resolvedColorIndex,
            start: transformPoint(l.start),
            end: transformPoint(l.end)
          });
          break;
        }

        case 'CIRCLE': {
          const c = child as CircleEntity;
          const transformedCenter = transformPoint(c.center);
          const effectiveScale = Math.max(Math.abs(sx), Math.abs(sy));
          expandedList.push({
            ...c,
            layer: resolvedLayer,
            color: resolvedColor,
            colorIndex: resolvedColorIndex,
            center: transformedCenter,
            radius: c.radius * effectiveScale
          });
          break;
        }

        case 'ARC': {
          const a = child as ArcEntity;
          const transformedCenter = transformPoint(a.center);
          const effectiveScale = Math.max(Math.abs(sx), Math.abs(sy));
          const newStartAngle = (a.startAngle + insert.rotation) % 360;
          const newEndAngle = (a.endAngle + insert.rotation) % 360;
          expandedList.push({
            ...a,
            layer: resolvedLayer,
            color: resolvedColor,
            colorIndex: resolvedColorIndex,
            center: transformedCenter,
            radius: a.radius * effectiveScale,
            startAngle: newStartAngle,
            endAngle: newEndAngle
          });
          break;
        }

        case 'LWPOLYLINE':
        case 'POLYLINE': {
          const poly = child as (LwpolylineEntity | PolylineEntity);
          const transformedVertices: LwpolylineVertex[] = poly.vertices.map(v => {
            const tp = transformPoint({ x: v.x, y: v.y });
            return {
              x: tp.x,
              y: tp.y,
              bulge: v.bulge
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
          expandedList.push({
            ...t,
            layer: resolvedLayer,
            color: resolvedColor,
            colorIndex: resolvedColorIndex,
            position: transformPoint(t.position),
            height: t.height * Math.abs(sy),
            rotation: (t.rotation + insert.rotation) % 360
          });
          break;
        }

        case 'MTEXT': {
          const mt = child as MTextEntity;
          expandedList.push({
            ...mt,
            layer: resolvedLayer,
            color: resolvedColor,
            colorIndex: resolvedColorIndex,
            position: transformPoint(mt.position),
            height: mt.height * Math.abs(sy),
            rotation: (mt.rotation + insert.rotation) % 360
          });
          break;
        }

        case 'INSERT': {
          // 嵌套 INSERT 递归处理
          const nestedInsert = child as InsertEntity;
          const nestedTransformedPos = transformPoint(nestedInsert.position);
          const synthesizedInsert: InsertEntity = {
            ...nestedInsert,
            layer: resolvedLayer,
            color: resolvedColor,
            position: nestedTransformedPos,
            scale: {
              x: nestedInsert.scale.x * sx,
              y: nestedInsert.scale.y * sy,
              z: (nestedInsert.scale.z ?? 1) * (insert.scale.z ?? 1)
            },
            rotation: (nestedInsert.rotation + insert.rotation) % 360
          };
          const nestedExpanded = this.expandInsert(synthesizedInsert, blocks, depth + 1, currentVisited);
          for (let k = 0; k < nestedExpanded.length; k++) {
            expandedList.push(nestedExpanded[k]);
          }
          break;
        }

        case 'ELLIPSE': {
          const el = child as EllipseEntity;
          expandedList.push({
            ...el,
            layer: resolvedLayer,
            color: resolvedColor,
            colorIndex: resolvedColorIndex,
            center: transformPoint(el.center),
            majorAxisEndPoint: {
              x: el.majorAxisEndPoint.x * sx * cosR - el.majorAxisEndPoint.y * sy * sinR,
              y: el.majorAxisEndPoint.x * sx * sinR + el.majorAxisEndPoint.y * sy * cosR
            }
          });
          break;
        }

        default:
          break;
      }
    }

    return expandedList;
  }
}
