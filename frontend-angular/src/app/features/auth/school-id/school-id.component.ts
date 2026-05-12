import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';

/**
 * NammaVidyalaya landing page — also serves as the multi-tenant entry
 * point. The original school-ID lookup form is preserved (same logic,
 * same submit handler, same auth.service call) and embedded inside the
 * hero section. Everything around it is new marketing UI.
 *
 * Sections, top to bottom:
 *   1. Sticky nav with glass blur on scroll
 *   2. Hero: animated heading + functional school-ID form + trust pills
 *   3. Features grid (6 cards, hover lift + glow)
 *   4. How it Works (3 columns: Schools / Teachers / Parents)
 *   5. App showcase (phone mockups)
 *   6. About Vincent Thrives Pvt Ltd
 *   7. Footer — "Powered by VINCENT THRIVES PRIVATE LIMITED"
 *
 * Animations are pure CSS + IntersectionObserver — no extra libraries,
 * keeps the bundle small.
 */
@Component({
  selector: 'app-school-id',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './school-id.component.html',
  styleUrl: './school-id.component.scss',
})
export class SchoolIdComponent implements OnInit, AfterViewInit, OnDestroy {
  // ── Functional state (preserved from original component) ─────
  schoolId = '';
  isLoading = false;
  errorMessage = '';

  // ── Landing state ────────────────────────────────────────────
  /** Letters of the hero title, split for staggered fade-in animation. */
  titleLetters: string[] = [];
  /** True once user has scrolled past ~80 px — toggles glass-blur on nav. */
  scrolled = false;
  /** Current year for footer copyright — auto-updates every Jan. */
  readonly year = new Date().getFullYear();

  @ViewChild('lpRoot', { static: false }) lpRoot?: ElementRef<HTMLElement>;

  /** Used by IntersectionObserver to add the `.lp--revealed` class as
   *  data-reveal elements enter the viewport. Disconnected in
   *  ngOnDestroy so we don't leak listeners on route change. */
  private revealObserver?: IntersectionObserver;

  // ── Content (static — could be moved to a config file later) ─

  /** 6 feature cards. Icons are Material Icon ligature names. */
  readonly features = [
    {
      icon: 'event_available',
      title: 'Real-time Attendance',
      desc: 'Teachers mark attendance in seconds; parents get instant alerts the moment a child is marked absent.',
    },
    {
      icon: 'school',
      title: 'Exam Results & Reports',
      desc: 'Enter marks once, publish to every parent and student via the app and SMS in a single click.',
    },
    {
      icon: 'notifications_active',
      title: 'SMS + Push Notifications',
      desc: 'TRAI-compliant transactional SMS for absence alerts, results, and school notices — plus app push.',
    },
    {
      icon: 'groups',
      title: 'Multi-Class Management',
      desc: 'Handle every class, section, subject, and teacher assignment from one clean admin dashboard.',
    },
    {
      icon: 'family_restroom',
      title: 'Parent Communication',
      desc: 'A dedicated parent portal — see attendance, exam results, fees, and PTM schedules at a glance.',
    },
    {
      icon: 'verified_user',
      title: 'Secure & DLT Compliant',
      desc: 'TRAI Principal Entity registered, JWT auth, role-based access control, multi-tenant isolation.',
    },
  ];

  /** 3 columns in the "How it Works" section. */
  readonly roles = [
    {
      title: 'For Schools',
      items: [
        'Onboard in minutes with a single School ID',
        'Manage classes, sections, subjects, and staff',
        'Publish exam results and notices in one click',
        'Audit trail and reports for every action',
      ],
    },
    {
      title: 'For Teachers',
      items: [
        'Mark daily attendance from any device',
        'Enter exam marks in batch — no spreadsheets',
        'Send class-wide or per-student notifications',
        'Generate report cards and performance trends',
      ],
    },
    {
      title: 'For Parents',
      items: [
        'Get absence alerts within minutes',
        'See exam results the moment they are published',
        'Receive school notices via push and SMS',
        'Multiple children, one account',
      ],
    },
  ];

