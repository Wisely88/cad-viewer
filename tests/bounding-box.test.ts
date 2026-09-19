import { describe, it } from 'node:test';
import assert from 'node:assert';
import { computeBoundingBox } from '../src/parser/bounding-box.ts';
import type { ArcEntity, CircleEntity, LineEntity, LwpolylineEntity } from '../src/parser/dxf-types.ts';

describe('Bounding Box Tests', () => {
  it('should accurately compute bounding box for ARC with quadrant extrema', () => {
    // 圆心 (0, 0)，半径 100，起止角 45° 到 135° (跨越 90° 极值点)
    const arc: ArcEntity = {
      type: 'ARC',
      layer: '0',
      center: { x: 0, y: 0, z: 0 },
      radius: 100,
      startAngle: 45,
      endAngle: 135
    };

    const bbox = computeBoundingBox([arc]);
    // 90 度在区间内，maxY 应该严格为 100
    assert.strictEqual(bbox.maxY, 100);
    // 0 度、180 度、270 度不在区间内，minY 是两端点的 Y: 100 * sin(45°) ~ 70.71
    assert.ok(Math.abs(bbox.minY - 100 * Math.sin((45 * Math.PI) / 180)) < 1e-3);
    assert.ok(Math.abs(bbox.minX - -100 * Math.cos((45 * Math.PI) / 180)) < 1e-3);
    assert.ok(Math.abs(bbox.maxX - 100 * Math.cos((45 * Math.PI) / 180)) < 1e-3);
  });

  it('should compute bounding box for ARC crossing 0 degrees', () => {
    // 圆心 (0, 0)，半径 50，起止角 330° 到 30° (跨越 0° 极值点)
    const arc: ArcEntity = {
      type: 'ARC',
      layer: '0',
      center: { x: 0, y: 0, z: 0 },
      radius: 50,
      startAngle: 330,
      endAngle: 30
    };

    const bbox = computeBoundingBox([arc]);
    // 0 度极值在区间内，maxX 必须为 50
    assert.strictEqual(bbox.maxX, 50);
  });

  it('should compute bounding box for combined entities', () => {
    const line: LineEntity = {
      type: 'LINE',
      layer: '0',
      start: { x: -200, y: -50, z: 0 },
      end: { x: 100, y: 300, z: 0 }
    };
    const circle: CircleEntity = {
      type: 'CIRCLE',
      layer: '0',
      center: { x: 50, y: 50, z: 0 },
      radius: 80
    };
    const poly: LwpolylineEntity = {
      type: 'LWPOLYLINE',
      layer: '0',
      isClosed: true,
      vertices: [
        { x: -50, y: -100 },
        { x: -50, y: -20 },
        { x: 350, y: -20 }
      ]
    };

    const bbox = computeBoundingBox([line, circle, poly]);
    assert.strictEqual(bbox.minX, -200);
    assert.strictEqual(bbox.maxX, 350);
    assert.strictEqual(bbox.minY, -100);
    assert.strictEqual(bbox.maxY, 300);
  });
});
