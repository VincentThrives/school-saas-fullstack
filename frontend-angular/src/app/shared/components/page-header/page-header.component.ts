import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface Breadcrumb {
  label: string;
  link?: string;
}

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule],
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

  @Output() actionClick = new EventEmitter<void>();
  @Output() secondaryActionClick = new EventEmitter<void>();

  get hasActions(): boolean {
    return !!this.actionLabel || !!this.secondaryActionLabel;
  }

  onActionClick(): void {
    this.actionClick.emit();
  }

  onSecondaryActionClick(): void {
    this.secondaryActionClick.emit();
  }

  isLastBreadcrumb(index: number): boolean {
    return index === this.breadcrumbs.length - 1;
  }
}
