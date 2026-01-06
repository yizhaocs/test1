import { useEffect, useMemo, useRef, useState } from "react";

type AgentId = "lan" | "xia";

type Tile =
  | "road"
  | "grass"
  | "wall"
  | "water"
  | "shop"
  | "home"
  | "switch"
  | "door"
  | "gate"
  | "footprint";

interface AgentState {
  id: AgentId;
  name: string;
  x: number;
  y: number;
  inventory: string[];
  emoji: string;
}

interface NPCState {
  id: string;
  name: string;
  x: number;
  y: number;
  mood: string;
}

interface ItemState {
  id: string;
  name: string;
  x: number;
  y: number;
  picked: boolean;
}

interface SwitchState {
  id: string;
  x: number;
  y: number;
  pressedBy?: AgentId;
}

interface DoorState {
  id: string;
  x: number;
  y: number;
  open: boolean;
}

interface WorldState {
  width: number;
  height: number;
  tiles: Tile[][];
  agents: Record<AgentId, AgentState>;
  npcs: Record<string, NPCState>;
  items: Record<string, ItemState>;
  switches: Record<string, SwitchState>;
  door: DoorState;
  synergy: number;
  status: "idle" | "running" | "completed";
  taskId?: string;
}

interface TaskInfo {
  id: string;
  title: string;
  description: string;
}

