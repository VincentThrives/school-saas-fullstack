import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-placeholder',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  template: `
    <div class="placeholder-container">
      <mat-card appearance="outlined" class="placeholder-card">
        <mat-card-content>
          <mat-icon class="placeholder-icon">construction</mat-icon>
          <h1 class="placeholder-title">{{ title }}</h1>
          <p class="placeholder-text">Coming Soon</p>
          <p class="placeholder-subtext">This feature is currently under development. Check back later!</p>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .placeholder-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: calc(100vh - 200px);
      padding: 24px;
    }
    .placeholder-card {
      text-align: center;
      padding: 48px 40px;
      border-radius: 16px;
      max-width: 480px;
      width: 100%;
    }
    .placeholder-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #D4A843;
      margin-bottom: 16px;
    }
    .placeholder-title {
      font-size: 28px;
      font-weight: 600;
      color: #333;
      margin: 0 0 8px;
    }
    .placeholder-text {
      font-size: 20px;
      font-weight: 500;
      color: #D4A843;
      margin: 0 0 8px;
    }
    .placeholder-subtext {
      font-size: 14px;
      color: #999;
      margin: 0;
    }
  `]
})
export class PlaceholderComponent implements OnInit {
  title = 'Page';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      this.title = data['title'] || 'Page';
    });
  }
}
