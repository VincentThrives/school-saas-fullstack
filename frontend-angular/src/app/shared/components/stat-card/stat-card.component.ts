import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './stat-card.component.html',
  styleUrl: './stat-card.component.scss',
})
export class StatCardComponent {
  @Input() title = '';
  @Input() value: string | number = 0;
  @Input() icon = '';
  @Input() color: 'primary' | 'info' | 'success' | 'warning' | 'error' = 'primary';
  @Input() subtitle = '';
  @Input() trend?: { value: number; label?: string };
  @Input() delay = 0;

  get colorClass(): string {
    return `stat-card--${this.color}`;
  }

  get trendDirection(): string {
    if (!this.trend) return '';
    return this.trend.value >= 0 ? 'up' : 'down';
  }

  get trendValue(): number {
    return this.trend ? Math.abs(this.trend.value) : 0;
  }
}
