import "dotenv/config";
import cors from "cors";
import express from "express";
import http from "http";
import { AgentOrchestrator, initWorld } from "./agents.js";
import { EventBus, ExecutionController } from "./events.js";

const app = express();
const server = http.createServer(app);
const bus = new EventBus(server);
const controller = new ExecutionController();
const world = initWorld();
const orchestrator = new AgentOrchestrator(world, controller, bus);

const PORT = Number(process.env.PORT || 3001);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/tasks", (_req, res) => {
  res.json({ tasks: orchestrator.listTasks() });
});

app.post("/start", async (req, res) => {
  const { taskId, instruction } = req.body as { taskId: string; instruction: string };
  if (!taskId || !instruction) {
    res.status(400).json({ ok: false, error: "缺少任务或指令" });
    return;
  }

  orchestrator.startTask(taskId, instruction).catch((error) => {
    console.error(error);
  });

  res.json({ ok: true, traceId: orchestrator.getTraceId() });
});

app.post("/control", (req, res) => {
  const { action } = req.body as { action: "pause" | "resume" | "step" };
  if (action === "pause") controller.pause();
  if (action === "resume") controller.resume();
  if (action === "step") controller.step();
  res.json({ ok: true });
});

bus.onConnection((socket) => {
  socket.send(JSON.stringify({ type: "world_update", payload: { world } }));
  socket.send(JSON.stringify({ type: "tasks", payload: { tasks: orchestrator.listTasks() } }));
  socket.send(JSON.stringify({ type: "trace", payload: { traceId: orchestrator.getTraceId() } }));
});

server.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
