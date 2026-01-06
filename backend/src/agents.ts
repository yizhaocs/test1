import { Agent, tool, run, withTracing } from "openai/agents";
import type { EventBus } from "./events.js";
import { delay, ExecutionController } from "./events.js";
import { findPath } from "./pathfinding.js";
import {
  createWorld,
  isWalkable,
  itemAt,
  npcAt,
  resetWorld,
  setDoorState,
  switchAt,
  tileLabel,
  type AgentId,
  type WorldState
} from "./world.js";
import { getTaskScript, tasks } from "./tasks.js";

const STEP_DELAY_MS = 190;

export class AgentOrchestrator {
  private world: WorldState;
  private controller: ExecutionController;
  private bus: EventBus;
  private traceId: string | null = null;

  constructor(world: WorldState, controller: ExecutionController, bus: EventBus) {
    this.world = world;
    this.controller = controller;
    this.bus = bus;
  }

  getTraceId() {
    return this.traceId;
  }

  listTasks() {
    return tasks.map((task) => ({ id: task.id, title: task.title, description: task.description }));
  }

  async startTask(taskId: string, instruction: string) {
    const script = getTaskScript(taskId);
    if (!script) {
      throw new Error("未知任务");
    }

    resetWorld(this.world);
    this.world.taskId = taskId;
    this.world.status = "running";
    this.emitWorld();

    // 没有 API Key 时，使用脚本化 Demo 保证可运行。
    const useMock = process.env.USE_MOCK_AGENT === "1" || !process.env.OPENAI_API_KEY;
    if (useMock) {
      this.traceId = `mock_${Date.now()}`;
      this.bus.broadcast({ type: "trace", payload: { traceId: this.traceId } });
      console.log(`[trace] mock trace id: ${this.traceId}`);
      await this.runScriptedTask(script, instruction);
      this.world.status = "completed";
      this.emitWorld();
      return;
    }

    const lan = new Agent({
      name: "Lan",
      instructions:
        "你是阿岚（冷静理性、策略控）。回答要简短。不要输出长篇推理链，只输出摘要、计划、观察、动作、对话。"
    });
    const xia = new Agent({
      name: "Xia",
      instructions:
        "你是小夏（乐观行动派、爱吐槽）。回答要简短。不要输出长篇推理链，只输出摘要、计划、观察、动作、对话。"
    });

    // Agents 只能通过工具改变世界状态。
    const tools = this.buildTools();
    lan.tools = tools;
    xia.tools = tools;

    const tracer = withTracing?.();
    this.traceId = tracer?.trace_id ?? `trace_${Date.now()}`;
    this.bus.broadcast({ type: "trace", payload: { traceId: this.traceId } });
    console.log(`[trace] ${this.traceId}`);

    const taskPrompt = `用户指令：${instruction}\n\n任务提示：${script.description}\n请你和另一位 agent 协作完成。每次行动请调用工具。`;

    await Promise.all([
      run(lan, { input: taskPrompt, stream: true }),
      run(xia, { input: taskPrompt, stream: true })
    ]);

    this.world.status = "completed";
    this.emitWorld();
  }

