import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const NODE_TO_APP: Record<string, string> = {
  "gmail": "gmail",
  "google calendar": "googlecalendar",
  "google drive": "googledrive",
  "outlook": "outlook",
  "outlook mail": "outlook",
  "outlook calendar": "outlook",
};

function stripPatterns(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(stripPatterns);
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k === "pattern") continue;
      out[k] = stripPatterns(v);
    }
    return out;
  }
  return obj;
}

async function sendNotification(userId: string, accessToken: string, title: string, body: string) {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );
    await sb.from("notifications").insert({ user_id: userId, title, body: body.slice(0, 500), read: false, source: "workflow" });
  } catch { /* silent */ }
}

async function fetchTrackerContext(userId: string, accessToken: string): Promise<string> {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );
    const today = new Date().toISOString().slice(0, 10);
    const { data: tasks } = await sb.from("tasks").select("title,completed,date").eq("user_id", userId).eq("date", today);
    if (!tasks || tasks.length === 0) return "No tasks found for today in FlowBoard Tracker.";
    const done = tasks.filter((t: {completed: boolean}) => t.completed).length;
    const list = tasks.map((t: {title: string; completed: boolean}) => `${t.completed ? "✓" : "○"} ${t.title}`).join("\n");
    return `FlowBoard Tracker — Today's tasks (${done}/${tasks.length} done):\n${list}`;
  } catch {
    return "Could not fetch Tracker data.";
  }
}

async function fetchBudgetContext(userId: string, accessToken: string): Promise<string> {
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    );
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const { data: entries } = await sb.from("budget_entries").select("amount,type,category").eq("user_id", userId).gte("date", monthStart).lte("date", monthEnd);
    if (!entries || entries.length === 0) return "No budget entries found for this month in FlowBoard.";
    const income  = entries.filter((e: {type: string}) => e.type === "income").reduce((s: number, e: {amount: number}) => s + e.amount, 0);
    const expense = entries.filter((e: {type: string}) => e.type === "expense").reduce((s: number, e: {amount: number}) => s + e.amount, 0);
    const balance = income - expense;
    return `FlowBoard Budget — ${now.toLocaleString("default", { month: "long", year: "numeric" })}:\nIncome: +$${income.toFixed(2)}\nExpenses: -$${expense.toFixed(2)}\nBalance: ${balance >= 0 ? "+" : ""}$${balance.toFixed(2)}\nEntries: ${entries.length}`;
  } catch {
    return "Could not fetch Budget data.";
  }
}

export async function POST(req: Request) {
  try {
    const { nodes, entityId = "default", accessToken = "" } = await req.json();

    const nodeList = (nodes as { label: string; category: string }[])
      .map((n) => `${n.category === "trigger" ? "[Trigger]" : "[Action]"} ${n.label}`)
      .join(", ");

    const hasTracker = (nodes as { label: string }[]).some(n => n.label.toLowerCase() === "tracker");
    const hasBudget  = (nodes as { label: string }[]).some(n => n.label.toLowerCase() === "budget");
    const hasNotify  = (nodes as { label: string }[]).some(n => n.label.toLowerCase() === "notify");

    const [trackerCtx, budgetCtx] = await Promise.all([
      hasTracker && entityId !== "default" ? fetchTrackerContext(entityId, accessToken) : Promise.resolve(""),
      hasBudget  && entityId !== "default" ? fetchBudgetContext(entityId, accessToken)  : Promise.resolve(""),
    ]);

    const flowboardData = [trackerCtx, budgetCtx].filter(Boolean).join("\n\n");

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ result: "AI not configured — add GROQ_API_KEY." });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const composioKey = process.env.COMPOSIO_API_KEY;

    // ── Real execution via Composio ──────────────────────────────────────────
    if (composioKey && composioKey.length > 20 && entityId !== "default") {
      const { OpenAIToolSet } = await import("composio-core");
      const toolset = new OpenAIToolSet({ apiKey: composioKey });

      const appsInWorkflow = [...new Set(
        (nodes as { label: string }[])
          .map((n) => NODE_TO_APP[n.label.toLowerCase()])
          .filter(Boolean)
      )] as string[];
      const appsToLoad = appsInWorkflow.length > 0 ? appsInWorkflow : ["gmail", "googlecalendar"];
      const rawTools = await toolset.getTools({ apps: appsToLoad });
      const tools = stripPatterns(rawTools.slice(0, 12)) as typeof rawTools;

      const messages: Groq.Chat.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `You are executing a FlowBoard automation workflow for a real user.
The workflow contains these nodes: ${nodeList}.
${flowboardData ? `\nFlowBoard internal data already fetched:\n${flowboardData}\n` : ""}
Fetch REAL data from the user's connected accounts using the available tools.
For each relevant app node:
- Google Calendar or Outlook Calendar: list upcoming events (next 3-5)
- Gmail or Outlook Mail: fetch latest 3 unread emails (subject + sender)
- Google Drive: list recent files
- Tracker: already fetched above — summarize the tasks in your response
- Budget: already fetched above — summarize the finances in your response
- Webhook triggers: acknowledge the trigger

Call any needed tools, then write a concise bullet-point summary of everything.
Use real data — never invent anything. If a tool fails, say so.`,
        },
        {
          role: "user",
          content: "Run the workflow now and show me what's in my connected accounts.",
        },
      ];

      for (let step = 0; step < 8; step++) {
        const response = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          messages, tools: tools as any, tool_choice: "auto", max_tokens: 1024,
        });

        const choice = response.choices[0];

        if (choice.finish_reason !== "tool_calls") {
          const result = choice.message.content ?? "Workflow completed.";
          if (hasNotify && entityId !== "default" && accessToken)
            await sendNotification(entityId, accessToken, "Workflow completed", result);
          return NextResponse.json({ result });
        }

        messages.push(choice.message);

        for (const call of choice.message.tool_calls ?? []) {
          const result = await toolset.executeToolCall(call, entityId);
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
        }
      }

      return NextResponse.json({ result: "Workflow completed (reached max steps)." });
    }

    // ── Simulation fallback ──────────────────────────────────────────────────
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are a workflow simulation engine. The user is not signed in or has not connected their apps yet.
Simulate the workflow with these nodes: ${nodeList}.
Return 3-5 bullet points of what would happen. Add a note:
"⚠ This is a simulation. Sign in and connect your apps to see real data."`,
        },
        { role: "user", content: "Simulate the workflow." },
      ],
      max_tokens: 512,
    });

    const simResult = response.choices[0].message.content ?? "Workflow simulated.";
    if (hasNotify && entityId !== "default" && accessToken)
      await sendNotification(entityId, accessToken, "Workflow completed", simResult);
    return NextResponse.json({ result: simResult });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Run error:", msg);
    return NextResponse.json({ result: `Run failed: ${msg}` }, { status: 500 });
  }
}
