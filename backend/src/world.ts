export type Tile = "road" | "grass" | "wall" | "water" | "shop" | "home" | "switch" | "door" | "gate" | "footprint";

export type AgentId = "lan" | "xia";

export interface AgentState {
  id: AgentId;
  name: string;
  x: number;
  y: number;
  inventory: string[];
  emoji: string;
}

export interface NPCState {
  id: string;
  name: string;
  x: number;
  y: number;
  mood: string;
  dialog: string[];
}

export interface ItemState {
  id: string;
  name: string;
  x: number;
  y: number;
  picked: boolean;
}

export interface SwitchState {
  id: string;
  x: number;
  y: number;
  pressedBy?: AgentId;
}

export interface DoorState {
  id: string;
  x: number;
  y: number;
  open: boolean;
}

export interface WorldState {
  width: number;
  height: number;
  tiles: Tile[][];
  agents: Record<AgentId, AgentState>;
  npcs: Record<string, NPCState>;
  items: Record<string, ItemState>;
  switches: Record<string, SwitchState>;
  door: DoorState;
  synergy: number;
  taskId?: string;
  status: "idle" | "running" | "completed";
  log: string[];
}

// 20x14 像素世界布局：字符转 Tile，前端只渲染，后端是唯一权威状态。
const layout = [
  "####################",
  "#RRRRR......GGG....#",
  "#R....~~~~..G.D....#",
  "#R.S..~~~~..G......#",
  "#R....~~~~..G......#",
  "#R....~~~~..G..H...#",
  "#R.............H...#",
  "#R..TT......#####..#",
  "#R..TT..FFF.#...#..#",
  "#R......FFF.#...#..#",
  "#R...........#...#.#",
  "#R..N...C....#####.#",
  "#R...............###",
  "####################"
];

function tileFromChar(char: string): Tile {
  switch (char) {
    case "#":
      return "wall";
    case "~":
      return "water";
    case "S":
      return "shop";
    case "H":
      return "home";
    case "T":
      return "switch";
    case "D":
      return "door";
    case "G":
      return "gate";
    case "F":
      return "footprint";
    case "R":
      return "road";
    case "N":
      return "road";
    case "C":
      return "road";
    default:
      return "grass";
  }
}

export function createWorld(): WorldState {
  const tiles = layout.map((row) => row.split("").map(tileFromChar));
  const width = tiles[0].length;
  const height = tiles.length;

  return {
    width,
    height,
    tiles,
    agents: {
      lan: { id: "lan", name: "阿岚", x: 1, y: 1, inventory: [], emoji: "🧭" },
      xia: { id: "xia", name: "小夏", x: 2, y: 1, inventory: [], emoji: "🌟" }
    },
    npcs: {
      shopkeeper: {
        id: "shopkeeper",
        name: "店主",
        x: 3,
        y: 3,
        mood: "忙碌",
        dialog: ["苹果新鲜到货！", "要不要来点苹果？"]
      },
      guard: {
        id: "guard",
        name: "守门人",
        x: 12,
        y: 2,
        mood: "谨慎",
        dialog: ["钥匙呢？", "要两位一起通过。"]
      },
      villager: {
        id: "villager",
        name: "路人",
        x: 4,
        y: 11,
        mood: "八卦",
        dialog: ["今天会下小雨。", "小猫总在脚印附近出没。"]
      },
      cat: {
        id: "cat",
        name: "走失的小猫",
        x: 10,
        y: 11,
        mood: "胆小",
        dialog: ["喵~", "可以带我回家吗？"]
      }
    },
    items: {
      apple1: { id: "apple1", name: "苹果", x: 4, y: 3, picked: false },
      apple2: { id: "apple2", name: "苹果", x: 5, y: 3, picked: false },
      key: { id: "key", name: "钥匙", x: 13, y: 3, picked: false },
      clue: { id: "clue", name: "线索卡", x: 4, y: 11, picked: false }
    },
    switches: {
      switchA: { id: "switchA", x: 4, y: 7 },
      switchB: { id: "switchB", x: 5, y: 7 }
    },
    door: { id: "gateDoor", x: 13, y: 2, open: false },
    synergy: 0,
    status: "idle",
    log: []
  };
}

export function resetWorld(state: WorldState) {
  const fresh = createWorld();
  Object.assign(state, fresh);
}

export function isInside(world: WorldState, x: number, y: number) {
  return x >= 0 && y >= 0 && x < world.width && y < world.height;
}

export function isWalkable(world: WorldState, x: number, y: number) {
  if (!isInside(world, x, y)) return false;
  const tile = world.tiles[y][x];
  if (tile === "wall" || tile === "water") return false;
  if (tile === "door" && !world.door.open) return false;
  return true;
}

export function setDoorState(world: WorldState) {
  const pressed = Object.values(world.switches).filter((sw) => sw.pressedBy);
  if (pressed.length === 2) {
    world.door.open = true;
  }
}

export function switchAt(world: WorldState, x: number, y: number) {
  return Object.values(world.switches).find((sw) => sw.x === x && sw.y === y);
}

export function npcAt(world: WorldState, x: number, y: number) {
  return Object.values(world.npcs).find((npc) => npc.x === x && npc.y === y);
}

export function itemAt(world: WorldState, x: number, y: number) {
  return Object.values(world.items).find((item) => item.x === x && item.y === y && !item.picked);
}

export function tileLabel(tile: Tile) {
  switch (tile) {
    case "road":
      return "道路";
    case "grass":
      return "草地";
    case "wall":
      return "墙";
    case "water":
      return "水";
    case "shop":
      return "商店";
    case "home":
      return "家门";
    case "switch":
      return "双人开关";
    case "door":
      return "门";
    case "gate":
      return "门禁区";
    case "footprint":
      return "脚印";
    default:
      return tile;
  }
}