  private buildTools() {
    return [
      tool({
        name: "move",
        description: "让指定角色移动到坐标",
        parameters: {
          type: "object",
          properties: {
            agentId: { type: "string" },
            toX: { type: "number" },
            toY: { type: "number" }
          },
          required: ["agentId", "toX", "toY"]
        },
        execute: async ({ agentId, toX, toY }: { agentId: AgentId; toX: number; toY: number }) => {
          await this.moveAgent(agentId, toX, toY);
          return { ok: true };
        }
      }),
      tool({
        name: "inspect",
        description: "查看附近情况",
        parameters: {
          type: "object",
          properties: { agentId: { type: "string" } },
          required: ["agentId"]
        },
        execute: async ({ agentId }: { agentId: AgentId }) => {
          const agent = this.world.agents[agentId];
          const tile = this.world.tiles[agent.y][agent.x];
          return {
            tile: tileLabel(tile),
            nearbyNPC: npcAt(this.world, agent.x, agent.y)?.name ?? null,
            nearbyItem: itemAt(this.world, agent.x, agent.y)?.name ?? null
          };
        }
      }),
      tool({
        name: "talk",
        description: "与 NPC 对话",
        parameters: {
          type: "object",
          properties: {
            agentId: { type: "string" },
            npcId: { type: "string" },
            text: { type: "string" }
          },
          required: ["agentId", "npcId", "text"]
        },
        execute: async ({ agentId, npcId, text }: { agentId: AgentId; npcId: string; text: string }) => {
          const npc = this.world.npcs[npcId];
          if (!npc) return { ok: false };
          this.emitUIEvent(agentId, "Action", `与${npc.name}对话`);
          this.emitUIEvent(agentId, "Dialogue", text);
          const reply = npc.dialog[Math.floor(Math.random() * npc.dialog.length)];
          this.emitUIEvent(agentId, "Observation", `${npc.name}回应：${reply}`);
          return { reply };
        }
      }),
      tool({
        name: "pickup",
        description: "拾取物品",
        parameters: {
          type: "object",
          properties: {
            agentId: { type: "string" },
            itemId: { type: "string" }
          },
          required: ["agentId", "itemId"]
        },
        execute: async ({ agentId, itemId }: { agentId: AgentId; itemId: string }) => {
          const item = this.world.items[itemId];
          if (!item || item.picked) return { ok: false };
          item.picked = true;
          this.world.agents[agentId].inventory.push(itemId);
          this.emitWorld();
          this.emitUIEvent(agentId, "Action", `拾取${item.name}`);
          return { ok: true };
        }
      }),
      tool({
        name: "drop",
        description: "放置物品",
        parameters: {
          type: "object",
          properties: {
            agentId: { type: "string" },
            itemId: { type: "string" },
            x: { type: "number" },
            y: { type: "number" }
          },
          required: ["agentId", "itemId", "x", "y"]
        },
        execute: async ({ agentId, itemId, x, y }: { agentId: AgentId; itemId: string; x: number; y: number }) => {
          const item = this.world.items[itemId];
          if (!item) return { ok: false };
          item.picked = false;
          item.x = x;
          item.y = y;
          this.world.agents[agentId].inventory = this.world.agents[agentId].inventory.filter(
            (id) => id !== itemId
          );
          this.emitWorld();
          this.emitUIEvent(agentId, "Action", `放下${item.name}`);
          return { ok: true };
        }
      }),
      tool({
        name: "useSwitch",
        description: "启动双人开关",
        parameters: {
          type: "object",
          properties: {
            agentId: { type: "string" },
            switchId: { type: "string" }
          },
          required: ["agentId", "switchId"]
        },
        execute: async ({ agentId, switchId }: { agentId: AgentId; switchId: string }) => {
          const sw = this.world.switches[switchId];
          if (!sw) return { ok: false };
          sw.pressedBy = agentId;
          setDoorState(this.world);
          if (this.world.door.open) {
            this.world.synergy += 1;
            this.emitUIEvent(agentId, "Observation", "双人开关启动，门已打开！");
          }
          this.emitWorld();
          return { ok: true };
        }
      }),
      tool({
        name: "emitUIEvent",
        description: "推送 UI 面板事件",
        parameters: {
          type: "object",
          properties: {
            agentId: { type: "string" },
            field: { type: "string" },
            content: { type: "string" }
          },
          required: ["agentId", "field", "content"]
        },
        execute: async ({ agentId, field, content }: { agentId: AgentId; field: string; content: string }) => {
          this.emitUIEvent(agentId, field, content);
          return { ok: true };
        }
      })
    ];
  }

