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
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-rule-strong bg-paper">
        <div className="mx-auto flex max-w-[720px] items-center justify-between gap-4 px-5 py-4 sm:px-10">
          <div className="min-w-0 text-[13.5px] leading-tight">
            {s.sentAt ? (
              <>
                <div className="font-medium">Sent to Muse</div>
                <div className="text-[12px] text-muted">
                  {ago(new Date(sentAtDemo!).toISOString(), now)}. Waiting for Muse to confirm.
                </div>
              </>
            ) : (
              <>
                <div className="font-medium">Your reply to Muse</div>
                <div className="text-[12.5px] text-muted">
                  {n} change{n === 1 ? "" : "s"}, not sent yet
                </div>
              </>
            )}
          </div>
          <Btn kind={s.sentAt ? "secondary" : "primary"} onClick={() => setOpen(true)}>
            {s.sentAt ? "View" : "Review & send"}
          </Btn>
        </div>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Your reply to Muse">
        <p className="text-[14px] leading-relaxed text-ink-2">Everything you changed, as one message.</p>
        <pre className="mt-4 whitespace-pre-wrap border border-rule bg-card p-3 font-sans text-[14px] leading-relaxed">{message}</pre>
        <div className="mt-3 flex items-center gap-2">
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
