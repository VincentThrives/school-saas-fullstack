import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface Breadcrumb {
  label: string;
  link?: string;
}

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() breadcrumbs: Breadcrumb[] = [];

  @Input() actionLabel = '';
  @Input() actionIcon = '';
  @Input() actionLink = '';

  @Input() secondaryActionLabel = '';
  @Input() secondaryActionIcon = '';

  /** Optional third button that sits to the LEFT of the secondary
   *  action, same stroked style. Used for less-common page actions
   *  (e.g. the Students page's "Credentials" export) where the primary
   *  (Add) and secondary (Bulk Import) slots are already taken. */
  @Input() tertiaryActionLabel = '';
  @Input() tertiaryActionIcon = '';
  @Input() tertiaryActionDisabled = false;
  @Input() tertiaryActionTooltip = '';

  @Output() actionClick = new EventEmitter<void>();
  @Output() secondaryActionClick = new EventEmitter<void>();
  @Output() tertiaryActionClick = new EventEmitter<void>();

  get hasActions(): boolean {
    return !!this.actionLabel || !!this.secondaryActionLabel || !!this.tertiaryActionLabel;
  }

  onActionClick(): void {
    this.actionClick.emit();
  }

  onSecondaryActionClick(): void {
    this.secondaryActionClick.emit();
  }

  onTertiaryActionClick(): void {
    this.tertiaryActionClick.emit();
  }

  isLastBreadcrumb(index: number): boolean {
    return index === this.breadcrumbs.length - 1;
  }
}
