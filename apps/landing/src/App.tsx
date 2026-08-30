import { For } from "solid-js";
import { SupportControl, ThemeToggle } from "../../shared/src/SiteControls";

const mapTiles = Array.from({ length: 4 }, (_, y) => Array.from({ length: 4 }, (_, x) => ({ x, y }))).flat();

export function App() {
  return <>
    <a class="skip-link" href="#main-content">Skip to content</a>
    <header class="site-header">
      <a class="wordmark" href="./" aria-label="Palworld Mods home">Palworld <b>/ Mods</b></a>
      <nav aria-label="Primary navigation">
        <a class="product-link" href="pallaw/">PalLaw</a>
        <a class="product-link" href="https://palorbit.app" target="_blank" rel="noreferrer">PalOrbit</a>
        <a class="utility-link" href="legal/">Legal</a>
        <a class="utility-link" href="https://github.com/skick1234/Palworld">GitHub</a>
        <a class="discord-link" href="https://discord.gg/zzhK54aaYz" target="_blank" rel="noreferrer">Discord</a>
        <SupportControl />
        <ThemeToggle />
      </nav>
    </header>

    <main id="main-content">
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-copy">
          <p class="hero-kicker">Palworld server tools</p>
          <h1 id="hero-title"><span>Rule the map.</span><span>Connect the cloud.</span></h1>
          <p class="lede">Shape regional combat with PalLaw offline. Manage servers, live telemetry, and community links with PalOrbit.</p>
          <div class="hero-actions">
            <a class="primary-action" href="https://www.nexusmods.com/palworld/mods/4193" target="_blank" rel="noreferrer" aria-label="Download PalLaw on Nexus Mods">Download on Nexus <span class="site-icon site-icon-arrow-up-right" aria-hidden="true" /></a>
            <a class="text-action" href="pallaw/">Open Rules Studio <span class="site-icon site-icon-arrow-right" aria-hidden="true" /></a>
          </div>
        </div>
        <figure class="hero-art"><img src="assets/pallaw-terrain-hero.jpg" alt="Aerial terrain from the Palworld map" width="1536" height="1024" fetchpriority="high" /></figure>
      </section>

      <section id="collection" class="products" aria-labelledby="products-title">
        <header class="section-intro"><p>Two paths for dedicated servers</p><h2 id="products-title">Set the rules. Connect the cloud.</h2></header>
        <article class="product-feature product-pvp">
          <div class="product-copy">
            <p class="product-name">PalLaw (Offline)</p>
            <h3>Draw where combat is restricted.</h3>
            <p>Protect settlements and cooperative territory with regional allow-or-deny policy. PalLaw does not enable Palworld player damage on a globally PvE server.</p>
            <ul class="outcome-list"><li>Region-aware combat</li><li>Visual rule authoring</li><li>Server-authoritative enforcement</li></ul>
            <div class="product-actions">
              <a class="primary-action" href="https://www.nexusmods.com/palworld/mods/4193" target="_blank" rel="noreferrer" aria-label="Download PalLaw on Nexus Mods">Download on Nexus <span class="site-icon site-icon-arrow-up-right" aria-hidden="true" /></a>
              <a class="product-action" href="pallaw/">Open Rules Studio <span class="site-icon site-icon-arrow-right" aria-hidden="true" /></a>
            </div>
          </div>
          <figure class="map-visual">
            <div class="map-mosaic" aria-hidden="true"><For each={mapTiles}>{({ x, y }) => <img src={`pallaw/assets/paldb-map/z2x${x}y${y}.webp`} alt="" width="512" height="512" loading="lazy" />}</For></div>
            <figcaption>World map used by Rules Studio</figcaption>
          </figure>
        </article>

        <article class="product-feature product-ops product-orbit">
          <figure class="ops-visual"><img src="assets/palops-operations-atmosphere.webp" alt="A dark topographic field connected by cloud signals" width="1536" height="1024" loading="lazy" /></figure>
          <div class="product-copy">
            <p class="product-name">PalOrbit</p><h3>Cloud operations and live telemetry.</h3>
            <p>Manage regional laws from a Cloud Zone Studio, inspect real-time player telemetry, relay chat bi-directionally to Discord, and automate starter kit fulfillment.</p>
            <div class="ops-outcomes"><span>Zone Studio</span><span>Live Telemetry</span><span>Discord Cross-Chat</span><span>Starter Kits</span><span>Role Privileges</span></div>
            <div class="product-actions">
              <a class="product-action" href="https://palorbit.app" target="_blank" rel="noreferrer">Visit PalOrbit (Coming Soon) <span class="site-icon site-icon-arrow-up-right" aria-hidden="true" /></a>
            </div>
          </div>
        </article>
      </section>

      <section class="operator-promise" aria-labelledby="promise-title">
        <div class="promise-heading"><p>Built for server owners</p><h2 id="promise-title">Your world stays yours.</h2></div>
        <dl class="promise-facts">
          <div><dt>Static Rules Studio</dt><dd>Your configuration is edited in the browser, without an upload service.</dd></div>
          <div><dt>Secure Cloud Bridge</dt><dd>PalOrbit connects outbound via encrypted TLS with Server API Tokens. No inbound ports required.</dd></div>
          <div><dt>No telemetry</dt><dd>No analytics or configuration-data requests leave these tools.</dd></div>
        </dl>
      </section>
    </main>

    <footer>
      <p class="footer-brand"><strong>Palworld Mods</strong><span>Unofficial fan-made project created by Skick.</span></p>
      <p>Not affiliated with, endorsed by, sponsored by, or approved by Pocketpair, Inc.</p>
      <p><a href="legal/">Legal, About, and Privacy notices</a></p>
    </footer>
  </>;
}
