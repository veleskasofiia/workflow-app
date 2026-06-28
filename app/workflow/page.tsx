"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type Edge,
  type EdgeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import FlowChat from "../../components/FlowChat";
import { supabase } from "../../lib/supabaseClient";
import NavBar from "../../components/NavBar";

// ─── App catalogue ───────────────────────────────────────────────────────────

type AppEntry = {
  key: string;
  label: string;
  icon: string;
  color: string;
  category: "trigger" | "action";
  desc: string;
};

const PALETTE: AppEntry[] = [
  { key: "webhook",  label: "Webhook",         icon: "⚡", color: "#f59e0b", category: "trigger", desc: "Starts the flow on any HTTP event" },
  { key: "gmail",    label: "Gmail",            icon: "📧", color: "#ea4335", category: "action",  desc: "Read, send & label emails" },
  { key: "outlook",  label: "Outlook Mail",     icon: "📨", color: "#0078d4", category: "action",  desc: "Fetch & send Outlook messages" },
  { key: "ocal",     label: "Outlook Calendar", icon: "📆", color: "#0f6cbd", category: "action",  desc: "Read & create calendar events" },
  { key: "calendar", label: "Google Calendar",  icon: "📅", color: "#4285f4", category: "action",  desc: "List & create Google events" },
  { key: "gdrive",   label: "Google Drive",     icon: "📁", color: "#34a853", category: "action",  desc: "Upload, read & manage files" },
  { key: "tracker",  label: "Tracker",          icon: "📋", color: "#6366f1", category: "action",  desc: "Read today's tasks & habits from FlowBoard" },
  { key: "budget",   label: "Budget",           icon: "💰", color: "#10b981", category: "action",  desc: "Get this month's income, expenses & balance" },
  { key: "notify",   label: "Notify",            icon: "🔔", color: "#8b5cf6", category: "action",  desc: "Send an in-app notification to the user" },
  { key: "ifelse",   label: "IF Condition",      icon: "🔀", color: "#6b7280", category: "action",  desc: "Branch flow based on a condition" },
];

const PALETTE_BY_KEY = Object.fromEntries(PALETTE.map((a) => [a.key, a]));

// ─── Templates ───────────────────────────────────────────────────────────────

type Template = { id: string; name: string; emoji: string; desc: string; nodes: Node[]; edges: Edge[] };

