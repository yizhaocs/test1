import { isWalkable, WorldState } from "./world.js";

interface Node {
  x: number;
  y: number;
  f: number;
  g: number;
  h: number;
  parent?: Node;
}

const directions = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 }
];

export function findPath(world: WorldState, startX: number, startY: number, goalX: number, goalY: number) {
  // 简化版 A*（曼哈顿距离），用于 2D 网格寻路。
  const open: Node[] = [];
  const closed = new Set<string>();

  const start: Node = {
    x: startX,
    y: startY,
    g: 0,
    h: Math.abs(goalX - startX) + Math.abs(goalY - startY),
    f: 0
  };
  start.f = start.g + start.h;
  open.push(start);

  const key = (x: number, y: number) => `${x},${y}`;

  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift();
    if (!current) break;

    if (current.x === goalX && current.y === goalY) {
      const path: { x: number; y: number }[] = [];
      let node: Node | undefined = current;
      while (node) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path;
    }

    closed.add(key(current.x, current.y));

    for (const dir of directions) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      if (!isWalkable(world, nx, ny)) continue;
      if (closed.has(key(nx, ny))) continue;

      const g = current.g + 1;
      const h = Math.abs(goalX - nx) + Math.abs(goalY - ny);
      const existing = open.find((node) => node.x === nx && node.y === ny);
      if (existing && g >= existing.g) continue;

      const node: Node = { x: nx, y: ny, g, h, f: g + h, parent: current };
      if (existing) {
        existing.g = g;
        existing.h = h;
        existing.f = g + h;
        existing.parent = current;
      } else {
        open.push(node);
      }
    }
  }

  return [];
}
