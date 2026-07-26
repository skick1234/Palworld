# PalOps dashboard

Self-hosted Bun dashboard for the PalOps version 1 API. It derives its proxy allowlist from `contracts/palops/openapi.json`, keeps the Palworld admin password only in an absolute-lived server session, and exposes seven views: Overview, Rankings, Players, Operations, World, Settings, and API. Public rankings remain useful without a login; operator-only views are gated before private requests are made.

Ranking endpoints return complete unpaginated raw observations. The browser
calculates Firepower, Combat Power, Team, and Guild ordering from those inputs
and the versioned scoring policy. The Bun proxy coalesces simultaneous identical
snapshot reads, retains bounded ETag-addressed bodies, revalidates unchanged
generations, and may serve its last response as stale when PalOps rejects excess
bulk traffic to protect gameplay.

```powershell
$env:PALOPS_API_BASE = "http://127.0.0.1:8222"
bun run start
```

The dashboard binds to `127.0.0.1:8230` by default. Put it behind HTTPS or a trusted VPN before allowing remote access. Environment options are `PALOPS_DASHBOARD_HOST`, `PALOPS_DASHBOARD_PORT`, `PALOPS_API_BASE`, and `PALOPS_SESSION_HOURS`.
