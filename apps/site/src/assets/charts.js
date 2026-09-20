// Research-log charts: a readout that follows the pointer and the focus ring.
//
// Every mark is already a tab stop carrying its own label, so a screen reader and a keyboard can
// read the chart without this file. What this adds is the thing a sighted reader expects — hover a
// point, see its numbers — done once per figure rather than through the browser's native <title>
// tooltip, which appears after a second, can't be styled, and never appears for a keyboard at all.
(() => {
  const figures = [...document.querySelectorAll("figure.chart")];
  if (!figures.length) return;

  for (const figure of figures) {
    const readout = figure.querySelector(".chart-readout");
    const marks = [...figure.querySelectorAll(".chart-mark")];
    if (!readout || !marks.length) return;

    const show = (mark) => {
      readout.textContent = mark.dataset.readout;
      figure.dataset.active = mark.dataset.series ?? "";
      for (const other of marks) other.classList.toggle("is-quiet", !!mark.dataset.series && other.dataset.series !== mark.dataset.series);
      mark.classList.add("is-active");
    };
    const clear = () => {
      readout.textContent = "";
      delete figure.dataset.active;
      for (const other of marks) other.classList.remove("is-quiet", "is-active");
    };

    for (const mark of marks) {
      // pointerenter rather than mouseover: one event per mark, and it ignores touch scrolling.
      mark.addEventListener("pointerenter", () => show(mark));
      mark.addEventListener("focus", () => show(mark));
      mark.addEventListener("blur", clear);
      // A tap should read the mark out rather than do nothing.
      mark.addEventListener("click", () => show(mark));
    }
    figure.addEventListener("pointerleave", clear);
    // Arrow keys walk the marks, so a chart is one tab stop to enter and then a list to read.
    figure.addEventListener("keydown", (e) => {
      const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!step) return;
      const at = marks.indexOf(document.activeElement);
      if (at === -1) return;
      e.preventDefault();
      marks[(at + step + marks.length) % marks.length].focus();
    });
  }
})();