  async runScriptedTask(script: ReturnType<typeof getTaskScript> & { steps: any[] }, instruction: string) {
    this.emitSystemEvent(`任务开始：${script.title}`);
    this.emitSystemEvent(`用户指令：${instruction}`);

    for (const step of script.steps) {
      const agentId = step.agent as AgentId;
      this.emitUIEvent(agentId, "ThoughtSummary", step.thought);
      this.emitUIEvent(agentId, "Plan", step.plan);
      this.emitUIEvent(agentId, "Observation", step.observation);
      this.emitUIEvent(agentId, "Action", step.action);
      this.emitUIEvent(agentId, "Dialogue", step.dialogue);

      switch (step.execute) {
        case "move":
          await this.moveAgent(agentId, step.target.x, step.target.y);
          break;
        case "talk":
          await this.talk(agentId, step.target.id, step.target.text);
          break;
        case "pickup":
          await this.pickup(agentId, step.target.id);
          break;
        case "drop":
          await this.drop(agentId, step.target.id, step.target.x, step.target.y);
          break;
        case "useSwitch":
          await this.useSwitch(agentId, step.target.id);
          break;
        default:
          break;
      }
    }
  }

  private async moveAgent(agentId: AgentId, toX: number, toY: number) {
    if (!isWalkable(this.world, toX, toY)) return;
    const agent = this.world.agents[agentId];
    const path = findPath(this.world, agent.x, agent.y, toX, toY);
    for (const step of path.slice(1)) {
      await this.controller.wait(STEP_DELAY_MS);
      agent.x = step.x;
      agent.y = step.y;
      const tile = this.world.tiles[agent.y][agent.x];
      this.emitWorld();
      this.emitUIEvent(agentId, "Observation", `走到${tileLabel(tile)}(${agent.x},${agent.y})`);
    }
  }

  private async talk(agentId: AgentId, npcId: string, text: string) {
    const npc = this.world.npcs[npcId];
    if (!npc) return;
    this.emitUIEvent(agentId, "Action", `与${npc.name}对话`);
    this.emitUIEvent(agentId, "Dialogue", text);
    await delay(200);
    this.emitUIEvent(agentId, "Observation", `${npc.name}回应：${npc.dialog[0]}`);
  }

  private async pickup(agentId: AgentId, itemId: string) {
    const item = this.world.items[itemId];
    if (!item || item.picked) return;
    item.picked = true;
    this.world.agents[agentId].inventory.push(itemId);
    this.emitWorld();
    this.emitUIEvent(agentId, "Action", `拾取${item.name}`);
  }

  private async drop(agentId: AgentId, itemId: string, x: number, y: number) {
    const item = this.world.items[itemId];
    if (!item) return;
    item.picked = false;
    item.x = x;
    item.y = y;
    this.world.agents[agentId].inventory = this.world.agents[agentId].inventory.filter((id) => id !== itemId);
    this.emitWorld();
    this.emitUIEvent(agentId, "Action", `放下${item.name}`);
  }

  private async useSwitch(agentId: AgentId, switchId: string) {
    const sw = this.world.switches[switchId];
    if (!sw) return;
    sw.pressedBy = agentId;
    setDoorState(this.world);
    if (this.world.door.open) {
      this.world.synergy += 1;
      this.emitUIEvent(agentId, "Observation", "双人开关启动，门已打开！");
    }
    this.emitWorld();
  }

  emitWorld() {
    this.bus.broadcast({
      type: "world_update",
      payload: {
        world: this.world
      }
    });
  }

  emitSystemEvent(message: string) {
    this.bus.broadcast({
      type: "system",
      payload: { message }
    });
  }

  emitUIEvent(agentId: AgentId, field: string, content: string | string[]) {
    this.bus.broadcast({
      type: "ui_event",
      payload: {
        agentId,
        field,
        content
      }
    });
  }
}

export function initWorld() {
  return createWorld();
}