const TEMPLATES: Template[] = [
  {
    id: "email-outlook",
    name: "Gmail → Outlook",
    emoji: "📧",
    desc: "Fetch unread Gmail emails and forward a digest via Outlook",
    nodes: [
      { id: "t1", type: "appNode", position: { x: 80,  y: 200 }, data: { ...PALETTE_BY_KEY["webhook"] } },
      { id: "t2", type: "appNode", position: { x: 340, y: 200 }, data: { ...PALETTE_BY_KEY["gmail"],   note: "Fetch unread emails" } },
      { id: "t3", type: "appNode", position: { x: 600, y: 200 }, data: { ...PALETTE_BY_KEY["outlook"], note: "Forward digest" } },
    ],
    edges: [
      { id: "te1", source: "t1", target: "t2", type: "deletable", animated: true, style: { stroke: "#f59e0b", strokeWidth: 2.5 }, data: { color: "#f59e0b" } },
      { id: "te2", source: "t2", target: "t3", type: "deletable", animated: true, style: { stroke: "#ea4335", strokeWidth: 2.5 }, data: { color: "#ea4335" } },
    ],
  },
  {
    id: "calendar-digest",
    name: "Calendar Digest",
    emoji: "📅",
    desc: "Get today's schedule and email yourself a summary",
    nodes: [
      { id: "t1", type: "appNode", position: { x: 80,  y: 200 }, data: { ...PALETTE_BY_KEY["webhook"]  } },
      { id: "t2", type: "appNode", position: { x: 340, y: 200 }, data: { ...PALETTE_BY_KEY["calendar"], note: "Get today's events" } },
      { id: "t3", type: "appNode", position: { x: 600, y: 200 }, data: { ...PALETTE_BY_KEY["gmail"],    note: "Send daily digest" } },
    ],
    edges: [
      { id: "te1", source: "t1", target: "t2", type: "deletable", animated: true, style: { stroke: "#f59e0b", strokeWidth: 2.5 }, data: { color: "#f59e0b" } },
      { id: "te2", source: "t2", target: "t3", type: "deletable", animated: true, style: { stroke: "#4285f4", strokeWidth: 2.5 }, data: { color: "#4285f4" } },
    ],
  },
  {
    id: "morning-routine",
    name: "Morning Routine",
    emoji: "📋",
    desc: "Fetch today's tasks from Tracker and email yourself a morning briefing",
    nodes: [
      { id: "t1", type: "appNode", position: { x: 80,  y: 200 }, data: { ...PALETTE_BY_KEY["webhook"]  } },
      { id: "t2", type: "appNode", position: { x: 340, y: 200 }, data: { ...PALETTE_BY_KEY["tracker"], note: "Get today's tasks" } },
      { id: "t3", type: "appNode", position: { x: 600, y: 200 }, data: { ...PALETTE_BY_KEY["gmail"],   note: "Send morning briefing" } },
    ],
    edges: [
      { id: "te1", source: "t1", target: "t2", type: "deletable", animated: true, style: { stroke: "#f59e0b", strokeWidth: 2.5 }, data: { color: "#f59e0b" } },
      { id: "te2", source: "t2", target: "t3", type: "deletable", animated: true, style: { stroke: "#6366f1", strokeWidth: 2.5 }, data: { color: "#6366f1" } },
    ],
  },
  {
    id: "budget-summary",
    name: "Budget Summary",
    emoji: "💰",
    desc: "Get your monthly budget summary and send it to Gmail",
    nodes: [
      { id: "t1", type: "appNode", position: { x: 80,  y: 200 }, data: { ...PALETTE_BY_KEY["webhook"] } },
      { id: "t2", type: "appNode", position: { x: 340, y: 200 }, data: { ...PALETTE_BY_KEY["budget"],  note: "Get monthly summary" } },
      { id: "t3", type: "appNode", position: { x: 600, y: 200 }, data: { ...PALETTE_BY_KEY["gmail"],   note: "Email the report" } },
    ],
    edges: [
      { id: "te1", source: "t1", target: "t2", type: "deletable", animated: true, style: { stroke: "#f59e0b", strokeWidth: 2.5 }, data: { color: "#f59e0b" } },
      { id: "te2", source: "t2", target: "t3", type: "deletable", animated: true, style: { stroke: "#10b981", strokeWidth: 2.5 }, data: { color: "#10b981" } },
    ],
  },
  {
    id: "filter-outlook",
    name: "Filter → Outlook",
    emoji: "🔀",
    desc: "Filter important Gmail emails and forward them via Outlook",
    nodes: [
      { id: "t1", type: "appNode", position: { x: 60,  y: 200 }, data: { ...PALETTE_BY_KEY["webhook"] } },
      { id: "t2", type: "appNode", position: { x: 300, y: 200 }, data: { ...PALETTE_BY_KEY["gmail"],   note: "Fetch emails" } },
      { id: "t3", type: "appNode", position: { x: 540, y: 200 }, data: { ...PALETTE_BY_KEY["ifelse"],  condition: "Is it important?" } },
      { id: "t4", type: "appNode", position: { x: 780, y: 140 }, data: { ...PALETTE_BY_KEY["outlook"], note: "Forward to inbox" } },
    ],
    edges: [
      { id: "te1", source: "t1", target: "t2", type: "deletable", animated: true, style: { stroke: "#f59e0b", strokeWidth: 2.5 }, data: { color: "#f59e0b" } },
      { id: "te2", source: "t2", target: "t3", type: "deletable", animated: true, style: { stroke: "#ea4335", strokeWidth: 2.5 }, data: { color: "#ea4335" } },
      { id: "te3", source: "t3", target: "t4", type: "deletable", animated: true, style: { stroke: "#6b7280", strokeWidth: 2.5 }, data: { color: "#6b7280" } },
    ],
  },
];

// ─── Custom node ─────────────────────────────────────────────────────────────

type AppNodeData = {
  label: string; icon: string; color: string;
  category: "trigger" | "action";
  desc?: string; condition?: string; note?: string;
};

