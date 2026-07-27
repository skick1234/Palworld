import { Show, createSignal, onCleanup, onMount } from "solid-js";

const STORAGE_KEY = "palworld-mods-theme";
const SUPPORT_URL = "https://ko-fi.com/skick/?hidefeed=true&widget=true&embed=true&preview=true";
type Theme = "light" | "dark";

function storedTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function applyTheme(theme: Theme, persist = false): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  if (!persist) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // The selected theme remains active for this page when storage is unavailable.
  }
}

export function ThemeToggle() {
  const media = typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: light)")
    : { matches: false, addEventListener: () => undefined, removeEventListener: () => undefined };
  const [theme, setTheme] = createSignal<Theme>(
    document.documentElement.dataset.theme === "light" || document.documentElement.dataset.theme === "dark"
      ? document.documentElement.dataset.theme
      : storedTheme() ?? (media.matches ? "light" : "dark")
  );

  const followSystemTheme = () => {
    if (storedTheme()) return;
    const next = media.matches ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  onMount(() => {
    applyTheme(theme());
    media.addEventListener("change", followSystemTheme);
  });
  onCleanup(() => { media.removeEventListener("change", followSystemTheme); });

  const nextTheme = () => theme() === "dark" ? "light" : "dark";
  const toggle = () => {
    const next = nextTheme();
    setTheme(next);
    applyTheme(next, true);
  };

  return <button class="theme-toggle" type="button" aria-label={`Use ${nextTheme()} theme`} title={`Use ${nextTheme()} theme`} onClick={toggle}>
    <span class={`site-icon site-icon-${theme() === "dark" ? "sun" : "moon"}`} aria-hidden="true" />
  </button>;
}

export function SupportControl() {
  const [frameLoaded, setFrameLoaded] = createSignal(false);
  let dialog!: HTMLDialogElement;
  let closeButton!: HTMLButtonElement;
  let trigger!: HTMLButtonElement;

  const open = () => {
    setFrameLoaded(true);
    queueMicrotask(() => {
      dialog.showModal();
      closeButton.focus();
    });
  };
  const close = () => { dialog.close(); };

  return <>
    <button ref={trigger} class="support-trigger" type="button" onClick={open}>Donate</button>
    <dialog
      ref={dialog}
      id="support-dialog"
      class="support-dialog"
      aria-labelledby="support-dialog-title"
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClose={() => { trigger.focus(); }}
    >
      <div class="support-dialog-shell">
        <header class="support-dialog-header">
          <div><p>Ko-fi</p><h2 id="support-dialog-title">Buy me a coffee</h2></div>
          <button ref={closeButton} class="support-dialog-close" type="button" aria-label="Close donation dialog" onClick={close}>
            <span class="site-icon site-icon-x-mark" aria-hidden="true" />
          </button>
        </header>
        <div class="support-frame-wrap"><Show when={frameLoaded()}><iframe id="kofiframe" class="support-frame" src={SUPPORT_URL} title="Support Skick on Ko-fi" loading="lazy" /></Show></div>
        <p class="support-dialog-footer">Ko-fi loads only while this dialog is open. If the embed is unavailable, <a href="https://ko-fi.com/skick/" target="_blank" rel="noreferrer">open Ko-fi in a new tab</a>.</p>
      </div>
    </dialog>
  </>;
}
