const supportUrl = "https://ko-fi.com/skick/?hidefeed=true&widget=true&embed=true&preview=true";
const triggers = [...document.querySelectorAll("[data-support-trigger]")];

if (triggers.length) {
  const dialog = document.createElement("dialog");
  dialog.id = "support-dialog";
  dialog.className = "support-dialog";
  dialog.setAttribute("aria-labelledby", "support-dialog-title");
  dialog.innerHTML = `
    <div class="support-dialog-shell">
      <header class="support-dialog-header">
        <div><p>Ko-fi</p><h2 id="support-dialog-title">Buy me a coffee</h2></div>
        <button class="support-dialog-close" type="button" aria-label="Close donation dialog">×</button>
      </header>
      <div class="support-frame-wrap"></div>
      <p class="support-dialog-footer">Ko-fi loads only while this dialog is open. If the embed is unavailable, <a href="https://ko-fi.com/skick/" target="_blank" rel="noreferrer">open Ko-fi in a new tab</a>.</p>
    </div>`;
  document.body.append(dialog);

  const frameWrap = dialog.querySelector(".support-frame-wrap");
  const closeButton = dialog.querySelector(".support-dialog-close");
  let activeTrigger = null;

  function ensureFrame() {
    if (frameWrap.firstElementChild) return;
    const frame = document.createElement("iframe");
    frame.id = "kofiframe";
    frame.className = "support-frame";
    frame.src = supportUrl;
    frame.title = "Support Skick on Ko-fi";
    frame.loading = "lazy";
    frameWrap.append(frame);
  }

  for (const trigger of triggers) {
    trigger.addEventListener("click", () => {
      activeTrigger = trigger;
      ensureFrame();
      dialog.showModal();
      closeButton.focus();
    });
  }

  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    dialog.close();
  });
  dialog.addEventListener("close", () => activeTrigger?.focus());
}
