import type { AgentId } from "./world.js";

export interface TaskStep {
  agent: AgentId;
  thought: string;
  plan: string[];
  observation: string;
  action: string;
  dialogue: string;
  execute: "move" | "talk" | "pickup" | "drop" | "useSwitch";
  target?: { x: number; y: number; id?: string; text?: string };
}

export interface TaskScript {
  id: string;
  title: string;
  description: string;
  steps: TaskStep[];
}

export const tasks: TaskScript[] = [
  {
    id: "task-a",
    title: "新手任务：买苹果送到家",
    description: "去商店买 2 个苹果，送到家门口。",
    steps: [
      {
        agent: "lan",
        thought: "我先把路径和代价算清楚，避开水域。",
        plan: ["去商店附近等待", "确认苹果数量"],
        observation: "商店就在南边。",
        action: "移动到商店",
        dialogue: "别急，先确认条件。",
        execute: "move",
        target: { x: 3, y: 3 }
      },
      {
        agent: "xia",
        thought: "OK！我上！先和店主聊聊。",
        plan: ["到店主身边", "问是否有苹果"],
        observation: "店主正忙着整理货架。",
        action: "移动到店主",
        dialogue: "我去问路～",
        execute: "move",
        target: { x: 3, y: 3 }
      },
      {
        agent: "xia",
        thought: "店主就在旁边，直接开聊。",
        plan: ["询问苹果库存"],
        observation: "店主抬头看过来。",
        action: "与店主对话",
        dialogue: "老板，两颗苹果打包！",
        execute: "talk",
        target: { id: "shopkeeper", text: "请给我两颗苹果。" }
      },
      {
        agent: "xia",
        thought: "苹果就在眼前，直接拿下。",
        plan: ["拾取苹果", "继续取第二个"],
        observation: "桌上有两个苹果。",
        action: "拾取第一个苹果",
        dialogue: "这苹果看起来超新鲜～",
        execute: "pickup",
        target: { id: "apple1" }
      },
      {
        agent: "xia",
        thought: "再拿一个，任务完成一半。",
        plan: ["拾取第二个苹果", "赶去家门口"],
        observation: "还剩一个苹果。",
        action: "拾取第二个苹果",
        dialogue: "第二颗到手！",
        execute: "pickup",
        target: { id: "apple2" }
      },
      {
        agent: "lan",
        thought: "我先去家门口等她。",
        plan: ["移动到家门口", "准备接收苹果"],
        observation: "家门口在东侧。",
        action: "移动到家门口",
        dialogue: "我在门口接应。",
        execute: "move",
        target: { x: 15, y: 5 }
      },
      {
        agent: "xia",
        thought: "送货时间到，我去交付。",
        plan: ["前往家门口", "放下苹果"],
        observation: "阿岚已经等在门口。",
        action: "移动到家门口",
        dialogue: "苹果送达～",
        execute: "move",
        target: { x: 15, y: 5 }
      },
      {
        agent: "xia",
        thought: "把苹果放下就完成。",
        plan: ["放下苹果"],
        observation: "家门口安全。",
        action: "放下苹果",
        dialogue: "任务完成！",
        execute: "drop",
        target: { id: "apple1", x: 15, y: 5 }
      },
      {
        agent: "xia",
        thought: "别漏掉第二个苹果。",
        plan: ["放下第二个苹果"],
        observation: "篮子里还有一个苹果。",
        action: "放下苹果",
        dialogue: "两颗都到位～",
        execute: "drop",
        target: { id: "apple2", x: 15, y: 5 }
      }
    ]
  },
  {
    id: "task-b",
    title: "协作机关：双人拉杆门",
    description: "分头取线索，汇合双人开关门，拿钥匙交给守门人。",
    steps: [
      {
        agent: "lan",
        thought: "我先把路径和代价算清楚。",
        plan: ["去找路人拿线索"],
        observation: "路人在南侧。",
        action: "移动去找路人",
        dialogue: "别急，先确认条件。",
        execute: "move",
        target: { x: 4, y: 11 }
      },
      {
        agent: "xia",
        thought: "OK！我上！去问守门人。",
        plan: ["前往守门人", "确认开门条件"],
        observation: "守门人在门禁区。",
        action: "移动去守门人",
        dialogue: "我去问路～",
        execute: "move",
        target: { x: 12, y: 2 }
      },
      {
        agent: "lan",
        thought: "问完路人就拿线索。",
        plan: ["与路人对话", "拾取线索"],
        observation: "路人正在聊天。",
        action: "与路人对话",
        dialogue: "听说门要双人协作？",
        execute: "talk",
        target: { id: "villager", text: "门需要两人同时踩开关。" }
      },
      {
        agent: "lan",
        thought: "线索卡到手，去集合。",
        plan: ["拾取线索卡", "前往开关"],
        observation: "地上有线索卡。",
        action: "拾取线索卡",
        dialogue: "线索已确认。",
        execute: "pickup",
        target: { id: "clue" }
      },
      {
        agent: "xia",
        thought: "守门人确认需要两人。",
        plan: ["返回双人开关"],
        observation: "守门人点头示意。",
        action: "移动到开关",
        dialogue: "双人开关？我懂了！",
        execute: "move",
        target: { x: 4, y: 7 }
      },
      {
        agent: "lan",
        thought: "我要踩住另一个开关。",
        plan: ["到达开关", "启动机关"],
        observation: "开关就在脚下。",
        action: "移动到开关",
        dialogue: "我踩住了。",
        execute: "move",
        target: { x: 5, y: 7 }
      },
      {
        agent: "lan",
        thought: "确认站稳，启动拉杆。",
        plan: ["启动开关", "等待小夏配合"],
        observation: "另一侧还有一个开关。",
        action: "启动开关",
        dialogue: "我这边也好了。",
        execute: "useSwitch",
        target: { id: "switchB" }
      },
      {
        agent: "xia",
        thought: "一起启动门，关键步骤。",
        plan: ["拉下开关", "确认门打开"],
        observation: "阿岚已就位。",
        action: "启动开关",
        dialogue: "一起！",
        execute: "useSwitch",
        target: { id: "switchA" }
      },
      {
        agent: "lan",
        thought: "门已开，拿钥匙。",
        plan: ["进入门禁区", "拾取钥匙"],
        observation: "门禁区已解锁。",
        action: "移动到钥匙",
        dialogue: "我去取钥匙。",
        execute: "move",
        target: { x: 13, y: 3 }
      },
      {
        agent: "lan",
        thought: "钥匙就在脚边。",
        plan: ["拾取钥匙"],
        observation: "看到钥匙了。",
        action: "拾取钥匙",
        dialogue: "钥匙到手。",
        execute: "pickup",
        target: { id: "key" }
      },
      {
        agent: "lan",
        thought: "交钥匙给守门人。",
        plan: ["前往守门人", "交付钥匙"],
        observation: "守门人在门旁。",
        action: "与守门人对话",
        dialogue: "钥匙在此。",
        execute: "talk",
        target: { id: "guard", text: "我们拿到钥匙了。" }
      }
    ]
  },
  {
    id: "task-c",
    title: "轻喜剧：找走失的小猫",
    description: "沿着脚印找到小猫并带回家门口。",
    steps: [
      {
        agent: "xia",
        thought: "这 NPC 绝对藏话，我去问路～",
        plan: ["找路人问线索"],
        observation: "路人就在南边。",
        action: "与路人对话",
        dialogue: "小猫去哪啦？",
        execute: "talk",
        target: { id: "villager", text: "你看到小猫了吗？" }
      },
      {
        agent: "lan",
        thought: "我先把路径和代价算清楚，沿脚印。",
        plan: ["前往脚印区域", "确认小猫位置"],
        observation: "脚印指向东侧。",
        action: "移动到脚印",
        dialogue: "我先勘察脚印。",
        execute: "move",
        target: { x: 8, y: 8 }
      },
      {
        agent: "xia",
        thought: "OK！我上！去找小猫。",
        plan: ["前往小猫", "安抚它"],
        observation: "小猫在东南角。",
        action: "移动到小猫",
        dialogue: "小猫别跑～",
        execute: "move",
        target: { x: 10, y: 11 }
      },
      {
        agent: "xia",
        thought: "先聊聊，拉近距离。",
        plan: ["对话安抚"],
        observation: "小猫有点紧张。",
        action: "与小猫对话",
        dialogue: "乖乖跟我回家～",
        execute: "talk",
        target: { id: "cat", text: "跟我们走吧。" }
      },
      {
        agent: "lan",
        thought: "我在家门口接应，确保交付。",
        plan: ["返回家门口"],
        observation: "家门口安全。",
        action: "移动到家门口",
        dialogue: "我在门口等你。",
        execute: "move",
        target: { x: 15, y: 5 }
      },
      {
        agent: "xia",
        thought: "带小猫回家，别走丢。",
        plan: ["回到家门口"],
        observation: "阿岚已到家门口。",
        action: "移动到家门口",
        dialogue: "小猫跟上啦！",
        execute: "move",
        target: { x: 15, y: 5 }
      }
    ]
  }
];

export function getTaskScript(taskId: string) {
  return tasks.find((task) => task.id === taskId);
}