  /** Phone mockups for the app showcase. Tiny stylised previews —
   *  we'll swap to real screenshots later. `angle` is the CSS rotation
   *  in degrees so the trio fans out slightly. */
  readonly phoneScreens = [
    {
      label: 'Attendance',
      angle: '-3',
      bg: 'linear-gradient(160deg, #0F2027 0%, #203A43 60%, #2C5364 100%)',
      title: 'Today, Class 8A',
      rows: [
        { color: '#22c55e', text: '28 students marked present' },
        { color: '#ef4444', text: 'Ravi K. — absent' },
        { color: '#ef4444', text: 'Priya S. — absent' },
        { color: '#f59e0b', text: 'Anil M. — late by 12 min' },
      ],
    },
    {
      label: 'Exam Results',
      angle: '0',
      bg: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)',
      title: 'Mid-Term Results',
      rows: [
        { color: '#D4A843', text: 'Maths — 92 / 100 (A+)' },
        { color: '#D4A843', text: 'Science — 87 / 100 (A)' },
        { color: '#D4A843', text: 'English — 78 / 100 (B+)' },
        { color: '#E8C97A', text: 'Total: 522 / 600 (87.0%)' },
      ],
    },
    {
      label: 'Notifications',
      angle: '3',
      bg: 'linear-gradient(160deg, #2d1b69 0%, #11052c 100%)',
      title: 'Notifications',
      rows: [
        { color: '#a78bfa', text: 'New result published' },
        { color: '#22c55e', text: 'Holiday declared — 15 Aug' },
        { color: '#f59e0b', text: 'PTM scheduled — Friday' },
        { color: '#ef4444', text: 'Fee due reminder' },
      ],
    },
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    // Pre-split the hero title once so the template can iterate cleanly
    // and apply per-letter animation-delay via [style.animation-delay].
    this.titleLetters = 'Namma Vidyalaya'.split('');
  }

  ngAfterViewInit(): void {
    this.installRevealObserver();
  }

  ngOnDestroy(): void {
    this.revealObserver?.disconnect();
  }

  // ── Functional submit handler (UNCHANGED from original) ──────

  onSubmit(): void {
    if (!this.schoolId.trim() || this.isLoading) return;

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.resolveTenant({ schoolId: this.schoolId.trim() }).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.router.navigate(['/login/credentials']);
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage =
          err?.error?.message || 'School not found. Please check your School ID.';
      },
    });
  }

  // ── Landing UI interactions ──────────────────────────────────

  /** Toggle the nav's glass-blur class once the user scrolls past
   *  the hero. 80 px is a comfortable threshold — fires after the
   *  scroll feels intentional, not on micro-scrolls. */
  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.scrolled = window.scrollY > 80;
  }

  /** Smooth-scroll to in-page anchors (Features / How / About / Hero)
   *  without triggering a route change. */
  scrollTo(event: Event, sectionId: string): void {
    event.preventDefault();
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Cursor-driven radial glow in the hero. Reads mouse position
   *  relative to the hero, writes two CSS custom properties so the
   *  ::before pseudo-element can render the glow. Cheap — no JS
   *  re-renders, all the visual work happens in CSS. */
  onHeroMouseMove(event: MouseEvent): void {
    const hero = event.currentTarget as HTMLElement;
    const rect = hero.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    hero.style.setProperty('--mx', `${x}%`);
    hero.style.setProperty('--my', `${y}%`);
  }

  /** Watches all [data-reveal] elements in the page and adds the
   *  `lp--revealed` class when they enter the viewport. The CSS does
   *  the actual fade-in + translate. Threshold 0.12 means the element
   *  only animates once ~12% of it is visible — feels less twitchy
   *  than 0.0 which fires on the slightest peek. */
  private installRevealObserver(): void {
    if (typeof IntersectionObserver === 'undefined') return;

    this.revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('lp--revealed');
            this.revealObserver?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' },
    );

    const targets = document.querySelectorAll('[data-reveal]');
    targets.forEach((t) => this.revealObserver!.observe(t));
  }
}
