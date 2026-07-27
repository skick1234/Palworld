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
        <a class="product-link" href="palops/">PalOps</a>
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
          <h1 id="hero-title"><span>Rule the map.</span><span>Run the server.</span></h1>
          <p class="lede">Shape regional combat with PalLaw. Operate your dedicated server with PalOps.</p>
          <div class="hero-actions">
            <a class="primary-action" href="https://www.nexusmods.com/palworld/mods/4193" target="_blank" rel="noreferrer" aria-label="Download PalLaw on Nexus Mods">Download on Nexus <span class="site-icon site-icon-arrow-up-right" aria-hidden="true" /></a>
            <a class="text-action" href="pallaw/">Open Rules Studio <span class="site-icon site-icon-arrow-right" aria-hidden="true" /></a>
          </div>
        </div>
        <figure class="hero-art"><img src="assets/pallaw-terrain-hero.jpg" alt="Aerial terrain from the Palworld map" width="1536" height="1024" fetchpriority="high" /></figure>
      </section>

      <section id="collection" class="products" aria-labelledby="products-title">
        <header class="section-intro"><p>One server, two control surfaces</p><h2 id="products-title">Set the rules. Keep watch.</h2></header>
        <article class="product-feature product-pvp">
          <div class="product-copy">
            <p class="product-name">PalLaw</p>
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

        <article class="product-feature product-ops">
          <figure class="ops-visual"><img src="assets/palops-operations-atmosphere.webp" alt="A dark topographic field connected by warm server signals" width="1536" height="1024" loading="lazy" /></figure>
          <div class="product-copy">
            <p class="product-name">PalOps</p><h3>Operations without the black box.</h3>
            <p>See who is online, act on the server, and expose only the administrative surface you intentionally configure.</p>
            <div class="ops-outcomes"><span>Live players</span><span>Moderation</span><span>Server commands</span></div>
            <a class="product-action" href="palops/">Explore PalOps <span class="site-icon site-icon-arrow-right" aria-hidden="true" /></a>
          </div>
        </article>
      </section>

      <section class="operator-promise" aria-labelledby="promise-title">
        <div class="promise-heading"><p>Built for server owners</p><h2 id="promise-title">Your world stays yours.</h2></div>
        <dl class="promise-facts">
          <div><dt>Static Rules Studio</dt><dd>Your configuration is edited in the browser, without an upload service.</dd></div>
          <div><dt>Self-hosted operations</dt><dd>PalOps runs beside the dedicated server you control.</dd></div>
          <div><dt>No telemetry</dt><dd>No analytics or configuration-data requests leave these tools.</dd></div>
        </dl>
      </section>
    </main>

    <footer>
      <p class="footer-brand"><strong>Palworld Mods</strong><span>Unofficial fan-made project.</span></p>
      <p>Not affiliated with, endorsed by, sponsored by, or approved by Pocketpair, Inc.</p>
      <p><a href="legal/">Legal and asset notices</a></p>
    </footer>
  </>;
}
