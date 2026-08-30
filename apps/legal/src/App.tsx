import { SupportControl, ThemeToggle } from "../../shared/src/SiteControls";

export function App() {
  return <>
    <a class="skip-link" href="#legal-content">Skip to content</a>
    <header class="site-header">
      <a class="wordmark" href="../" aria-label="Palworld Mods home">Palworld <b>/ Mods</b></a>
      <nav aria-label="Primary navigation">
        <a class="product-link" href="../pallaw/">PalLaw</a>
        <a class="product-link" href="https://palorbit.app" target="_blank" rel="noreferrer">PalOrbit</a>
        <a class="utility-link" href="./" aria-current="page">Legal</a>
        <a class="utility-link" href="https://github.com/skick1234/Palworld">GitHub</a>
        <a class="discord-link" href="https://discord.gg/zzhK54aaYz" target="_blank" rel="noreferrer">Discord</a>
        <SupportControl />
        <ThemeToggle />
      </nav>
    </header>

    <main id="legal-content" class="legal-page">
      <p class="kicker">Legal and asset notices</p>
      <h1>Unofficial fan-made project.</h1>

      <section id="non-affiliation">
        <h2>Non-affiliation</h2>
        <p><strong>PalLaw and Palworld Mods are unofficial community projects. They are not affiliated with, endorsed by, sponsored by, or approved by Pocketpair, Inc.</strong> Palworld and all related names, trademarks, map imagery, and game assets are the property of their respective owners. I do not claim ownership of those materials.</p>
      </section>

      <section id="about">
        <h2>About the maintainer</h2>
        <p>This project is developed and maintained by <strong>Skick</strong>. I build focused, high-performance tooling and C++ mods for dedicated Palworld server communities.</p>
      </section>

      <section id="contact">
        <h2>Contact & community</h2>
        <p>Join the community and ask questions in the official <a href="https://discord.gg/zzhK54aaYz" target="_blank" rel="noreferrer">Discord server</a>. For bug reports, code issues, or removal requests, open an issue on the <a href="https://github.com/skick1234/Palworld/issues" target="_blank" rel="noreferrer">GitHub repository</a>.</p>
      </section>

      <section id="privacy">
        <h2>Privacy policy</h2>
        <p>This website operates with a strict <strong>zero-telemetry</strong> policy. No personal data, tracking cookies, analytics events, or configuration contents are collected or transmitted. Local theme preferences and draft maps remain entirely within your browser's local storage.</p>
      </section>

      <section id="terms">
        <h2>Terms of use & project license</h2>
        <p>The Apache License 2.0 applies only to this project's original source code and documentation. It does not license or grant rights to Palworld trademarks, map imagery, or other third-party assets.</p>
      </section>

      <section id="map-imagery">
        <h2>Map imagery</h2>
        <p>The bundled world and World Tree map imagery is Palworld game material owned by Pocketpair, Inc. Its inclusion in this unofficial fan-made editor does not claim ownership, endorsement, or a license grant.</p>
        <p>See the repository's <a href="https://github.com/skick1234/Palworld/blob/main/THIRD_PARTY_NOTICES.md">third-party notices</a> and Pocketpair's <a href="https://www.pocketpair.jp/en/guidelines-derivativework-en/">Guidelines for Derivative Works</a>.</p>
      </section>

      <section id="donations">
        <h2>Ko-fi donations</h2>
        <p>The optional donation dialog loads an embedded Ko-fi page only after you choose Donate. Ko-fi operates as a separate third-party service. Configuration data is not sent to Ko-fi or the approved font host.</p>
      </section>
    </main>

    <footer>
      <p><strong>Unofficial fan-made project created by Skick.</strong><br />Palworld materials remain the property of their respective owners.</p>
      <p><a href="../pallaw/">Open Rules Studio</a></p>
    </footer>
  </>;
}
