import { Directive, ElementRef, HostListener, Input } from '@angular/core';

/**
 * Keyboard-grid navigation for any container holding {@code <input>}
 * elements that read like a 2-D table — Enter Marks being the
 * motivating case. Teachers entering marks for 50 students were
 * having to click each cell with the mouse; this lets them tab
 * through using the arrow keys + Enter the way Excel does.
 *
 * <p>Usage:</p>
 * <pre>{@code
 *   <table appGridNav [gridNavCols]="examComponents.length + 1">
 *     ...inputs...
 *   </table>
 * }</pre>
 *
 * <p>Bindings:</p>
 * <ul>
 *   <li>{@code gridNavCols} — number of input cells per row. Needed to
 *       turn the flat DOM order into a 2-D grid (Down = +cols,
 *       Right = +1, etc.). Defaults to 1 (single column).</li>
 * </ul>
 *
 * <p>Key map:</p>
 * <ul>
 *   <li>{@code Enter} / {@code ArrowDown} — same column, next row</li>
 *   <li>{@code ArrowUp} — same column, previous row</li>
 *   <li>{@code ArrowRight} — next cell in DOM order (wraps to next row)</li>
 *   <li>{@code ArrowLeft} — previous cell in DOM order</li>
 * </ul>
 *
 * <p>For {@code type="number"} inputs the browser's default
 * ArrowUp/Down handler increments/decrements the value — we
 * {@code preventDefault} so navigation wins instead. Up/Down on a text
 * input would just move the caret which is harmless either way; we
 * still take it for navigation.</p>
 *
 * <p>On focus shift we {@code .select()} the destination so the next
 * keystroke replaces the existing value — the common case when a
 * teacher is correcting a quickly-typed mark.</p>
 */
@Directive({
  selector: '[appGridNav]',
  standalone: true,
})
export class GridNavDirective {
  /** Number of input cells per logical row. */
  @Input('gridNavCols') cols = 1;

  constructor(private el: ElementRef<HTMLElement>) {}

  @HostListener('keydown', ['$event'])
  onKeyDown(ev: KeyboardEvent): void {
    const target = ev.target as HTMLElement | null;
    if (!target || target.tagName !== 'INPUT') return;

    // Don't hijack modifier-combos (Ctrl+Z to undo, Shift+Tab, etc.).
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

    const key = ev.key;
    const navKeys = ['Enter', 'ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'];
    if (!navKeys.includes(key)) return;

    // Skip if the directive is on a container with no inputs at all.
    const inputs = Array.from(
      this.el.nativeElement.querySelectorAll<HTMLInputElement>('input')
    ).filter((el) => !el.disabled && el.type !== 'hidden' && el.type !== 'checkbox' && el.type !== 'radio');
    if (inputs.length === 0) return;

    const i = inputs.indexOf(target as HTMLInputElement);
    if (i < 0) return;

    const cols = Math.max(1, this.cols | 0);
    let next = -1;

    switch (key) {
      case 'Enter':
      case 'ArrowDown':
        next = i + cols;
        break;
      case 'ArrowUp':
        next = i - cols;
        break;
      case 'ArrowRight':
        next = i + 1;
        break;
      case 'ArrowLeft':
        next = i - 1;
        break;
    }

    if (next < 0 || next >= inputs.length) {
      // Boundary reached — swallow the keystroke so a number input
      // doesn't bump its value as a fallback behaviour, but don't
      // refocus anywhere. Lets the teacher know they're at the edge.
      ev.preventDefault();
      return;
    }

    ev.preventDefault();
    const dest = inputs[next];
    dest.focus();
    // Highlight existing text so the next keystroke replaces it.
    try { dest.select(); } catch { /* some input types don't support select */ }
  }
}
