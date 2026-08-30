import { Component, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { scrollToFirstInvalid } from '../../../shared/utils/form-scroll';
import { ApiService } from '../../../core/services/api.service';
import { SchoolClass, EmployeeRole, UserRole } from '../../../core/models';

@Component({
  selector: 'app-teacher-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './teacher-form.component.html',
  styleUrl: './teacher-form.component.scss',
})
export class TeacherFormComponent implements OnInit {
  employeeForm!: FormGroup;
  isEditing = false;
  teacherId: string | null = null;
  isLoading = false;
  isSaving = false;

  classes: SchoolClass[] = [];

  employeeRoles: { value: EmployeeRole; label: string }[] = [
    { value: 'TEACHER', label: 'Teacher' },
    { value: 'ACCOUNTANT', label: 'Accountant' },
    { value: 'CLERK', label: 'Clerk' },
    { value: 'PRINCIPAL', label: 'Principal' },
    { value: 'HEAD_MISTRESS', label: 'Head Mistress' },
    { value: 'LAB_ASSISTANT', label: 'Lab Assistant' },
    { value: 'NON_TEACHING', label: 'Non-Teaching Staff' },
    // Picking School Coordinator here also creates the linked
    // User account with the SCHOOL_COORDINATOR login role (mapped
    // in TeacherController.autoCreateUserForEmployee). The sidenav
    // modules the coordinator sees are governed by the tenant-level
    // Coordinator Access page.
    { value: 'COORDINATOR', label: 'School Coordinator' },
  ];

  /**
   * Additional login roles the admin can grant to the auto-created User
   * account beyond the one mapped from {@code employeeRole}. Typical
   * case: a Principal who also runs HR — tick HR here and the linked
   * User ends up with {@code roles: [PRINCIPAL, HR]}, top-bar role
   * switcher chip appears, admin flips hats without re-login.
   *
   * <p>SCHOOL_ADMIN and HR are the two that make sense to grant
   * additively. TEACHER / PRINCIPAL / SCHOOL_COORDINATOR are already
   * handled by the employeeRole (designation) dropdown above.</p>
   */
  /**
   * Every login role the admin can grant to an employee's linked User
   * account on top of the designation-mapped primary role. Kept broad
   * so a single Principal-Employee record can carry a full stack of
   * hats (Principal + HR + Admin + Teacher) with the top-bar switcher
   * doing the day-to-day toggling.
   *
   * <p>Deliberately excluded: {@code SUPER_ADMIN} (cross-tenant, unsafe
   * to grant from a tenant admin), {@code STUDENT} / {@code PARENT}
   * (semantic mismatch — an employee record isn't a student).</p>
   *
   * <p>The primary role auto-mapped from the designation dropdown is
   * still shown here — picking it is a harmless no-op (backend dedupes
   * the merged role set), so the admin doesn't have to remember which
   * role is "already covered by the designation".</p>
   */
  additionalLoginRoles: { value: UserRole; label: string; hint: string }[] = [
    { value: UserRole.SCHOOL_ADMIN,       label: 'School Admin',       hint: 'Full admin powers (Manage Users, Configuration, etc).' },
    { value: UserRole.PRINCIPAL,          label: 'Principal',          hint: 'Principal-level access (reports, dashboards).' },
    { value: UserRole.TEACHER,            label: 'Teacher',            hint: 'Class marking, timetable, subject reports.' },
    { value: UserRole.SCHOOL_COORDINATOR, label: 'School Coordinator', hint: 'Delegated coordinator role gated by the Coordinator Access page.' },
    { value: UserRole.HR,                 label: 'HR / Payroll',       hint: 'Sees the HR module (attendance, leaves, payslips).' },
  ];

  /** Extra login roles the admin has picked in the multi-select dropdown.
   *  Persisted on Teacher.additionalRoles and pushed onto the linked
   *  User.roles by the backend. Array (not Set) so mat-select's
   *  [multiple] binding works out of the box. */
  selectedAdditionalRoles: UserRole[] = [];

  /** Comma-joined friendly labels for the currently-picked additional
   *  roles — used in the mat-select-trigger so admins see "HR / Payroll,
   *  Principal" instead of the raw enum keys "HR, PRINCIPAL". */
  get selectedAdditionalRolesLabel(): string {
    if (!this.selectedAdditionalRoles.length) return '';
    return this.selectedAdditionalRoles
      .map(v => this.additionalLoginRoles.find(r => r.value === v)?.label ?? String(v))
      .join(', ');
  }

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
    private hostEl: ElementRef<HTMLElement>,
  ) {}

  /** Datepicker bounds for DOB / Joining Date.
   *  - max  = today (no future dates allowed)
   *  - DOB startAt = ~30 years ago so the multi-year picker opens near a
   *    plausible employee birth year. */
  todayForDob: Date = new Date();
  dobStartAt: Date = new Date(new Date().getFullYear() - 30, 0, 1);

  ngOnInit(): void {
    this.teacherId = this.route.snapshot.paramMap.get('teacherId');
    this.isEditing = !!this.teacherId && this.teacherId !== 'new';

    this.employeeForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: [''],
      phone: [''],
      employeeId: ['', Validators.required],
      employeeRole: ['TEACHER', Validators.required],
      qualification: [''],
      specialization: [''],
      // DOB is required — login password is derived from `firstName@<birthYear>`.
      dateOfBirth: ['', Validators.required],
      joiningDate: [''],
      isClassTeacher: [false],
      classTeacherOfClassId: [''],
      classTeacherOfSectionId: [''],
      // Address
      street: [''],
      city: [''],
      state: [''],
      country: [''],
      zip: [''],
    });

    this.api.getClasses().subscribe({
      next: (res) => {
        this.classes = Array.isArray(res.data) ? res.data : [];
        if (this.isEditing) this.loadEmployeeData();
      },
    });
  }

  get pageTitle(): string {
    return this.isEditing ? 'Edit Employee' : 'Add Employee';
  }

  get isTeacherRole(): boolean {
    return this.employeeForm.get('employeeRole')?.value === 'TEACHER';
  }

  get isClassTeacherChecked(): boolean {
    return this.employeeForm.get('isClassTeacher')?.value;
  }

  get classTeacherSections(): { sectionId: string; name: string }[] {
    const classId = this.employeeForm.get('classTeacherOfClassId')?.value;
    const cls = this.classes.find(c => c.classId === classId);
    return cls?.sections || [];
  }

  loadEmployeeData(): void {
    if (!this.teacherId) return;
    this.isLoading = true;
    this.api.getTeacherById(this.teacherId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const t = res.data;
          const addr = (t as any).address || {};
          this.employeeForm.patchValue({
            firstName: t.firstName || '',
            lastName: t.lastName || '',
            email: t.email || '',
            phone: t.phone || '',
            employeeId: t.employeeId || '',
            employeeRole: t.employeeRole || 'TEACHER',
            qualification: t.qualification || '',
            specialization: t.specialization || '',
            dateOfBirth: t.dateOfBirth || '',
            joiningDate: t.joiningDate || t.joinDate || '',
            isClassTeacher: t.isClassTeacher || t.classTeacher || false,
            classTeacherOfClassId: t.classTeacherOfClassId || '',
            classTeacherOfSectionId: t.classTeacherOfSectionId || '',
            street: addr.street || '',
            city: addr.city || '',
            state: addr.state || '',
            country: addr.country || '',
            zip: addr.zip || '',
          });

          // Class-subject assignments are now managed on the Teacher Assignments page (per-year).
          // Seed the multi-role picker from the persisted list; legacy
          // employees (before the field existed) come back with null / []
          // and the picker starts empty. Guard against unknown values
          // so a stale enum entry can't crash the mat-select binding.
          const validValues = new Set(this.additionalLoginRoles.map(r => r.value));
          const extras: string[] = (t as any).additionalRoles || [];
          this.selectedAdditionalRoles = extras.filter(
            r => validValues.has(r as UserRole),
          ) as UserRole[];
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.snackBar.open('Failed to load employee data', 'Close', { duration: 3000 });
      },
    });
  }

  onSubmit(): void {
    if (this.employeeForm.invalid) {
      scrollToFirstInvalid(this.hostEl, this.employeeForm);
      this.snackBar.open('Please fill the highlighted required fields', 'Close', { duration: 3000 });
      return;
    }

    this.isSaving = true;
    const formData = this.employeeForm.value;

    const payload: any = {
      // Normalise to Title Case on save so "kan" -> "Kan", "MAITHRI shree"
      // -> "Maithri Shree". Stored consistently regardless of how the
      // admin happened to type it. Multi-word names are handled per word
      // so compound first names ("Mary Ann") and double surnames
      // ("Reddy Gowda") render correctly.
      firstName: this.toTitleCase(formData.firstName),
      lastName: this.toTitleCase(formData.lastName),
      email: formData.email || null,
      phone: formData.phone || null,
      employeeId: formData.employeeId,
      employeeRole: formData.employeeRole,
      // Multi-role: extra login roles admin picked in the "Additional
      // login roles" multi-select. Backend merges these with the
      // designation-mapped primary role onto User.roles so the
      // employee sees a top-bar switcher chip when set.
      additionalRoles: [...this.selectedAdditionalRoles],
      qualification: formData.qualification || null,
      specialization: formData.specialization || null,
      classTeacher: formData.isClassTeacher || false,
      classTeacherOfClassId: formData.classTeacherOfClassId || null,
      classTeacherOfSectionId: formData.classTeacherOfSectionId || null,
      // classSubjectAssignments intentionally omitted — managed via the
      // dedicated Teacher Assignments page (per-academic-year).
      address: {
        street: formData.street || '',
        city: formData.city || '',
        state: formData.state || '',
        country: formData.country || '',
        zip: formData.zip || '',
      },
    };
    // Only send dates if they have a value (avoid sending empty string to
    // LocalDate). mat-datepicker hands us a Date object; the backend's
    // LocalDate expects an ISO "yyyy-MM-dd" string. Build it from local
    // Y/M/D components — toISOString() shifts to UTC and can roll the day.
    const fmt = (v: any): string | null => {
      if (!v) return null;
      if (v instanceof Date) {
        return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
      }
      return v;
    };
    const dobStr = fmt(formData.dateOfBirth);
    const joinStr = fmt(formData.joiningDate);
    if (dobStr) payload.dateOfBirth = dobStr;
    if (joinStr) payload.joiningDate = joinStr;

    const request$ = this.isEditing && this.teacherId
      ? this.api.updateTeacher(this.teacherId, payload)
      : this.api.createTeacher(payload);

    request$.subscribe({
      next: () => {
        this.isSaving = false;
        this.snackBar.open(
          this.isEditing ? 'Employee updated successfully' : 'Employee created successfully',
          'Close', { duration: 3000 }
        );
        this.router.navigate(['/employees']);
      },
      error: (err) => {
        this.isSaving = false;
        console.error('Save employee error:', err);
        const msg = err?.error?.message || err?.statusText || 'Failed to save employee';
        this.snackBar.open(msg, 'Close', { duration: 5000 });
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/employees']);
  }

  /**
   * Title-case a name field — first letter of each whitespace-delimited
   * word uppercased, rest lowercased.
   *
   * <p>Why on save (not on blur): mutating the input mid-typing surprises
   * users typing "MC" deliberately, and a school admin pasting a name
   * shouldn't watch it change shape. Format at submit and the form value
   * stays exactly as typed until commit.</p>
   *
   * <p>Edge cases that stay simple by design — we don't try to preserve
   * "McDonald" / "O'Brien" / "van der Berg" specially. Indian school
   * staff names are overwhelmingly space-separated, no apostrophes, no
   * particles, so the naive transform is correct for ~99% of real input.
   * Admins can manually edit the rare exception.</p>
   */
  private toTitleCase(value: any): string {
    if (value == null) return '';
    const trimmed = String(value).trim();
    if (!trimmed) return '';
    return trimmed
      .toLowerCase()
      .split(/\s+/)
      .map(w => w.length ? w.charAt(0).toUpperCase() + w.slice(1) : w)
      .join(' ');
  }
}
