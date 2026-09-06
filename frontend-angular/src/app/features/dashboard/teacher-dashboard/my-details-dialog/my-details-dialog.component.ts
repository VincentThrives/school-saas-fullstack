import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

/**
 * "My Details" launcher popup — a tiny grid of tiles that each
 * route to one of the employee-personal pages currently grouped
 * under "My Details" in the sidebar (My Attendance, My Profile).
 *
 * <p>The teacher dashboard renders a single "My Details" card to
 * open this popup rather than surfacing every sub-page as its own
 * dashboard card — that would inflate the header row from 4 to 6+
 * cards and dilute the stat-value visual language.</p>
 *
 * <p>Kept as a standalone dialog (not a menu) so we get one canonical
 * popup pattern across role dashboards — HR uses the same shape for
 * its "Quick actions" chips, and a menu wouldn't render the tile
 * layout the user asked for.</p>
 */
interface DetailTile {
  title: string;
  hint: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-my-details-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule],
  templateUrl: './my-details-dialog.component.html',
  styleUrl: './my-details-dialog.component.scss',
})
export class MyDetailsDialogComponent {

  readonly tiles: DetailTile[] = [
    {
      title: 'My Attendance',
      hint: 'View your monthly attendance calendar and submit regularization requests.',
      icon: 'how_to_reg',
      route: '/hr/attendance/my',
    },
    {
      title: 'My Profile',
      hint: 'View and edit your personal details, contact info, and login preferences.',
      icon: 'person',
      route: '/profile',
    },
  ];

  constructor(
    private router: Router,
    private ref: MatDialogRef<MyDetailsDialogComponent>,
  ) {}

  goTo(route: string): void {
    this.ref.close();
    this.router.navigateByUrl(route);
  }

  close(): void {
    this.ref.close();
  }
}
