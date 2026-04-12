import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { FeatureCatalogItem } from '../../../core/models';

@Component({
  selector: 'app-create-template-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatIconModule,
    MatDividerModule,
  ],
  templateUrl: './create-template-dialog.component.html',
  styleUrl: './create-template-dialog.component.scss',
})
export class CreateTemplateDialogComponent {
  name = '';
  description = '';
  featureSelections: Record<string, boolean> = {};
  categories: string[] = [];
  catalogByCategory: Record<string, FeatureCatalogItem[]> = {};

  constructor(
    public dialogRef: MatDialogRef<CreateTemplateDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { catalog: FeatureCatalogItem[] },
  ) {
    // Group catalog by category
    const catMap: Record<string, FeatureCatalogItem[]> = {};
    (data.catalog || []).forEach((item) => {
      if (!catMap[item.category]) catMap[item.category] = [];
      catMap[item.category].push(item);
      this.featureSelections[item.featureKey] = item.defaultEnabled;
    });
    this.catalogByCategory = catMap;
    this.categories = Object.keys(catMap);
  }

  get isValid(): boolean {
    return this.name.trim().length > 0;
  }

  get selectedCount(): number {
    return Object.values(this.featureSelections).filter(Boolean).length;
  }

  toggleAll(category: string, checked: boolean): void {
    (this.catalogByCategory[category] || []).forEach((item) => {
      this.featureSelections[item.featureKey] = checked;
    });
  }

  isCategoryAllSelected(category: string): boolean {
    return (this.catalogByCategory[category] || []).every(
      (item) => this.featureSelections[item.featureKey],
    );
  }

  isCategorySomeSelected(category: string): boolean {
    const items = this.catalogByCategory[category] || [];
    const selected = items.filter((item) => this.featureSelections[item.featureKey]);
    return selected.length > 0 && selected.length < items.length;
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  onSave(): void {
    this.dialogRef.close({
      name: this.name.trim(),
      description: this.description.trim(),
      featureFlags: { ...this.featureSelections },
    });
  }
}
