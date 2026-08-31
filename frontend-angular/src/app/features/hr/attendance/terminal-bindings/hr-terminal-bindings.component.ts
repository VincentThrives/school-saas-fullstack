import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';

/**
 * Placeholder for the Employee ↔ Terminal user-id bindings page.
 *
 * <p>The real implementation lives in Phase 1b — needs:</p>
 * <ul>
 *   <li>Backend {@code EmployeeTerminalBinding} collection + repo +
 *       service + REST controller</li>
 *   <li>Frontend list + create-form (pick terminal → enter terminal
 *       user id → pick employee → save)</li>
 *   <li>Wire {@code AttendanceScanService} to route scans matching
 *       an employee binding to {@code EmployeeAttendanceService}
 *       instead of the student attendance path</li>
 * </ul>
 *
 * <p>Ships now as a static "coming next" card so the "Set up
 * bindings" button on the Settings page doesn't 404. Route in
 * app.routes.ts is gated to the HR role.</p>
 */
@Component({
  selector: 'app-hr-terminal-bindings',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatCardModule, MatIconModule, MatButtonModule,
    PageHeaderComponent,
  ],
  templateUrl: './hr-terminal-bindings.component.html',
  styleUrl: './hr-terminal-bindings.component.scss',
})
export class HrTerminalBindingsComponent {}
