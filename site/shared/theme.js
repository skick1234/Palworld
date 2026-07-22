const storageKey = "palworld-mods-theme";
const root = document.documentElement;
const media = window.matchMedia("(prefers-color-scheme: light)");

function storedTheme() {
  try {
    const value = localStorage.getItem(storageKey);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function currentTheme() {
  return root.dataset.theme ?? storedTheme() ?? (media.matches ? "light" : "dark");
}

const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;

function applyTheme(theme, persist = false) {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    const next = theme === "dark" ? "light" : "dark";
    button.innerHTML = theme === "dark" ? sunIcon : moonIcon;
    button.setAttribute("aria-label", `Use ${next} theme`);
    button.setAttribute("title", `Use ${next} theme`);
  });
  if (persist) {
    try { localStorage.setItem(storageKey, theme); } catch { /* preferences remain session-local */ }
  }
}

applyTheme(currentTheme());
document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
  button.addEventListener("click", () => applyTheme(currentTheme() === "dark" ? "light" : "dark", true));
});
media.addEventListener("change", () => { if (!storedTheme()) applyTheme(media.matches ? "light" : "dark"); });
