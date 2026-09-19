/**
 * DXF 数据结构定义与 AutoCAD 颜色索引 (ACI) 映射表
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D {
  x: number;
  y: number;
  z?: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface DxfLayer {
  name: string;
  color: string;
  colorIndex: number;
  visible: boolean;
  lineType?: string;
  entityCount?: number;
}

export interface BaseEntity {
  type: string;
  handle?: string;
  layer: string;
  color?: string;
  colorIndex?: number;
  lineType?: string;
}

export interface LineEntity extends BaseEntity {
  type: 'LINE';
  start: Point3D;
  end: Point3D;
}

export interface CircleEntity extends BaseEntity {
  type: 'CIRCLE';
  center: Point3D;
  radius: number;
}

export interface ArcEntity extends BaseEntity {
  type: 'ARC';
  center: Point3D;
  radius: number;
  startAngle: number; // 角度制 (Degrees, 0 = +X, 逆时针)
  endAngle: number;
}

export interface EllipseEntity extends BaseEntity {
  type: 'ELLIPSE';
  center: Point3D;
  majorAxisEndPoint: Point3D; // 相对于中心的向量
  axisRatio: number; // 短半轴 / 长半轴
  startAngle: number; // 弧度或参数
  endAngle: number;
}

export interface LwpolylineVertex {
  x: number;
  y: number;
  bulge?: number; // 凸度 = tan(包含角 / 4)
}

export interface LwpolylineEntity extends BaseEntity {
  type: 'LWPOLYLINE';
  vertices: LwpolylineVertex[];
  isClosed: boolean;
}

export interface PolylineEntity extends BaseEntity {
  type: 'POLYLINE';
  vertices: LwpolylineVertex[];
  isClosed: boolean;
}

export interface TextEntity extends BaseEntity {
  type: 'TEXT';
  text: string;
  position: Point3D;
  height: number;
  rotation: number; // 角度制
  halign?: number;
  valign?: number;
}

export interface MTextEntity extends BaseEntity {
  type: 'MTEXT';
  text: string;
  position: Point3D;
  height: number;
  rotation: number;
  attachmentPoint?: number;
}

export interface InsertEntity extends BaseEntity {
  type: 'INSERT';
  blockName: string;
  position: Point3D;
  scale: Point3D;
  rotation: number; // 角度制
}

export interface DimensionEntity extends BaseEntity {
  type: 'DIMENSION';
  blockName?: string;
  text?: string;
  defPoint1?: Point3D;
  defPoint2?: Point3D;
  defPoint3?: Point3D;
}

export interface SplineEntity extends BaseEntity {
  type: 'SPLINE';
  controlPoints: Point3D[];
  degree?: number;
  isClosed?: boolean;
}

export interface HatchEntity extends BaseEntity {
  type: 'HATCH';
  boundaries: Point2D[][];
  patternName?: string;
}

export type DxfEntity =
  | LineEntity
  | CircleEntity
  | ArcEntity
  | EllipseEntity
  | LwpolylineEntity
  | PolylineEntity
  | TextEntity
  | MTextEntity
  | InsertEntity
  | DimensionEntity
  | SplineEntity
  | HatchEntity;

export interface DxfBlock {
  name: string;
  basePoint: Point3D;
  entities: DxfEntity[];
}

export interface DxfDocument {
  layers: Map<string, DxfLayer>;
  blocks: Map<string, DxfBlock>;
  entities: DxfEntity[];
  boundingBox: BoundingBox;
  fileName?: string;
  version?: string;
}

/**
 * 完整 AutoCAD 颜色索引表 (ACI 0 - 255)
 */
