import { Component, ElementRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { scrollToFirstInvalid } from '../../../shared/utils/form-scroll';
import { ApiService } from '../../../core/services/api.service';
import { CreateTenantRequest } from '../../../core/models';

@Component({
  selector: 'app-tenant-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    PageHeaderComponent,
  ],
  templateUrl: './tenant-form.component.html',
  styleUrl: './tenant-form.component.scss',
})
export class TenantFormComponent implements OnInit {
  tenantForm!: FormGroup;
  isSaving = false;

  plans = [
    { value: 'BASIC', label: 'Basic', description: 'Essential features for small schools' },
    { value: 'STANDARD', label: 'Standard', description: 'Advanced features for growing schools' },
    { value: 'ENTERPRISE', label: 'Enterprise', description: 'Full feature set with premium support' },
  ];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private router: Router,
    private snackBar: MatSnackBar,
    private hostEl: ElementRef<HTMLElement>,
  ) {}

  ngOnInit(): void {
    this.tenantForm = this.fb.group({
      schoolName: ['', Validators.required],
      subdomain: ['', [Validators.required, Validators.pattern(/^[a-z0-9]+(-[a-z0-9]+)*$/)]],
      contactEmail: ['', [Validators.required, Validators.email]],
      contactPhone: [''],
      plan: ['STANDARD', Validators.required],
      logoUrl: [''],
      address: this.fb.group({
        street: [''],
        city: [''],
        state: [''],
        country: [''],
        zip: [''],
      }),
      adminEmail: ['', [Validators.required, Validators.email]],
      adminPassword: ['', [Validators.required, Validators.minLength(8)]],
      adminFirstName: ['', Validators.required],
      adminLastName: ['', Validators.required],
    });
  }

  onSubmit(): void {
    if (this.tenantForm.invalid) {
      scrollToFirstInvalid(this.hostEl, this.tenantForm);
      this.snackBar.open('Please fill the highlighted required fields', 'Close', { duration: 3000 });
      return;
    }

    this.isSaving = true;
    const formData: CreateTenantRequest = this.tenantForm.getRawValue();

    this.apiService.createTenant(formData).subscribe({
      next: () => {
        this.snackBar.open('School registered successfully', 'Close', { duration: 3000 });
        this.router.navigate(['/superadmin/tenants']);
      },
      error: (err) => {
        const msg = err?.error?.message || 'Failed to register school';
        this.snackBar.open(msg, 'Close', { duration: 4000 });
        this.isSaving = false;
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/superadmin/tenants']);
  }

  getErrorMessage(field: string): string {
    const control = this.tenantForm.get(field);
    if (control?.hasError('required')) return `${this.getFieldLabel(field)} is required`;
    if (control?.hasError('email')) return 'Invalid email address';
    if (control?.hasError('minlength')) return 'Password must be at least 8 characters';
    if (control?.hasError('pattern')) return 'Only lowercase letters, numbers, and hyphens allowed';
    return '';
  }

  private getFieldLabel(field: string): string {
    const labels: Record<string, string> = {
      schoolName: 'School name',
      subdomain: 'Subdomain',
      contactEmail: 'Contact email',
      plan: 'Plan',
      adminEmail: 'Admin email',
      adminPassword: 'Admin password',
      adminFirstName: 'First name',
      adminLastName: 'Last name',
    };
    return labels[field] || field;
  }
}