interface StreamEvent {
  agentId: AgentId;
  field: "ThoughtSummary" | "Plan" | "Observation" | "Action" | "Dialogue";
  content: string | string[];
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

const defaultLayout = [
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

const toTile = (char: string): Tile => {
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
    default:
      return "grass";
  }
};

const createDefaultWorld = (): WorldState => ({
  width: 20,
  height: 14,
  tiles: defaultLayout.map((row) => row.split("").map(toTile)),
  agents: {
    lan: { id: "lan", name: "阿岚", x: 1, y: 1, inventory: [], emoji: "🧭" },
    xia: { id: "xia", name: "小夏", x: 2, y: 1, inventory: [], emoji: "🌟" }
  },
  npcs: {
    shopkeeper: { id: "shopkeeper", name: "店主", x: 3, y: 3, mood: "忙碌" },
    guard: { id: "guard", name: "守门人", x: 12, y: 2, mood: "谨慎" },
    villager: { id: "villager", name: "路人", x: 4, y: 11, mood: "八卦" },
    cat: { id: "cat", name: "走失的小猫", x: 10, y: 11, mood: "胆小" }
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
  taskId: "未开始"
});

const tileColors: Record<Tile, string> = {
  road: "#7a5c3d",
  grass: "#3f8f3f",
  wall: "#2a2a2a",
  water: "#2c6dad",
  shop: "#b1784b",
  home: "#c2a56b",
  switch: "#8f5bd9",
  door: "#5b2b2b",
  gate: "#888888",
  footprint: "#c3c3c3"
};

const agentColors: Record<AgentId, string> = {
  lan: "#5ad1ff",
  xia: "#ff8fd4"
};

const panelTabs = ["总览", "阿岚", "小夏", "世界事件"] as const;

type PanelTab = (typeof panelTabs)[number];

const helpText = `可输入 /help 查看提示。\n\n指令示例：\n- 去商店买 2 个苹果，然后把它们送到家门口；路上顺便问问 NPC 今天的天气\n- /help\n`;

export default function App() {
  const [world, setWorld] = useState<WorldState | null>(createDefaultWorld());
  const [tasks, setTasks] = useState<TaskInfo[]>([
    { id: "task-a", title: "新手任务：买苹果送到家", description: "" },
    { id: "task-b", title: "协作机关：双人拉杆门", description: "" },
    { id: "task-c", title: "轻喜剧：找走失的小猫", description: "" }
  ]);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PanelTab>("总览");
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [worldEvents, setWorldEvents] = useState<string[]>([]);
  const [instruction, setInstruction] = useState("去商店买 2 个苹果，然后把它们送到家门口；路上顺便问问 NPC 今天的天气");
  const [statusMessage, setStatusMessage] = useState("等待指令");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const wsUrl = BACKEND_URL.replace(/^http/, "ws");
    const socket = new WebSocket(wsUrl);
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "world_update") {
        setWorld(message.payload.world);
      }
      if (message.type === "tasks") {
        setTasks(message.payload.tasks);
      }
      if (message.type === "trace") {
        setTraceId(message.payload.traceId ?? null);
      }
      if (message.type === "ui_event") {
        setEvents((prev) => [message.payload, ...prev].slice(0, 200));
      }
      if (message.type === "system") {
        setWorldEvents((prev) => [message.payload.message, ...prev].slice(0, 80));
      }
    });
    socket.addEventListener("open", () => setStatusMessage("已连接后台"));
    socket.addEventListener("close", () => setStatusMessage("连接已断开"));
    return () => socket.close();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !world) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < world.height; y += 1) {
      for (let x = 0; x < world.width; x += 1) {
        const tile = world.tiles[y][x];
        ctx.fillStyle = tileColors[tile];
        ctx.fillRect(x * 32, y * 32, 32, 32);
      }
    }

    Object.values(world.items)
      .filter((item) => !item.picked)
      .forEach((item) => {
        ctx.fillStyle = "#ffdf6e";
        ctx.fillRect(item.x * 32 + 8, item.y * 32 + 8, 16, 16);
      });

    Object.values(world.npcs).forEach((npc) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(npc.x * 32 + 6, npc.y * 32 + 6, 20, 20);
      ctx.fillStyle = "#000";
      ctx.font = "10px sans-serif";
      ctx.fillText(npc.name.slice(0, 2), npc.x * 32 + 4, npc.y * 32 + 30);
    });

    Object.values(world.switches).forEach((sw) => {
      ctx.fillStyle = sw.pressedBy ? "#ff9d4d" : "#7a4ef2";
      ctx.fillRect(sw.x * 32 + 4, sw.y * 32 + 4, 24, 24);
    });

    ctx.fillStyle = world.door.open ? "#5fd58e" : "#5b2b2b";
    ctx.fillRect(world.door.x * 32 + 2, world.door.y * 32 + 2, 28, 28);

    Object.values(world.agents).forEach((agent) => {
      ctx.fillStyle = agentColors[agent.id];
      ctx.beginPath();
      ctx.arc(agent.x * 32 + 16, agent.y * 32 + 16, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.font = "12px sans-serif";
      ctx.fillText(agent.emoji, agent.x * 32 + 8, agent.y * 32 + 20);
    });
  }, [world]);

  const filteredEvents = useMemo(() => {
    if (activeTab === "总览") return events;
    if (activeTab === "阿岚") return events.filter((event) => event.agentId === "lan");
    if (activeTab === "小夏") return events.filter((event) => event.agentId === "xia");
    return [];
  }, [activeTab, events]);

  const sendControl = async (action: "pause" | "resume" | "step") => {
    await fetch(`${BACKEND_URL}/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
  };

  const startTask = async (taskId: string) => {
    const trimmed = instruction.trim();
    if (trimmed === "/help") {
      setStatusMessage(helpText);
      return;
    }
    await fetch(`${BACKEND_URL}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, instruction: trimmed })
    });
    setStatusMessage("任务执行中…");
    setEvents([]);
    setWorldEvents([]);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="title">
          <h1>像素协作小剧场</h1>
          <p>输入一句指令，看两位性格迥异的 AI 伙伴在像素世界里边走边聊、分工协作，把任务做成一场实时上演的小剧场。</p>
        </div>
        <div className="controls">
          <input
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="输入指令，或输入 /help"
          />
          <div className="task-buttons">
            {tasks.map((task) => (
              <button key={task.id} onClick={() => startTask(task.id)}>
                {task.title}
              </button>
            ))}
          </div>
          <div className="playback">
            <button onClick={() => sendControl("pause")}>Pause</button>
            <button onClick={() => sendControl("step")}>Step</button>
            <button onClick={() => sendControl("resume")}>Resume</button>
          </div>
          <div className="status">{statusMessage}</div>
        </div>
      </header>

      <main className="main">
        <section className="map-panel">
          <canvas ref={canvasRef} width={640} height={448} />
          <div className="legend">
            <span>Synergy: {world?.synergy ?? 0} ✨</span>
            <span>状态: {world?.status ?? "idle"}</span>
            <span>任务: {world?.taskId ?? "未开始"}</span>
          </div>
        </section>

        <section className="log-panel">
          <div className="tabs">
            {panelTabs.map((tab) => (
              <button key={tab} className={tab === activeTab ? "active" : ""} onClick={() => setActiveTab(tab)}>
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "世界事件" ? (
            <div className="event-list">
              {worldEvents.map((message, index) => (
                <div key={`${message}-${index}`} className="event-card">
                  {message}
                </div>
              ))}
            </div>
          ) : (
            <div className="event-list">
              {filteredEvents.map((event, index) => (
                <div key={`${event.agentId}-${index}`} className={`event-card ${event.agentId}`}>
                  <div className="event-header">
                    <strong>{event.agentId === "lan" ? "阿岚" : "小夏"}</strong>
                    <span>{event.field}</span>
                  </div>
                  {Array.isArray(event.content) ? (
                    <ul>
                      {event.content.map((line, idx) => (
                        <li key={`${line}-${idx}`}>{line}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>{event.content}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <div className="progress">
          <div className="progress-bar" style={{ width: world?.status === "completed" ? "100%" : "45%" }} />
        </div>
        <div className="footer-info">
          <span>开发者信息 Trace ID: {traceId ?? "待生成"}</span>
          <span>说明：所有行动由工具驱动，事件流实时推送。</span>
        </div>
      </footer>
    </div>
  );
}
