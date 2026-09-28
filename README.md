# Morning Brief

What you see at 8 AM after two AI agents planned your trip overnight.

**Demo:** [hivemind-th-gabe.vercel.app](https://hivemind-th-gabe.vercel.app) · **Walkthrough:** [Loom](https://www.loom.com/share/2b3863979b9a49b8a630eb46fbfd5799)

Two persistent agents, Muse and Instinct, got the same task overnight: *Toronto to New York to Boston and back, Oct 10–18, under $1,500, window seats where you can.* The brief merges their real logs into one screen:

- **Needs you:** one decision per leg, with each agent's pick, price disagreements and anything that went stale overnight.
- **Done without you:** only what could be undone for free after waking, each with an undo deadline.
- **Assumptions:** switchable in one tap. Where the agents read the request differently, you pick.
- **Steering:** Book / Redirect / None of these. Redirect re-plans live with Gemini and search. Every choice becomes one reply per agent.
- **Night log and Trust:** every entry in order, the autonomy rules, and how they'd loosen over time.

The line between acting alone and waiting is **reversibility, not price**.

## Run it

```bash
npm install
echo "GEMINI_API_KEY=..." > .env.local
npm run dev
```

## Morning pipeline

```bash
npm run brief -- ingest muse <export>        # normalize one agent's raw log
npm run brief -- ingest instinct <export>
npm run brief -- reconcile                   # match the same flight/place across agents
npm run brief -- audit                       # live web check + cross-agent questions
npm run brief -- use live                    # point the app at src/data/live
```

The agents' bedtime prompts are in [`prompts/`](prompts). The data the demo runs on is in [`src/data/live`](src/data/live).

Built with Next.js 16, React 19, Tailwind 4 and Gemini 2.5 Flash, using Claude Code.