function AppNode({ data, selected, id }: { data: AppNodeData; selected: boolean; id: string }) {
  const { setNodes } = useReactFlow();
  const isIf = data.label === "IF Condition";
  const hasInput = isIf ? !!(data.condition?.trim()) : !!(data.note?.trim());
  const isReady = data.category === "trigger" || hasInput;

  function updateField(field: "condition" | "note", value: string) {
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n));
  }

  return (
    <div style={{
      background: "white",
      borderRadius: 12,
      border: `2px solid ${selected ? data.color : "#e2e8f0"}`,
      boxShadow: selected
        ? `0 0 0 3px ${data.color}33, 0 4px 16px rgba(0,0,0,0.14)`
        : "0 2px 10px rgba(0,0,0,0.08)",
      minWidth: 220,
      overflow: "hidden",
      fontFamily: "system-ui, sans-serif",
      transition: "border 0.15s, box-shadow 0.15s",
    }}>
      <Handle type="target" position={Position.Left}
        style={{ background: data.color, width: 10, height: 10, border: "2px solid white" }} />

      {/* Coloured header */}
      <div style={{
        background: `linear-gradient(135deg, ${data.color} 0%, ${data.color}cc 100%)`,
        padding: "10px 14px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: "1.55rem", lineHeight: 1, flexShrink: 0 }}>{data.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "white", lineHeight: 1.2 }}>{data.label}</div>
          <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.72)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2 }}>
            {data.category}
          </div>
        </div>
        {/* Status badge */}
        <div style={{
          background: isReady ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.18)",
          borderRadius: 20, padding: "2px 8px",
          fontSize: "0.62rem", color: "white", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
        }}>
          {isReady ? "✓ Ready" : "⚙ Setup"}
        </div>
      </div>

      {/* Description */}
      {data.desc && (
        <div style={{ padding: "7px 14px 3px", fontSize: "0.72rem", color: "#64748b", lineHeight: 1.4 }}>
          {data.desc}
        </div>
      )}

      {/* IF Condition input */}
      {isIf && (
        <div style={{ padding: "5px 10px 10px" }}>
          <div style={{ fontSize: "0.64rem", color: "#6b7280", marginBottom: 3, fontWeight: 700, textTransform: "uppercase" }}>Condition</div>
          <input
            className="nodrag"
            style={{ width: "100%", fontSize: "0.78rem", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 7px", color: "#1e293b", outline: "none", boxSizing: "border-box" }}
            placeholder="e.g. Is it marked important?"
            value={data.condition ?? ""}
            onChange={(e) => updateField("condition", e.target.value)}
          />
          <div style={{ fontSize: "0.63rem", color: "#94a3b8", marginTop: 4 }}>
            ✅ True → top &nbsp;|&nbsp; ❌ False → bottom
          </div>
        </div>
      )}

      {/* Note field */}
      {!isIf && (
        <div style={{ padding: "4px 10px 10px" }}>
          <input
            className="nodrag"
            style={{ width: "100%", fontSize: "0.75rem", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 7px", color: "#64748b", outline: "none", boxSizing: "border-box" }}
            placeholder="Add a note…"
            value={data.note ?? ""}
            onChange={(e) => updateField("note", e.target.value)}
          />
        </div>
      )}

      <Handle type="source" position={Position.Right}
        style={{ background: data.color, width: 10, height: 10, border: "2px solid white" }} />
    </div>
  );
}

const nodeTypes: NodeTypes = { appNode: AppNode };

// ─── Animated edge with flowing dot ──────────────────────────────────────────

function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, data }: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const dotColor = (data as { color?: string })?.color ?? "#94a3b8";

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />

      {/* Flowing dot along the edge */}
      <circle r="5" fill={dotColor} opacity="0.9"
        style={{ filter: `drop-shadow(0 0 4px ${dotColor})` }}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <animateMotion dur="7s" repeatCount="indefinite" path={edgePath} {...({} as any)} />
      </circle>

      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{ position: "absolute", transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`, pointerEvents: "all" }}
        >
          <button className="edge-delete-btn"
            onClick={() => setEdges((eds) => eds.filter((e) => e.id !== id))}
            title="Remove connection">×</button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

const edgeTypes: EdgeTypes = { deletable: DeletableEdge };

const DEFAULT_NODES: Node[] = [
  { id: "1", type: "appNode", position: { x: 160, y: 180 }, data: { ...PALETTE_BY_KEY["webhook"] } },
  { id: "2", type: "appNode", position: { x: 440, y: 180 }, data: { ...PALETTE_BY_KEY["gmail"]   } },
];

const DEFAULT_EDGES: Edge[] = [
  { id: "e1-2", source: "1", target: "2", type: "deletable", animated: true,
    style: { stroke: "#f59e0b", strokeWidth: 2.5 }, data: { color: "#f59e0b" } },
];

const STORAGE_KEY = "flowboard_canvas";

const REMOVED_APPS = new Set(["slack", "notion", "discord"]);

function loadCanvas() {
  if (typeof window === "undefined") return { nodes: DEFAULT_NODES, edges: DEFAULT_EDGES };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { nodes: DEFAULT_NODES, edges: DEFAULT_EDGES };
    const parsed = JSON.parse(saved);
    // Strip out removed apps from saved canvas
    const removedIds = new Set<string>();
    parsed.nodes = (parsed.nodes ?? []).filter((n: Node) => {
      const label = String((n.data as Record<string, unknown>)?.label ?? "").toLowerCase();
      if (REMOVED_APPS.has(label)) { removedIds.add(n.id); return false; }
      return true;
    });
    parsed.edges = (parsed.edges ?? [])
      .filter((e: Edge) => !removedIds.has(e.source) && !removedIds.has(e.target))
      .map((e: Edge) => ({ ...e, type: "deletable" }));
    return parsed;
  } catch {
    return { nodes: DEFAULT_NODES, edges: DEFAULT_EDGES };
  }
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

function WorkflowCanvas({
  nodesRef, edgesRef, saveTrigger, onSaveComplete, loadTemplateRef,
}: {
  nodesRef: React.MutableRefObject<Node[]>;
  edgesRef: React.MutableRefObject<Edge[]>;
  saveTrigger: number;
  onSaveComplete: (ok: boolean) => void;
  loadTemplateRef: React.MutableRefObject<((n: Node[], e: Edge[]) => void) | null>;
}) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const saved = loadCanvas();
  const [nodes, setNodes, onNodesChange] = useNodesState(saved.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(saved.edges);

  // Register template loader
  useEffect(() => {
    loadTemplateRef.current = (newNodes, newEdges) => {
      setNodes(newNodes);
      setEdges(newEdges);
    };
  }, [setNodes, setEdges, loadTemplateRef]);

  // Sync refs + auto-save
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  // Load from Supabase on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("workflows").select("nodes, edges").eq("user_id", user.id).maybeSingle()
        .then(({ data }) => {
          if (data) {
            const removedIds = new Set<string>();
            const filteredNodes = (data.nodes ?? []).filter((n: Node) => {
              const label = String((n.data as Record<string, unknown>)?.label ?? "").toLowerCase();
              if (REMOVED_APPS.has(label)) { removedIds.add(n.id); return false; }
              return true;
            });
            setNodes(filteredNodes);
            setEdges((data.edges ?? [])
              .filter((e: Edge) => !removedIds.has(e.source) && !removedIds.has(e.target))
              .map((e: Edge) => ({ ...e, type: "deletable" })));
          }
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save to Supabase
  useEffect(() => {
    if (saveTrigger === 0) return;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { onSaveComplete(false); return; }
      const { error } = await supabase.from("workflows").upsert(
        { user_id: user.id, nodes: nodesRef.current, edges: edgesRef.current, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      onSaveComplete(!error);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveTrigger]);

  // Color edge from source node color
  const onConnect = useCallback(
    (params: Connection) => {
      const srcNode = nodes.find((n) => n.id === params.source);
      const color = (srcNode?.data as AppNodeData)?.color ?? "#94a3b8";
      setEdges((eds) => addEdge({
        ...params, type: "deletable", animated: true,
        style: { stroke: color, strokeWidth: 2.5 },
        data: { color },
      }, eds));
    },
    [setEdges, nodes]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const key = e.dataTransfer.getData("application/flowboard");
    const app = PALETTE_BY_KEY[key];
    if (!app) return;
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    setNodes((prev) => [...prev, { id: `${key}-${Date.now()}`, type: "appNode", position, data: { ...app } }]);
  }, [screenToFlowPosition, setNodes]);

  return (
    <div ref={reactFlowWrapper} style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes} edges={edges}
        nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onConnect={onConnect} onDrop={onDrop} onDragOver={onDragOver}
        defaultEdgeOptions={{ type: "deletable", animated: true, style: { stroke: "#94a3b8", strokeWidth: 2.5 } }}
        fitView fitViewOptions={{ padding: 0.3 }} deleteKeyCode="Backspace"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
        <Controls style={{ bottom: 24, left: 16 }} />
        <MiniMap nodeColor={(n) => (n.data as AppNodeData).color} style={{ bottom: 24, right: 16, borderRadius: 8 }} />
      </ReactFlow>
    </div>
  );
}

// ─── Palette sidebar ──────────────────────────────────────────────────────────

function PaletteSidebar({ onLoadTemplate }: { onLoadTemplate: (n: Node[], e: Edge[]) => void }) {
  const triggers = PALETTE.filter((a) => a.category === "trigger");
  const actions  = PALETTE.filter((a) => a.category === "action");

  const onDragStart = (e: React.DragEvent, key: string) => {
    e.dataTransfer.setData("application/flowboard", key);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="palette-sidebar">
      <div className="palette-search-wrap">
        <input className="palette-search" placeholder="🔍  Search nodes…" />
      </div>

      {/* Templates */}
      <div className="palette-group">
        <h3 className="palette-group-title">Templates</h3>
        {TEMPLATES.map((t) => (
          <button key={t.id} className="palette-template-btn"
            onClick={() => onLoadTemplate(t.nodes, t.edges)}>
            <span className="palette-template-emoji">{t.emoji}</span>
            <span className="palette-template-info">
              <span className="palette-template-name">{t.name}</span>
              <span className="palette-template-desc">{t.desc}</span>
            </span>
          </button>
        ))}
      </div>

      <PaletteGroup title="Triggers" items={triggers} onDragStart={onDragStart} />
      <PaletteGroup title="Actions"  items={actions}  onDragStart={onDragStart} />

      <p className="palette-hint">Drag a node onto the canvas to add it.</p>
    </aside>
  );
}

function PaletteGroup({ title, items, onDragStart }: {
  title: string; items: AppEntry[];
  onDragStart: (e: React.DragEvent, key: string) => void;
}) {
  return (
    <div className="palette-group">
      <h3 className="palette-group-title">{title}</h3>
      {items.map((app) => (
        <div key={app.key} className="palette-item" draggable
          onDragStart={(e) => onDragStart(e, app.key)}
          style={{ borderLeft: `3px solid ${app.color}` }}>
          <span className="palette-item-icon">{app.icon}</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span className="palette-item-label">{app.label}</span>
            <span className="palette-item-desc">{app.desc}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type RunRecord = { id: number; result: string; nodes: string[]; ts: string };

export default function ConnectedAppsPage() {
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const loadTemplateRef = useRef<((n: Node[], e: Edge[]) => void) | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [saveTrigger, setSaveTrigger] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [authChecked, setAuthChecked] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/auth/signup"); return; }
      setAuthChecked(true);
    });
  }, [router]);

  if (!authChecked) return null;

  function handleSave() { setSaveStatus("saving"); setSaveTrigger((t) => t + 1); }
  function handleSaveComplete(ok: boolean) {
    setSaveStatus(ok ? "saved" : "error");
    setTimeout(() => setSaveStatus("idle"), 2500);
  }

  async function handleRun() {
    setRunning(true); setRunResult(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      const entityId = user?.id ?? "default";
      const accessToken = session?.access_token ?? "";
      const payload = nodesRef.current.map((n) => ({
        label: (n.data as AppNodeData).label,
        category: (n.data as AppNodeData).category,
      }));
      const res = await fetch("/api/run", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes: payload, entityId, accessToken }),
      });
      const data = await res.json();
      const result: string = data.result ?? "Workflow ran.";
      setRunResult(result);
      const prev: RunRecord[] = JSON.parse(localStorage.getItem("flowboard_runs") || "[]");
      prev.unshift({ id: Date.now(), result, nodes: payload.map((n) => n.label), ts: new Date().toISOString() });
      localStorage.setItem("flowboard_runs", JSON.stringify(prev.slice(0, 10)));
    } catch {
      setRunResult("Run failed. Please try again.");
    }
    setRunning(false);
  }

  return (
    <div className="workflow-page">
      <NavBar />

      <div className="workflow-toolbar">
        <span className="topbar-title">My Workflow</span>
        <div className="topbar-actions">
          <button className="topbar-btn run-btn" onClick={handleRun} disabled={running}>
            {running ? "⏳ Running…" : "▶ Run"}
          </button>
          <button className="topbar-btn save-btn" onClick={handleSave} disabled={saveStatus === "saving"}>
            {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Saved" : saveStatus === "error" ? "⚠ Sign in to save" : "💾 Save"}
          </button>
        </div>
      </div>

      {runResult && (
        <div className="run-result-banner">
          <div className="run-result-inner">
            <span className="run-result-title">✅ Workflow Result</span>
            <button className="run-result-close" onClick={() => setRunResult(null)}>✕</button>
          </div>
          <pre className="run-result-body">{runResult}</pre>
        </div>
      )}

      <div className="workflow-body">
        <PaletteSidebar onLoadTemplate={(n, e) => loadTemplateRef.current?.(n, e)} />

        <div className="canvas-area">
          <ReactFlowProvider>
            <WorkflowCanvas
              nodesRef={nodesRef} edgesRef={edgesRef}
              saveTrigger={saveTrigger} onSaveComplete={handleSaveComplete}
              loadTemplateRef={loadTemplateRef}
            />
          </ReactFlowProvider>
        </div>

        <div className="chat-sidebar">
          <FlowChat />
        </div>
      </div>
    </div>
  );
}