export const ACI_COLOR_MAP: string[] = [
  '#000000', // 0: ByBlock
  '#FF0000', // 1: Red
  '#FFFF00', // 2: Yellow
  '#00FF00', // 3: Green
  '#00FFFF', // 4: Cyan
  '#0000FF', // 5: Blue
  '#FF00FF', // 6: Magenta
  '#FFFFFF', // 7: White / ByLayer
  '#808080', // 8: Dark Gray
  '#C0C0C0', // 9: Light Gray
  '#FF0000', '#FF7F7F', '#CC0000', '#CC6666', '#990000', // 10-14
  '#994C4C', '#7F0000', '#7F3F3F', '#4C0000', '#4C2626', // 15-19
  '#FF3F00', '#FF9F7F', '#CC3300', '#CC7F66', '#992600', // 20-24
  '#995F4C', '#7F1F00', '#7F4F3F', '#4C1300', '#4C2F26', // 25-29
  '#FF7F00', '#FFBF7F', '#CC6600', '#CC9966', '#994C00', // 30-34
  '#99734C', '#7F3F00', '#7F5F3F', '#4C2600', '#4C3926', // 35-39
  '#FFBF00', '#FFDF7F', '#CC9900', '#CCB266', '#997300', // 40-44
  '#99864C', '#7F5F00', '#7F6F3F', '#4C3900', '#4C4326', // 45-49
  '#FFFF00', '#FFFF7F', '#CCCC00', '#CCCC66', '#999900', // 50-54
  '#99994C', '#7F7F00', '#7F7F3F', '#4C4C00', '#4C4C26', // 55-59
  '#BFFF00', '#DFFF7F', '#99CC00', '#B2CC66', '#739900', // 60-64
  '#86994C', '#5F7F00', '#6F7F3F', '#394C00', '#434C26', // 65-69
  '#7FFF00', '#BFFF7F', '#66CC00', '#99CC66', '#4C9900', // 70-74
  '#73994C', '#3F7F00', '#5F7F3F', '#264C00', '#394C26', // 75-79
  '#3FFF00', '#9FFF7F', '#33CC00', '#7FCC66', '#269900', // 80-84
  '#5F994C', '#1F7F00', '#4F7F3F', '#134C00', '#2F4C26', // 85-89
  '#00FF00', '#7FFF7F', '#00CC00', '#66CC66', '#009900', // 90-94
  '#4C994C', '#007F00', '#3F7F3F', '#004C00', '#264C26', // 95-99
  '#00FF3F', '#7FFF9F', '#00CC33', '#66CC7F', '#009926', // 100-104
  '#4C995F', '#007F1F', '#3F7F4F', '#004C13', '#264C2F', // 105-109
  '#00FF7F', '#7FFFBF', '#00CC66', '#66CC99', '#00994C', // 110-114
  '#4C9973', '#007F3F', '#3F7F5F', '#004C26', '#264C39', // 115-119
  '#00FFBF', '#7FFFDF', '#00CC99', '#66CCB2', '#009973', // 120-124
  '#4C9986', '#007F5F', '#3F7F6F', '#004C39', '#264C43', // 125-129
  '#00FFFF', '#7FFFFF', '#00CCCC', '#66CCCC', '#009999', // 130-134
  '#4C9999', '#007F7F', '#3F7F7F', '#004C4C', '#264C4C', // 135-139
  '#00BFFF', '#7FDFFF', '#0099CC', '#66B2CC', '#007399', // 140-144
  '#4C8699', '#005F7F', '#3F6F7F', '#00394C', '#26434C', // 145-149
  '#007FFF', '#7FBFFF', '#0066CC', '#6699CC', '#004C99', // 150-154
  '#4C7399', '#003F7F', '#3F5F7F', '#00264C', '#26394C', // 155-159
  '#003FFF', '#7F9FFF', '#0033CC', '#667FCC', '#002699', // 160-164
  '#4C5F99', '#001F7F', '#3F4F7F', '#00134C', '#262F4C', // 165-169
  '#0000FF', '#7F7FFF', '#0000CC', '#6666CC', '#000099', // 170-174
  '#4C4C99', '#00007F', '#3F3F7F', '#00004C', '#26264C', // 175-179
  '#3F00FF', '#9F7FFF', '#3300CC', '#7F66CC', '#260099', // 180-184
  '#5F4C99', '#1F007F', '#4F3F7F', '#13004C', '#2F264C', // 185-189
  '#7F00FF', '#BF7FFF', '#6600CC', '#9966CC', '#4C0099', // 190-194
  '#734C99', '#3F007F', '#5F3F7F', '#26004C', '#39264C', // 195-199
  '#BF00FF', '#DF7FFF', '#9900CC', '#B266CC', '#730099', // 200-204
  '#864C99', '#5F007F', '#6F3F7F', '#39004C', '#43264C', // 205-209
  '#FF00FF', '#FF7FFF', '#CC00CC', '#CC66CC', '#990099', // 210-214
  '#994C99', '#7F007F', '#7F3F7F', '#4C004C', '#4C264C', // 215-219
  '#FF00BF', '#FF7FDF', '#CC0099', '#CC66B2', '#990073', // 220-224
  '#994C86', '#7F005F', '#7F3F6F', '#4C0039', '#4C2643', // 225-229
  '#FF007F', '#FF7FBF', '#CC0066', '#CC6699', '#99004C', // 230-234
  '#994C73', '#7F003F', '#7F3F5F', '#4C0026', '#4C2639', // 235-239
  '#FF003F', '#FF7F9F', '#CC0033', '#CC667F', '#990026', // 240-244
  '#994C5F', '#7F001F', '#7F3F4F', '#4C0013', '#4C262F', // 245-249
  '#333333', '#5B5B5B', '#848484', '#ADADAD', '#D6D6D6', '#FFFFFF' // 250-255: Grayscale
];

export function getColorFromAci(colorIndex?: number, defaultColor: string = '#FFFFFF'): string {
  if (colorIndex === undefined || colorIndex === null) {
    return defaultColor;
  }
  const idx = Math.abs(colorIndex);
  if (idx >= 0 && idx < ACI_COLOR_MAP.length) {
    return ACI_COLOR_MAP[idx];
  }
  return defaultColor;
}
