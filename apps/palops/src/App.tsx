import { SupportControl, ThemeToggle } from "../../shared/src/SiteControls";

export function App() {
  return <>
    <a class="skip-link" href="#guide">Skip to guide</a>
    <header class="guide-header">
      <a class="wordmark" href="../">Palworld <b>/ Mods</b></a>
      <nav aria-label="Primary navigation">
        <a class="product-link" href="../pallaw/">PalLaw</a>
        <a class="product-link" href="./" aria-current="page">PalOps</a>
        <a class="utility-link" href="https://github.com/skick1234/Palworld">Source</a>
        <a class="discord-link" href="https://discord.gg/zzhK54aaYz" target="_blank" rel="noreferrer">Discord</a>
        <SupportControl />
        <ThemeToggle />
      </nav>
    </header>

    <main id="guide">
      <section class="guide-hero">
        <div><p class="guide-kicker">PalOps operator guide</p><h1>Operate with every seam visible.</h1><p class="lede">Install, secure, and discover the explicit server resources exposed by the self-hosted API.</p></div>
        <dl class="contract-facts">
          <div><dt>Operations</dt><dd>26</dd></div><div><dt>Fixed public</dt><dd>2</dd></div><div><dt>Mutation model</dt><dd>202 + operation</dd></div><div><dt>Persistence</dt><dd>SQLite</dd></div>
        </dl>
      </section>

      <div class="guide-layout">
        <aside class="guide-index" aria-label="Guide sections"><p>Operator guide</p><nav><a href="#install">Install</a><a href="#access">Access policy</a><a href="#secure">Secure transport</a><a href="#discover">Discovery</a></nav></aside>
        <article class="guide-article">
          <section id="install" aria-labelledby="install-title">
            <h2 id="install-title">A copy-ready UE4SS mod.</h2>
            <p>Copy the packaged <code>PalOps</code> directory into <code>PalServer/Pal/Binaries/Win64/Mods</code>. The runtime package contains only <code>enabled.txt</code>, <code>palops.json</code>, and <code>dlls/main.dll</code>.</p>
            <pre><code>{`Mods/PalOps/
  enabled.txt
  palops.json
  dlls/main.dll`}</code></pre>
          </section>
          <section id="access" aria-labelledby="access-title">
            <h2 id="access-title">Policy belongs to each operation.</h2>
            <p>The <code>endpoint_access</code> object is keyed by OpenAPI <code>operationId</code>. There are no public or admin route categories. A disabled operation returns 404.</p>
            <pre><code>{`"getPlayers": {
  "enabled": true,
  "authenticated": false
},
"createBan": {
  "enabled": true,
  "authenticated": true
}`}</code></pre>
            <p><code>getHealth</code> and <code>getCapabilities</code> always remain enabled and unauthenticated. PalOps logs a warning when another enabled operation is intentionally exposed without authentication.</p>
          </section>
          <section id="secure" aria-labelledby="secure-title">
            <h2 id="secure-title">Treat Basic auth as transport-sensitive.</h2>
            <p>PalOps uses the running server's <code>AdminPassword</code>. Bind to loopback by default. Use a trusted VPN or an HTTPS reverse proxy before exposing the API beyond the host.</p>
            <ul><li>Never publish port 8222 directly to the internet.</li><li>Keep command operations authenticated.</li><li>Use a unique <code>Idempotency-Key</code> for every mutation intent.</li></ul>
          </section>
          <section id="discover" aria-labelledby="discover-title">
            <h2 id="discover-title">Ask the server what is exposed.</h2>
            <p><code>GET /v1/capabilities</code> returns the configured policy for every operation as two booleans. It deliberately does not pretend that runtime data is ready.</p>
            <pre><code>{`{
  "endpoints": {
    "getPlayers": {
      "enabled": true,
      "authenticated": false
    }
  }
}`}</code></pre>
            <p>Use <code>GET /health</code> and <code>GET /v1/server-status</code> for process and world readiness.</p>
          </section>
        </article>
      </div>

      <section class="guide-closing"><div><p class="kicker">Dashboard</p><h2>Six operator views, driven by one contract.</h2></div><p>The open-source dashboard covers leaderboards, players, map, operations, audit, and system state. It is self-hosted and does not send server data to this website.</p></section>
    </main>

    <footer><p><strong>PalOps</strong><br />Unofficial fan-made project.</p><p>Not affiliated with, endorsed by, sponsored by, or approved by Pocketpair, Inc.</p><a href="../legal/">Legal and asset notices</a></footer>
  </>;
}
