import { Directive, ElementRef, HostListener, NgZone } from '@angular/core';

/**
 * Click-and-drag to pan a scrollable container — used on the Timetable
 * grid where the row is wider than the viewport on smaller screens.
 *
 * <p>Browsers don't ship native drag-pan for div scrollers, only
 * touch-flick on mobile. On desktop you're stuck with the scrollbar.
 * For a 7-day timetable that often runs off-screen on a 1366×768
 * laptop, that scrollbar is hard to discover and slow to use. This
 * directive lets the admin click anywhere on the table and drag the
 * mouse to scroll horizontally + vertically — like every modern
 * canvas/map UI.</p>
 *
 * <p>Behaviour:</p>
 * <ul>
 *   <li>Left mouse button only — right-click stays for the browser menu.</li>
 *   <li>Drag is suppressed when the mousedown lands on an interactive
 *       element (input, button, select, mat-select, textarea, anchor)
 *       so editing cells in the Builder isn't hijacked.</li>
 *   <li>Cursor switches to "grab" / "grabbing" for affordance.</li>
 *   <li>{@code user-select: none} on the host element while dragging so
 *       text doesn't accidentally highlight as the user pans.</li>
 * </ul>
 *
 * <p>Listeners are registered outside Angular's zone so a fast drag
 * doesn't trigger a full change-detection cycle on every mousemove —
 * we only re-enter the zone if/when we modify scroll position
 * (browsers handle scroll natively without CD).</p>
 */
@Directive({
  selector: '[appDragScroll]',
  standalone: true,
})
export class DragScrollDirective {
  private isDown = false;
  private startX = 0;
  private startY = 0;
  private scrollLeftStart = 0;
  private scrollTopStart = 0;
  /** A tiny grace distance — under this we treat the gesture as a
   *  click, not a drag. Lets buttons and cells inside the scroller
   *  receive their click event normally when the user just taps. */
  private readonly DRAG_THRESHOLD_PX = 4;
  private dragMoved = false;

  /** Selectors whose mousedown we leave alone so editing controls in
   *  the Builder still work. */
  private static readonly INTERACTIVE_SELECTOR =
    'input, textarea, select, button, a, ' +
    'mat-select, mat-form-field, mat-option, mat-icon-button, ' +
    '[mat-button], [mat-icon-button], [mat-stroked-button], [mat-flat-button], ' +
    '[role="button"], [role="combobox"], [contenteditable="true"]';

  constructor(
    private el: ElementRef<HTMLElement>,
    private zone: NgZone,
  ) {
    // Idle cursor hint so the user knows the panel is drag-pannable.
    // Applied at construction time so it's visible before any interaction.
    this.el.nativeElement.style.cursor = 'grab';
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return; // left click only
    const target = event.target as HTMLElement | null;
    if (target && target.closest(DragScrollDirective.INTERACTIVE_SELECTOR)) {
      // Mousedown landed on something interactive — leave the gesture
      // to the control. Without this guard, dragging from a mat-select
      // would steal focus from the dropdown and panning would feel
      // weird in the Builder.
      return;
    }
    this.isDown = true;
    this.dragMoved = false;
    this.startX = event.pageX;
    this.startY = event.pageY;
    this.scrollLeftStart = this.el.nativeElement.scrollLeft;
    this.scrollTopStart = this.el.nativeElement.scrollTop;
    this.el.nativeElement.style.cursor = 'grabbing';
    this.el.nativeElement.style.userSelect = 'none';
    // Register move/up outside the zone — high-frequency events.
    this.zone.runOutsideAngular(() => {
      document.addEventListener('mousemove', this.onMouseMove, { passive: true });
      document.addEventListener('mouseup', this.onMouseUp, { passive: true });
    });
  }

  private onMouseMove = (event: MouseEvent): void => {
    if (!this.isDown) return;
    const dx = event.pageX - this.startX;
    const dy = event.pageY - this.startY;
    if (!this.dragMoved && Math.hypot(dx, dy) < this.DRAG_THRESHOLD_PX) return;
    this.dragMoved = true;
    // Drag is inverted: moving the mouse RIGHT pulls the content right
    // (so the scroller moves LEFT). Match the convention from Google
    // Maps / Figma / every other drag-pan UI.
    this.el.nativeElement.scrollLeft = this.scrollLeftStart - dx;
    this.el.nativeElement.scrollTop = this.scrollTopStart - dy;
  };

  private onMouseUp = (): void => {
    if (!this.isDown) return;
    this.isDown = false;
    this.el.nativeElement.style.cursor = 'grab';
    this.el.nativeElement.style.userSelect = '';
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    // If the user actually dragged, swallow the synthetic click that
    // browsers fire on mouseup. Without this, clicking a cell to edit
    // it after a panning drag would also trigger the click handler.
    if (this.dragMoved) {
      const swallow = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        document.removeEventListener('click', swallow, true);
      };
      document.addEventListener('click', swallow, true);
    }
  };
}
