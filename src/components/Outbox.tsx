"use client";

import { useState } from "react";
import type { Brief } from "@/lib/derive";
import { ago, money } from "@/lib/format";
import { useLive } from "@/lib/live";
import { useDemoTime, useStore } from "@/lib/store";
import { Btn, Sheet } from "./ui";

// Every tap in the brief becomes one line of a single reply to Muse. Muse has
// no API, so the reply is the steering channel: the user reviews it, sends it
// in one go, and Muse picks it up on its next turn.
export function Outbox({ brief }: { brief: Brief }) {
  const { s, dispatch, now } = useStore();
  const toDemo = useDemoTime();
  const live = useLive(brief);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const n = s.outbox.length;
  const message = [
    "Morning! Here's what I decided:",
    ...s.outbox.map((o, i) => `${i + 1}. ${o.text}`),
    "",
    `That should put the trip at about ${money(live.projected)} of ${money(live.budget)}. Confirm each one back to me with the final price, and flag anything that changed since last night.`,
  ].join("\n");

  const send = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {}
    dispatch({ t: "sent" });
    window.open("https://muse.ai", "_blank", "noopener");
  };

  if (!n && !s.sentAt) return null;

  const sentAtDemo = s.sentAt ? toDemo(s.sentAt) : null;

  return (
    <>
      {/* Floats above the page, dark in both themes, like a system tray. */}
      <div className="fixed inset-x-0 bottom-4 z-40 px-4 sm:bottom-6">
        <div className="night rise mx-auto flex max-w-[560px] items-center justify-between gap-4 py-3 pl-5 pr-3 shadow-[0_12px_40px_rgba(0,0,0,0.28)]">
          <div className="min-w-0 leading-tight">
            {s.sentAt ? (
              <>
                <div className="text-[15px] font-semibold">Sent to Muse</div>
                <div className="mt-0.5 text-[13px] text-muted">{ago(new Date(sentAtDemo!).toISOString(), now)}. Waiting to confirm.</div>
              </>
            ) : (
              <>
                <div className="text-[15px] font-semibold">
                  <span className="num">{n}</span> change{n === 1 ? "" : "s"} for Muse
                </div>
                <div className="mt-0.5 text-[13px] text-muted">Nothing is sent yet</div>
              </>
            )}
          </div>
          <Btn kind="primary" onClick={() => setOpen(true)}>
            {s.sentAt ? "View" : "Review"}
          </Btn>
        </div>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Your reply to Muse">
        <p className="text-[15px] leading-relaxed text-ink-2">Everything you changed, as one message.</p>
        <pre className="mt-5 whitespace-pre-wrap bg-paper p-5 font-sans text-[15px] leading-relaxed">{message}</pre>
        <div className="mt-6 flex items-center gap-5">
          <Btn kind="primary" onClick={send}>
            {copied ? "Copied. Paste in Muse" : "Copy & open Muse"}
          </Btn>
          <Btn kind="ghost" onClick={() => dispatch({ t: "reset" })}>
            Start over
          </Btn>
        </div>
      </Sheet>
    </>
  );
}
