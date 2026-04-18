import { ElementRef } from '@angular/core';
import { AbstractControl, FormGroup } from '@angular/forms';

/**
 * Mark every control as touched, then scroll the first invalid form control
 * into view and focus it. Works for Reactive Forms where fields are bound
 * with `formControlName`. Safe to call from any component — pass the component's
 * own ElementRef and FormGroup.
 *
 *   this.scrollToFirstInvalid(this.hostEl, this.form);
 */
export function scrollToFirstInvalid(
  hostEl: ElementRef<HTMLElement> | null | undefined,
  form: FormGroup | null | undefined,
): boolean {
  if (!form || !hostEl?.nativeElement) return false;

  // Ensure red error state is painted before we scroll.
  form.markAllAsTouched();

  const root = hostEl.nativeElement;

  // Walk elements with a bound formControlName in DOM (reading) order.
  const controls = Array.from(root.querySelectorAll<HTMLElement>('[formcontrolname]'));
  for (const el of controls) {
    const name = el.getAttribute('formcontrolname');
    if (!name) continue;
    const control: AbstractControl | null = form.get(name);
    if (!control || control.valid || control.disabled) continue;

    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const focusable = el.querySelector<HTMLElement>(
        'input, textarea, select, [tabindex]:not([tabindex="-1"]), .mat-mdc-select',
      );
      focusable?.focus?.();
    }, 0);
    return true;
  }
  return false;
}
