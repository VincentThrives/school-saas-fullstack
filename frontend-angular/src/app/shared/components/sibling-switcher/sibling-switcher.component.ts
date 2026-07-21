import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { UserRole } from '../../../core/models';

interface SiblingRow {
  studentId: string;
  userId: string;
  fullName: string;
  rollNumber: string | null;
  className: string | null;
  sectionName: string | null;
}

/**
 * Header widget — "Switch student" menu for parents whose single
 * phone number is the login for multiple children.
 *
 * <p>Visible only when the current user is a STUDENT (or PARENT) AND
 * the backend returned at least one sibling with a matching
 * parentPhone. Staff / admin / principal accounts see nothing.</p>
 *
 * <p>On tap the menu triggers {@code POST /auth/switch-to-sibling},
 * feeds the fresh token pair into AuthService, then reloads the
 * current route so every screen re-fetches for the new child.</p>
 */
@Component({
  selector: 'app-sibling-switcher',
  standalone: true,
  imports: [
    CommonModule,
    MatMenuModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './sibling-switcher.component.html',
  styleUrl: './sibling-switcher.component.scss',
})
export class SiblingSwitcherComponent implements OnInit {
  siblings: SiblingRow[] = [];
  isSwitching = false;
  currentName = '';

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    // Only student / parent sessions ever have siblings under a
    // shared parentPhone. Skipping the fetch for staff avoids a
    // pointless round-trip on every admin page load.
    const role = this.auth.currentRole;
    if (role !== UserRole.STUDENT && role !== UserRole.PARENT) return;
    this.currentName = this.displayName(this.auth.currentUser);
    this.loadSiblings();
  }

  private loadSiblings(): void {
    this.api.getSiblings().subscribe({
      next: (res) => { this.siblings = (res?.data as SiblingRow[]) || []; },
      error: () => { this.siblings = []; },
    });
  }

  siblingLabel(s: SiblingRow): string {
    const bits: string[] = [];
    if (s.className) {
      bits.push(s.className + (s.sectionName ? ' ' + s.sectionName : ''));
    }
    if (s.rollNumber) bits.push('Roll ' + s.rollNumber);
    return bits.join(' · ');
  }

  initial(name: string): string {
    const t = (name || '').trim();
    return t ? t.charAt(0).toUpperCase() : '?';
  }

  switchTo(s: SiblingRow): void {
    if (this.isSwitching) return;
    this.isSwitching = true;
    this.api.switchToSibling(s.studentId).subscribe({
      next: (res) => {
        const auth = res?.data;
        if (!auth?.accessToken) {
          this.isSwitching = false;
          this.snackBar.open('Switch failed — try again.', 'Close', { duration: 3000 });
          return;
        }
        this.auth.applyAuthResponse(auth);
        this.currentName = this.displayName(auth.user);
        this.loadSiblings();
        this.reloadCurrentRoute();
        this.isSwitching = false;
        this.snackBar.open('Signed in as ' + this.currentName, 'Close', { duration: 2500 });
      },
      error: (err) => {
        this.isSwitching = false;
        this.snackBar.open(
            err?.error?.message || 'Could not switch student.',
            'Close', { duration: 3500 });
      },
    });
  }

  private displayName(u: any): string {
    if (!u) return '';
    const first = (u.firstName || '').trim();
    const last = (u.lastName || '').trim();
    const joined = (first + ' ' + last).trim();
    return joined || u.email || '';
  }

  /** Send the user to /dashboard so every page re-resolves from the
   *  newly-signed-in student's scope.
   *
   *  <p>Rebounding to the SAME url the user was on worked for pages
   *  that read their scope from AuthService (dashboard, notifications,
   *  homework), but broke on pages that read {@code classId} /
   *  {@code sectionId} / {@code academicYearId} from query params —
   *  e.g. My Timetable's URL is
   *  {@code /timetable/view?classId=…&sectionId=…}. On switch we'd
   *  reload that exact URL and the timetable component would still
   *  render the OLD student's class because the params are stale.
   *  Landing back on /dashboard side-steps that entire class of bug
   *  — every widget starts fresh with the new user's identity — and
   *  matches the mental model of "you just switched student, take me
   *  home".</p>
   *
   *  <p>Two-hop navigate through a throwaway URL with
   *  {@code skipLocationChange:true} so Angular's RouteReuseStrategy
   *  can't hand back a cached component — otherwise the target
   *  dashboard's ngOnInit might not re-fire if the user was already
   *  on /dashboard when they hit switch.</p> */
  private reloadCurrentRoute(): void {
    this.router.navigateByUrl('/__switch_reload__', { skipLocationChange: true })
      .catch(() => { /* nothing routed to __switch_reload__; that's the point */ })
      .finally(() => {
        this.router.navigateByUrl('/dashboard')
          .catch(() => { /* nav aborted — ignore */ });
      });
  }
}
