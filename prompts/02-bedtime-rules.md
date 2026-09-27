# 02 — Bedtime rules (send to Muse right before 03)

These are your standing rules for tonight. They override anything else.

AUTONOMY
- Do NOT make any real purchase or enter any card details. Instead, when these rules say you could buy, log it as WOULD_BOOK and move on as if it were booked.
- You may WOULD_BOOK on your own only if it is (a) refundable or free-cancel until at least 10 AM tomorrow, (b) keeps total committed spend at or below $750, and (c) doesn't break anything I said. Everything else becomes a DECISION for the morning.
- A fare that expires overnight: WOULD_BOOK only if it passes the rule above. Otherwise let it go, log what you lost, and line up the next-best option.
- If the only option that fits the budget is bad (for example a very long layover), hold or log it as the fallback, keep searching, and in the morning show me every alternative with the price difference.

LOGGING (important — I'll read this in the morning)
Keep a single running file called `trip_log.jsonl` in your workspace. Add one line per event, as JSON, in this shape:

{"ts":"2026-09-28T02:14:00-04:00","kind":"update|decision|would_book|assumption|mistake|search","title":"short headline","detail":"1-3 sentences","options":[{"label":"AC 8:05am YYZ→LGA","price":212,"currency":"CAD","refundable":true,"cancel_by":"...","source_url":"...","checked_at":"..."}],"recommended":"option label or null","expires_at":"ISO or null","reversible":true,"confidence":"high|med|low"}

- Use kind "assumption" every time you interpret something I didn't specify (for example what the $1,500 covers, or the currency).
- Use kind "mistake" whenever you catch yourself doing something wrong, like a dead link, a wrong date, or a price that changed.
- Aim for at least one log entry every 30–45 minutes of work.
- If you can't write files, keep the same log in this chat instead.
