export type NodeType = 'start' | 'process' | 'decision' | 'end';
export interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
}
export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  label: string;
}
export interface FlowDocument {
  version: 1;
  nodes: FlowNode[];
  edges: FlowEdge[];
}
export interface SavedFlowchart {
  document: FlowDocument;
  revision: number;
}
export const nodeTypes: { type: NodeType; label: string }[] = [
  { type: 'start', label: '开始' },
  { type: 'process', label: '步骤' },
  { type: 'decision', label: '判断' },
  { type: 'end', label: '结束' },
];
export function parseDocument(value: unknown): FlowDocument {
  if (!value || typeof value !== 'object') throw new Error('无效的流程图文件');
  const data = value as Partial<FlowDocument>;
  if (
    data.version !== 1 ||
    !Array.isArray(data.nodes) ||
    !Array.isArray(data.edges) ||
    data.nodes.length > 100 ||
    data.edges.length > 200
  )
    throw new Error('格式不正确或超过节点、连线数量限制');
  const ids = new Set<string>();
  const validId = (id: unknown): id is string => typeof id === 'string' && /^[\w-]{1,64}$/.test(id);
  for (const node of data.nodes) {
    if (
      !node ||
      !validId(node.id) ||
      ids.has(node.id) ||
      !nodeTypes.some((item) => item.type === node.type) ||
      typeof node.label !== 'string' ||
      !node.label.trim() ||
      node.label.length > 64 ||
      !Number.isFinite(node.x) ||
      !Number.isFinite(node.y) ||
      node.x < 90 ||
      node.x > 1510 ||
      node.y < 60 ||
      node.y > 940
    )
      throw new Error('节点数据不正确');
    ids.add(node.id);
  }
  const edges = new Set<string>(),
    pairs = new Set<string>();
  for (const edge of data.edges) {
    if (
      !edge ||
      !validId(edge.id) ||
      ids.has(edge.id) ||
      edges.has(edge.id) ||
      !ids.has(edge.from) ||
      !ids.has(edge.to) ||
      edge.from === edge.to ||
      typeof edge.label !== 'string' ||
      edge.label.length > 64 ||
      pairs.has(`${edge.from}:${edge.to}`)
    )
      throw new Error('连线数据不正确');
    edges.add(edge.id);
    pairs.add(`${edge.from}:${edge.to}`);
  }
  return {
    version: 1,
    nodes: data.nodes.map(({ id, type, label, x, y }) => ({ id, type, label, x, y })),
    edges: data.edges.map(({ id, from, to, label }) => ({ id, from, to, label })),
  };
}
export function edgeGeometry(edge: FlowEdge, nodes: FlowNode[]) {
  const from = nodes.find((node) => node.id === edge.from),
    to = nodes.find((node) => node.id === edge.to);
  if (!from || !to) return { path: '', x: 0, y: 0 };
  const horizontal = Math.abs(to.x - from.x) > Math.abs(to.y - from.y);
  if (horizontal) {
    const direction = to.x >= from.x ? 1 : -1;
    const x1 = from.x + 80 * direction,
      x2 = to.x - 80 * direction,
      middle = (x1 + x2) / 2;
    return {
      path: `M ${x1} ${from.y} H ${middle} V ${to.y} H ${x2}`,
      x: middle,
      y: (from.y + to.y) / 2 - 12,
    };
  }
  const direction = to.y >= from.y ? 1 : -1;
  const y1 = from.y + (from.type === 'decision' ? 50 : 30) * direction;
  const y2 = to.y - (to.type === 'decision' ? 50 : 30) * direction;
  const middle = (y1 + y2) / 2;
  return {
    path: `M ${from.x} ${y1} V ${middle} H ${to.x} V ${y2}`,
    x: (from.x + to.x) / 2 + 18,
    y: middle - 10,
  };
}
