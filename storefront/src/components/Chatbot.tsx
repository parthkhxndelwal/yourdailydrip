import { useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Msg = { from: "bot" | "user"; text: string };

const quickReplies = [
  "Where is my order?",
  "Which serum suits oily skin?",
  "What is your return policy?",
  "How do I use the hair oil?",
];

function answer(q: string): string {
  const t = q.toLowerCase();
  if (t.includes("order") || t.includes("track") || t.includes("deliver"))
    return "You can track any order on the Track Order page using your order ID (e.g. DD-100234) and registered phone number. Most orders reach you in 2–5 working days.";
  if (t.includes("return") || t.includes("refund"))
    return "We accept returns within 14 days of delivery for unopened products, and offer a 30-day satisfaction promise on first purchases. Refunds land in 5–7 working days.";
  if (t.includes("oily") || t.includes("acne"))
    return "For oily or acne-prone skin, start with the Calm Gel Cleanser and Clarity Vitamin C Serum. Add a light moisturiser at night — skipping moisturiser usually makes oiliness worse.";
  if (t.includes("dry") || t.includes("sensitive"))
    return "For dry or sensitive skin, our Barrier Repair Moisturiser with ceramides is the place to start, paired with the sulphate-free Calm Gel Cleanser.";
  if (t.includes("hair") || t.includes("oil") || t.includes("dandruff"))
    return "Massage Rooted Hair Growth Oil into the scalp twice a week, leave for 1–2 hours, then wash with Everyday Gentle Shampoo. For flaking, add Balance Scalp Tonic daily.";
  if (t.includes("ship") || t.includes("free"))
    return "Shipping charges are calculated at checkout based on your delivery pincode and shown before you pay. Orders placed before 4 PM IST are dispatched the same day.";
  return "Happy to help! You can ask me about orders, shipping, returns, or which product suits your skin or hair type. For anything else, write to care@dailydrip.in.";
}

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: "bot", text: "Hi, I'm Drippy 🌿 — your Daily Drip assistant. What can I help you with?" },
  ]);

  const send = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setMsgs((m) => [...m, { from: "user", text: q }, { from: "bot", text: answer(q) }]);
    setInput("");
  };

  return (
    <>
      {open && (
        <div className="fixed right-4 bottom-20 z-50 flex h-[26rem] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
            <p className="text-sm font-semibold">Drippy · Chatbot Assistant</p>
            <button aria-label="Close chat" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.map((m, i) => (
              <p
                key={i}
                className={
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm " +
                  (m.from === "bot"
                    ? "bg-secondary text-secondary-foreground"
                    : "ml-auto bg-primary text-primary-foreground")
                }
              >
                {m.text}
              </p>
            ))}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {quickReplies.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
          <form
            className="flex gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              className="h-9"
            />
            <Button type="submit" size="icon" className="size-9" aria-label="Send message">
              <Send size={15} />
            </Button>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Chat with us"
        className="chat-toggle-hidden fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-105"
      >
        <MessageCircle size={18} /> Chat
      </button>
    </>
  );
}