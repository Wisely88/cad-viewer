import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DxfParser, cleanMText, interpolateBulge } from '../src/parser/dxf-parser.ts';
import { isAngleBetween } from '../src/parser/bounding-box.ts';

describe('DXF Parser Tests', () => {
  const parser = new DxfParser();

  it('should clean MTEXT formatting codes correctly', () => {
    const raw = '{\\fArial|b0|i0;Sample\\PSecond Line\\A1;\\S1/2;}';
    const cleaned = cleanMText(raw);
    assert.strictEqual(cleaned, 'Sample\nSecond Line1/2');
  });

  it('should correctly interpolate bulge arc points for LWPOLYLINE', () => {
    const p1 = { x: 0, y: 0 };
    const p2 = { x: 100, y: 0 };
    // 负凸度 (CW, 向左/上方弧拱)
    const pointsUp = interpolateBulge(p1, p2, -1.0, 8);
    assert.ok(pointsUp.length >= 4);
    const maxY = Math.max(...pointsUp.map(p => p.y));
    assert.ok(Math.abs(maxY - 50) < 2, `Expected maxY ~ 50 for bulge=-1.0, got ${maxY}`);

    // 正凸度 (CCW, 向右/下方弧拱)
    const pointsDown = interpolateBulge(p1, p2, 1.0, 8);
    assert.ok(pointsDown.length >= 4);
    const minY = Math.min(...pointsDown.map(p => p.y));
    assert.ok(Math.abs(minY - -50) < 2, `Expected minY ~ -50 for bulge=1.0, got ${minY}`);
  });

  it('should parse LINE and CIRCLE entities correctly', () => {
    const dxfContent = `
0
SECTION
2
TABLES
0
TABLE
2
LAYER
0
LAYER
2
WALLS
62
1
70
0
0
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
WALLS
10
0.0
20
0.0
30
0.0
11
100.0
21
0.0
31
0.0
0
CIRCLE
8
WALLS
10
50.0
20
50.0
30
0.0
40
25.0
0
ENDSEC
0
EOF
`;
    const doc = parser.parse(dxfContent);
    assert.strictEqual(doc.entities.length, 2);

    const line = doc.entities.find(e => e.type === 'LINE');
    assert.ok(line);
    assert.strictEqual(line.layer, 'WALLS');
    assert.strictEqual(line.color, '#FF0000'); // ACI 1 = Red

    const circle = doc.entities.find(e => e.type === 'CIRCLE');
    assert.ok(circle);
    assert.strictEqual(circle.layer, 'WALLS');

    const wallLayer = doc.layers.get('WALLS');
    assert.ok(wallLayer);
    assert.strictEqual(wallLayer.entityCount, 2);
  });

  it('should correctly expand nested BLOCK and INSERT entities with transforms', () => {
    const dxfWithBlocks = `
0
SECTION
2
BLOCKS
0
BLOCK
2
SUB_PART
10
0.0
20
0.0
0
LINE
8
0
10
0.0
20
0.0
11
10.0
21
0.0
0
ENDBLK
0
BLOCK
2
MAIN_ASSEMBLY
10
0.0
20
0.0
0
INSERT
2
SUB_PART
10
20.0
20
0.0
41
2.0
42
2.0
50
0.0
0
ENDBLK
0
ENDSEC
0
SECTION
2
ENTITIES
0
INSERT
8
LAYER_A
2
MAIN_ASSEMBLY
10
100.0
20
50.0
41
1.0
42
1.0
50
90.0
0
ENDSEC
0
EOF
`;
    const doc = parser.parse(dxfWithBlocks);
    // 应该将 nested insert 展开为最终几何图元 LINE
    assert.strictEqual(doc.entities.length, 1);
    const line = doc.entities[0];
    assert.strictEqual(line.type, 'LINE');
    assert.strictEqual(line.layer, 'LAYER_A'); // 继承外层 INSERT 图层

    // 变换计算验证：
    // SUB_PART 在 MAIN_ASSEMBLY 内位于 (20, 0)，scale 2.0，所以线段在父级中是 (20, 0) 到 (40, 0)
    // 外层 MAIN_ASSEMBLY 位于 (100, 50)，旋转 90 度
    // (20, 0) 旋转 90 度为 (0, 20) + (100, 50) => (100, 70)
    // (40, 0) 旋转 90 度为 (0, 40) + (100, 50) => (100, 90)
    if (line.type === 'LINE') {
      assert.ok(Math.abs(line.start.x - 100) < 1e-4, `Expected start.x ~ 100, got ${line.start.x}`);
      assert.ok(Math.abs(line.start.y - 70) < 1e-4, `Expected start.y ~ 70, got ${line.start.y}`);
      assert.ok(Math.abs(line.end.x - 100) < 1e-4, `Expected end.x ~ 100, got ${line.end.x}`);
      assert.ok(Math.abs(line.end.y - 90) < 1e-4, `Expected end.y ~ 90, got ${line.end.y}`);
    }
  });

  it('should accurately test angle containment including zero crossing', () => {
    // 90 度在 [45, 135] 之间
    assert.strictEqual(isAngleBetween(90, 45, 135), true);
    // 180 度不在 [45, 135] 之间
    assert.strictEqual(isAngleBetween(180, 45, 135), false);
    // 0 度在 [300, 60] (跨越 0 度) 之间
    assert.strictEqual(isAngleBetween(0, 300, 60), true);
    assert.strictEqual(isAngleBetween(350, 300, 60), true);
    assert.strictEqual(isAngleBetween(30, 300, 60), true);
    assert.strictEqual(isAngleBetween(180, 300, 60), false);
  });

  it('should handle massive entity collections (>70,000) without Maximum call stack size exceeded', () => {
    // 构造包含 80,000 个实体的超大块定义，验证不会因扩展运算符 spread 导致函数调用栈溢出
    const lines: string[] = [
      '0', 'SECTION',
      '2', 'BLOCKS',
      '0', 'BLOCK',
      '2', 'MASSIVE_BLOCK',
      '10', '0.0', '20', '0.0', '30', '0.0'
    ];

    const entityCount = 75000;
    for (let i = 0; i < entityCount; i++) {
      lines.push('0', 'LINE', '8', '0', '10', `${i}`, '20', '0.0', '11', `${i + 1}`, '21', '1.0');
    }

    lines.push('0', 'ENDBLK', '0', 'ENDSEC');
    lines.push('0', 'SECTION', '2', 'ENTITIES');
    lines.push('0', 'INSERT', '2', 'MASSIVE_BLOCK', '10', '0.0', '20', '0.0', '30', '0.0');
    lines.push('0', 'ENDSEC', '0', 'EOF');

    const bigDxf = lines.join('\n');
    assert.doesNotThrow(() => {
      const doc = parser.parse(bigDxf);
      assert.strictEqual(doc.entities.length, entityCount);
    });
  });

  it('should prevent stack overflow on circular block references (Block A referencing Block A)', () => {
    const circularDxf = `
0
SECTION
2
BLOCKS
0
BLOCK
2
RECURSIVE_BLOCK
10
0.0
20
0.0
30
0.0
0
LINE
8
0
10
0.0
20
0.0
11
10.0
21
0.0
0
INSERT
2
RECURSIVE_BLOCK
10
10.0
20
0.0
0
ENDBLK
0
ENDSEC
0
SECTION
2
ENTITIES
0
INSERT
2
RECURSIVE_BLOCK
10
0.0
20
0.0
0
ENDSEC
0
EOF
`;
    assert.doesNotThrow(() => {
      const doc = parser.parse(circularDxf);
      assert.ok(doc.entities.length >= 1);
    });
  });

  it('should parse Polyface Mesh (flag 64) and convert faces into wireframe LINE entities', () => {
    const polyfaceDxf = `
0
SECTION
2
ENTITIES
0
POLYLINE
8
EQUIPMENT
70
64
71
4
72
1
0
VERTEX
8
EQUIPMENT
10
0.0
20
0.0
30
0.0
70
192
0
VERTEX
8
EQUIPMENT
10
10.0
20
0.0
30
0.0
70
192
0
VERTEX
8
EQUIPMENT
10
10.0
20
10.0
30
0.0
70
192
0
VERTEX
8
EQUIPMENT
10
0.0
20
10.0
30
0.0
70
192
0
VERTEX
8
EQUIPMENT
70
128
71
1
72
2
73
3
74
4
0
SEQEND
0
ENDSEC
0
EOF
`;
    const doc = parser.parse(polyfaceDxf);
    // 应该将四边形面转换为 4 条封闭的线框边 LINE
    assert.strictEqual(doc.entities.length, 4);
    assert.strictEqual(doc.entities[0].type, 'LINE');
    assert.strictEqual(doc.entities[0].layer, 'EQUIPMENT');
  });

  it('should correctly handle negative scale (mirroring) on ARC entities in INSERT', () => {
    const mirroredDxf = `
0
SECTION
2
BLOCKS
0
BLOCK
2
ARC_BLOCK
10
0.0
20
0.0
30
0.0
0
ARC
8
0
10
0.0
20
0.0
30
0.0
40
50.0
50
0.0
51
90.0
0
ENDBLK
0
ENDSEC
0
SECTION
2
ENTITIES
0
INSERT
2
ARC_BLOCK
10
100.0
20
200.0
41
-1.0
42
1.0
50
0.0
0
ENDSEC
0
EOF
`;
    const doc = parser.parse(mirroredDxf);
    assert.strictEqual(doc.entities.length, 1);
    const arc = doc.entities[0];
    assert.strictEqual(arc.type, 'ARC');
    if (arc.type === 'ARC') {
      assert.strictEqual(arc.center.x, 100);
      assert.strictEqual(arc.center.y, 200);
      // X 轴镜像后，原 0~90 变为 90~180 (逆时针 CCW)
      assert.ok(Math.abs(arc.startAngle - 90) < 1e-3, `Expected startAngle ~ 90, got ${arc.startAngle}`);
      assert.ok(Math.abs(arc.endAngle - 180) < 1e-3, `Expected endAngle ~ 180, got ${arc.endAngle}`);
    }
  });
});
