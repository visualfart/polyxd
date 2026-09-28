/**
 * The landing: what Studio is, for someone who is signed out (at `/`) or wants the page back
 * (`/welcome`). The hero is not a picture: the spec's send-money example, drawn by @polyxd/react
 * and cycled through three design systems. Everything it claims is in the docs at
 * polyxd.com/docs/studio; the product images are captured from Studio itself.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { PolyxdSurface, type UIDocument } from "@polyxd/react";
import "@polyxd/react/styles.css";
import "@polyxd/react/themes/material3.css";
import "@polyxd/react/themes/shadcn.css";
import "@polyxd/react/themes/govuk.css";
import sendMoney from "../../../../../packages/spec/examples/money-send-form.json" with { type: "json" };
import { useSession } from "../App.tsx";
import { Mark, StudioLockup } from "../mark.tsx";
import { PackLogo } from "../packlogo.tsx";
import "../landing.css";

const PACKS: { id: string; name: string }[] = [
  { id: "material3", name: "Material 3" },
  { id: "shadcn", name: "shadcn/ui" },
  { id: "govuk", name: "GOV.UK" },
];
const EVERY = 3000;

const DOCS = "https://polyxd.com/docs/studio/";
const REPO = "https://github.com/visualfart/polyxd";

export function Landing() {
  const { me } = useSession();
  const signedIn = !!me.user;
  return (
    <div className="landing">
      <a className="l-skip" href="#main">Skip to content</a>
      <header className="l-header">
        <div className="l-wrap">
          <Link className="l-brand" to={signedIn ? "/welcome" : "/"} aria-label="Polyxd Studio">
            <StudioLockup size={30} />
          </Link>
          <nav className="l-nav" aria-label="Main">
            <a className="l-nav-wide" href={DOCS}>Docs</a>
            <a className="l-nav-wide" href="https://polyxd.com">Polyxd</a>
            {signedIn ? (
              <Link className="l-btn l-btn-signal l-btn-small" to="/">Open Studio</Link>
            ) : (
              <>
                <Link to="/signin">Sign in</Link>
                <Link className="l-btn l-btn-line l-btn-small" to="/signin?mode=signup">Create a workspace</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="main">
        <section className="l-hero" aria-labelledby="hero-title">
          <div className="l-wrap l-hero-grid">
            <div className="l-hero-words">
              <h1 id="hero-title">Where your design system decides what generated screens may look like.</h1>
              <p className="l-lede">Bring your tokens as they are, map them onto Polyxd's 87 roles, tune and export them for code, author the screens that aren't generated, and deliver all of it to your product by key.</p>
              <div className="l-cta-row">
                {signedIn ? <Link className="l-btn l-btn-signal" to="/">Open Studio</Link> : <Link className="l-btn l-btn-signal" to="/signin?mode=signup">Create a workspace</Link>}
                <a className="l-btn l-btn-line" href="#how">See how it works ↓</a>
              </div>
            </div>
            <Hero />
          </div>
        </section>

        <section className="l-features" id="how" aria-label="What Studio does">
          <div className="l-wrap">
            <Feature
              n={1}
              title="Your design system, as it is"
              image={{ src: "/landing/scan.png", w: 1600, h: 1000, alt: "The scan of the Sketch pack imported as a Tokens Studio file: 275 tokens counted by tier and by type, a light and a dark mode, every reference resolving" }}
              second={{ src: "/landing/templates.png", w: 720, h: 690, alt: "The template chooser: Blank, Mono, Civic, Sketch, Wireframe and Editorial, each with a line of character and a strip of swatches from its own tokens" }}
            >
              Import it from an npm package, public or private, a packed <code>.tgz</code>, a Tokens Studio file, a W3C DTCG file, or CSS custom properties. Push it from where the tokens are built with <code>polyxd studio push</code>, so a release step can run it. Or start from one of twelve templates. Either way the scan shows what was found: tokens by tier and type, modes, aliases, broken and circular references, deprecated tokens.
            </Feature>
            <Feature
              n={2}
              title="Mapped, measured, published"
              image={{ src: "/landing/mapping.png", w: 1600, h: 1000, alt: "The mapping page: Polyxd's roles down the left, each with the semantic token it was matched to, its alias chain, its value in light and dark, and the contrast ratio measured against its pairs" }}
            >
              Polyxd's 87 roles are matched onto your semantic tier by name, type and value, with the alias chain each resolves through and its contrast measured in every mode. Accept the exact matches in one go, pick a candidate for the rest, and publish. Publishing stays blocked while any pair fails contrast.
            </Feature>
            <Feature
              n={3}
              title="Tune it, export it"
              image={{ src: "/landing/tokens.png", w: 1600, h: 1000, alt: "The tokens editor: a brand colour ramp turned to teal, as rows of swatches, each marked with the roles that read it and whether their contrast pairs pass, with the primitive's value open for editing" }}
              second={{ src: "/landing/export.png", w: 560, h: 739, alt: "The export dialog: CSS variables, a DTCG pack, a Tailwind theme, a Style Dictionary source, a Swift enum and a Kotlin object" }}
            >
              Primitives by group, colour ramps as swatches that show which roles read each step and whether their contrast pairs pass, scales as lists. Change a value and every alias through it follows, with contrast measured again as you type; save the edits as a new draft version. Export any version for code: CSS variables, a DTCG pack, a Tailwind theme, a Style Dictionary source, a Swift enum or a Kotlin object, from the Export button or the API with a key.
            </Feature>
            <Feature
              n={4}
              title="Screens, by designers"
              image={{ src: "/landing/screens.png", dark: "/landing/screens-dark.png", w: 1920, h: 1000, alt: "The Screens editor: the shell's component tree on the left with its regions as labelled slots, the shell drawn at desktop width in the middle with a published Send money screen in its Outlet, and the property panel on the right" }}
            >
              A screen is a Polyxd document, edited as a tree of the 44 components with a property panel made from the spec's schema, and drawn live with <code>@polyxd/react</code> in your published design system or any of the 13 built-in ones: light and dark, phone, tablet and desktop. It is checked as you edit, the way a generated screen is, and Publish waits until no error remains. The shell your product wraps around its screens is authored the same way, and previewed with a published screen in its Outlet.
            </Feature>
            <Feature n={5} title="Delivered to your product" code>
              A published screen is fetched by key with an API key from Team → API keys. The answer is the document itself, with an <code>X-Polyxd-Screen-Version</code> header, ready for <code>PolyxdSurface</code>. A key reads published screens and design systems and can't change anything. Fetch on the server or at build time: a screen changes when someone publishes, not on every request.
            </Feature>
          </div>
        </section>

        <section className="l-teams" aria-labelledby="teams-title">
          <div className="l-wrap">
            <h2 id="teams-title">For teams</h2>
            <p className="l-section-lede">One workspace per product. Invites carry a role: design-system, designer, product, engineer or viewer.</p>
            <dl className="l-columns">
              <div><dt>Design-system team</dt><dd>Imports the tokens, maps the roles, tunes and publishes the version every screen is drawn in.</dd></div>
              <div><dt>Designers</dt><dd>Write the rules every screen is checked against, and author the screens that aren't generated, and the shell around them.</dd></div>
              <div><dt>Product</dt><dd>Authors screens too, holds the API key, and renders what's published with <code>PolyxdSurface</code>.</dd></div>
            </dl>
          </div>
        </section>

        <section className="l-source" aria-labelledby="source-title">
          <div className="l-wrap l-source-grid">
            <div>
              <h2 id="source-title">Open source, or hosted</h2>
              <p>Studio is Apache-2.0, in <code>apps/studio</code> of the <a href={REPO}>Polyxd repository</a>, running on Cloudflare Workers with D1 and R2. Run it on your own account, or use the hosted one at studio.polyxd.com. Same code either way.</p>
            </div>
            <div className="l-source-cards">
              <div className="l-card">
                <h3>Run it yourself</h3>
                <pre className="l-code" data-theme="dark" tabIndex={0}><code>{"git clone https://github.com/visualfart/polyxd && cd polyxd && npm install\nnpm run db:migrate -w @polyxd/studio\nnpm run dev -w @polyxd/studio      "}<span className="l-comment"># http://localhost:8789</span></code></pre>
              </div>
              <div className="l-card">
                <h3>Hosted</h3>
                <p>Free for one workspace. A small fee may cover its storage later.</p>
                {signedIn ? <Link className="l-btn l-btn-ink l-btn-small" to="/">Open Studio</Link> : <Link className="l-btn l-btn-ink l-btn-small" to="/signin?mode=signup">Create a workspace</Link>}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="l-footer">
        <div className="l-wrap">
          <Link className="l-brand" to={signedIn ? "/welcome" : "/"} aria-label="Polyxd Studio">
            <StudioLockup size={26} />
          </Link>
          <nav aria-label="Footer">
            <a href={DOCS}>Docs</a>
            <a href="https://polyxd.com">Polyxd</a>
            <a href={REPO}>GitHub</a>
          </nav>
          <span>© 2026 Polyxd · Apache-2.0 code, CC-BY-4.0 spec</span>
        </div>
      </footer>
    </div>
  );
}

/** The spec's send-money example, drawn for real, cycled through three packs; a click on a pack holds it. */
function Hero() {
  const [reduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(reduced);
  useEffect(() => {
    if (held) return;
    let t = setInterval(step, EVERY);
    function step() {
      if (!document.hidden) setI((n) => (n + 1) % PACKS.length);
    }
    // Keep the cycle in step with the eye: restart it when the tab comes back.
    const vis = () => {
      clearInterval(t);
      t = setInterval(step, EVERY);
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [held]);
  return (
    <figure className="l-hero-visual" aria-label="The spec's Send money example, drawn by the renderer in Material 3, shadcn/ui and GOV.UK">
      {/* Drawn for real, but a picture to the page: inert keeps the form's own heading and fields out of the page's outline and tab order. */}
      <div className="l-stage" data-fade={!reduced} inert>
        {PACKS.map((p, n) => (
          <div key={p.id} className="l-layer" data-pxd-theme={p.id} data-pxd-mode="light" data-active={n === i}>
            <PolyxdSurface document={sendMoney as unknown as UIDocument} theme={p.id} mode="light" density="compact" onAction={() => {}} />
          </div>
        ))}
      </div>
      <figcaption>
        <span className="l-caption">The same document, three design systems</span>
        <div className="l-packs" role="group" aria-label="Design system">
          {PACKS.map((p, n) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={n === i}
              onClick={() => {
                setI(n);
                setHeld(true);
              }}
            >
              <PackLogo id={p.id} size={22} />
              {p.name}
            </button>
          ))}
        </div>
        <span className="l-checked">
          <Mark size={28} state="checked" />
          Checked in 13 design systems · no issues
        </span>
      </figcaption>
    </figure>
  );
}

interface Img {
  src: string;
  /** The same capture with the page's own dark mode, when it has one. */
  dark?: string;
  w: number;
  h: number;
  alt: string;
}

function Picture({ img }: { img: Img }) {
  const image = <img src={img.src} alt={img.alt} width={img.w} height={img.h} loading="lazy" decoding="async" />;
  return img.dark ? (
    <picture>
      <source srcSet={img.dark} media="(prefers-color-scheme: dark)" />
      {image}
    </picture>
  ) : (
    image
  );
}

function Feature({ n, title, image, second, code, children }: { n: number; title: string; image?: Img; second?: Img; code?: boolean; children: ReactNode }) {
  const id = `feature-${n}`;
  return (
    <article className="l-feature" aria-labelledby={id}>
      <div className="l-feature-words">
        <span className="l-eyebrow">{String(n).padStart(2, "0")}</span>
        <h2 id={id}>{title}</h2>
        <p>{children}</p>
      </div>
      <div className="l-feature-visual">
        {image && (
          <figure className="l-frame">
            <Picture img={image} />
          </figure>
        )}
        {second && (
          <figure className="l-frame l-frame-second">
            <Picture img={second} />
          </figure>
        )}
        {code && <Delivery />}
      </div>
    </article>
  );
}

function Delivery() {
  return (
    <pre className="l-code l-code-tall" data-theme="dark" tabIndex={0}>
      <code>
        <span className="l-comment"># Fetch a published screen by key</span>
        {"\n"}curl -H <span className="l-string">"Authorization: Bearer $POLYXD_STUDIO_KEY"</span> \{"\n"}
        {"  "}<span className="l-string">https://studio.polyxd.com/api/w/harbourline/screens/send-money</span>
        {"\n\n"}
        <span className="l-comment">// Render it exactly like a generated one</span>
        {"\n"}const doc = await fetch(<span className="l-string">{"`${STUDIO}/api/w/harbourline/screens/send-money`"}</span>, {"{"}
        {"\n"}  headers: {"{"} authorization: <span className="l-string">{"`Bearer ${key}`"}</span> {"}"},
        {"\n"}{"}"}).then((r) =&gt; r.json());
        {"\n\n"}&lt;PolyxdSurface document={"{doc}"} data={"{liveData}"} theme=<span className="l-string">"harbourline"</span> onAction={"{handle}"} /&gt;
      </code>
    </pre>
  );
}
