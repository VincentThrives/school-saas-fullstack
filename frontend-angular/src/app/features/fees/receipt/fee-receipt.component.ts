import { Component, Inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { FeeLedgerPayment, StudentFeeLedger, TenantPublicInfo } from '../../../core/models';
import jsPDF from 'jspdf';

/**
 * Printable + downloadable fee receipt.
 *
 * <p>Runs in two modes:</p>
 * <ol>
 *   <li><b>Dialog mode</b> (primary) — opened from the Fee Payments row's
 *       print button as a MatDialog on the same page. Ledger + payment are
 *       passed via {@code MAT_DIALOG_DATA}, no HTTP round-trip.</li>
 *   <li><b>Standalone route mode</b> — {@code /fees/receipt/:ledgerId/:paymentId}
 *       kept for direct links / bookmarks. Fetches the ledger by id and finds
 *       the payment inside its embedded array.</li>
 * </ol>
 *
 * <p>Both modes render the same A5 receipt card and share the same
 * print + download-PDF actions. Layout is sized in millimetres so what
 * you see is what prints — no scaling surprises.</p>
 */
@Component({
  selector: 'app-fee-receipt',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  templateUrl: './fee-receipt.component.html',
  styleUrl: './fee-receipt.component.scss',
})
export class FeeReceiptComponent {
  isLoading = true;
  errorMessage = '';
  ledger: StudentFeeLedger | null = null;
  payment: FeeLedgerPayment | null = null;
  /** Fallback identity from the auth session (school name + logo). Only
   *  used when the tenant hasn't populated School Profile in Settings. */
  school: TenantPublicInfo | null = null;
  /** Preferred identity — pulled from /api/v1/settings so admins can
   *  edit school name / address / phone / logo from Settings → School
   *  Profile and see the change on receipts without super-admin help. */
  schoolProfile: any = null;
  today = new Date();
  /** True when we're running inside a MatDialog — hides "Close via
   *  browser tab" hints and shows a dialog Close button instead. */
  isDialog = false;

  constructor(
    @Optional() private route: ActivatedRoute,
    private api: ApiService,
    private auth: AuthService,
    private snackBar: MatSnackBar,
    @Optional() private dialogRef: MatDialogRef<FeeReceiptComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) private data: FeeReceiptDialogData | null,
  ) {
    this.school = this.auth.currentSchoolInfo;
    // Prefer the school-editable profile (Settings → School Profile)
    // over the super-admin-owned tenant record. Fire-and-forget:
    // if it errors we just render with the auth fallback.
    this.api.getSettings().subscribe({
      next: (res) => { this.schoolProfile = (res as any)?.data?.profile || null; },
      error: () => { this.schoolProfile = null; },
    });

    if (this.data) {
      // Dialog mode — everything is pre-loaded, just render.
      this.isDialog = true;
      this.ledger = this.data.ledger;
      this.payment = this.data.payment;
      this.isLoading = false;
      if (!this.payment) this.errorMessage = 'Payment not found on this ledger.';
      return;
    }

    // Standalone route mode — fetch by id, find the payment.
    const ledgerId = this.route?.snapshot.paramMap.get('ledgerId');
    const paymentId = this.route?.snapshot.paramMap.get('paymentId');
    if (!ledgerId || !paymentId) {
      this.errorMessage = 'Missing receipt reference.';
      this.isLoading = false;
      return;
    }
    this.api.getFeeLedgerById(ledgerId).subscribe({
      next: (res) => {
        this.ledger = res.data || null;
        this.payment = (this.ledger?.payments || [])
          .find(p => p.paymentId === paymentId) || null;
        this.isLoading = false;
        if (!this.payment) this.errorMessage = 'Payment not found on this ledger.';
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = 'Could not load receipt.';
      },
    });
  }

  close(): void {
    this.dialogRef?.close();
  }

  /**
   * Fire the browser print dialog restricted to the receipt card. We
   * clone the receipt DOM into a hidden iframe so the print job only
   * captures the A5 card — the app shell (sidebar, header) never
   * shows up on paper, even without app-wide @media print CSS.
   */
  printReceipt(): void {
    const source = document.getElementById('receipt-card');
    if (!source) return;
    // Inline the current page's stylesheets so the iframe renders the
    // receipt with the same look it has on screen.
    const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(el => el.outerHTML)
      .join('\n');

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Receipt ${this.payment?.receiptNumber || ''}</title>
          ${styleLinks}
          <style>
            html, body { margin: 0; padding: 0; background: #fff; }
            @page { size: A5; margin: 0; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>${source.outerHTML}</body>
      </html>
    `);
    doc.close();

    // Give the iframe a beat to lay out with the copied styles, then
    // fire print and clean up.
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 500);
    }, 250);
  }

  /**
   * Render the receipt to a single-page A5 PDF via jsPDF's HTML pipeline.
   * The window/scale tuning below keeps the card on ONE page instead of
   * spilling to a second sheet.
   */
  downloadPdf(): void {
    if (!this.payment || !this.ledger) return;
    const el = document.getElementById('receipt-card');
    if (!el) return;
    // A5 portrait — 148 × 210 mm. We size the content area to
    // 148 mm x 210 mm (page - 0 margins), then feed the HTML with a
    // wide windowWidth so the internal layout matches what the browser
    // renders. scale = paperWidthMm / windowWidthPx keeps the entire
    // card on one page.
    const pageWidthMm = 148;
    const pageHeightMm = 210;
    const windowWidthPx = 560;
    const scale = pageWidthMm / windowWidthPx;
    const pdf = new jsPDF({
      unit: 'mm',
      format: 'a5',
      orientation: 'portrait',
    });
    pdf.html(el, {
      callback: (doc) => {
        const filename = `receipt-${this.payment!.receiptNumber || this.payment!.paymentId}.pdf`;
        doc.save(filename);
      },
      x: 0,
      y: 0,
      width: pageWidthMm,
      windowWidth: windowWidthPx,
      html2canvas: {
        scale,
        useCORS: true,
        backgroundColor: '#ffffff',
        // Trim the height so a single-page A5 render is enforced;
        // anything beyond gets cropped rather than spilling.
        windowHeight: pageHeightMm / scale,
      } as any,
    });
  }

  formatCurrency(n: number | undefined | null): string {
    if (n === null || n === undefined || isNaN(n as number)) return 'Rs. 0';
    return 'Rs. ' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  /**
   * "Rupees Twelve Thousand Three Hundred Forty Five Only" — standard
   * Indian-receipt amount-in-words. Handles up to 99,99,99,999.
   */
  amountInWords(amount: number | undefined | null): string {
    if (!amount || amount <= 0) return 'Zero Only';
    const n = Math.floor(amount);
    const decimal = Math.round((amount - n) * 100);
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
                  'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen',
                  'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
                  'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
                  'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const two = (num: number): string => {
      if (num < 20) return ones[num];
      const t = Math.floor(num / 10);
      const o = num % 10;
      return tens[t] + (o ? ' ' + ones[o] : '');
    };
    const three = (num: number): string => {
      const h = Math.floor(num / 100);
      const rest = num % 100;
      return (h ? ones[h] + ' Hundred' + (rest ? ' ' : '') : '') + (rest ? two(rest) : '');
    };

    let num = n;
    const crore = Math.floor(num / 10000000); num %= 10000000;
    const lakh = Math.floor(num / 100000);   num %= 100000;
    const thousand = Math.floor(num / 1000); num %= 1000;
    const rest = num;

    let parts: string[] = [];
    if (crore) parts.push(two(crore) + ' Crore');
    if (lakh) parts.push(two(lakh) + ' Lakh');
    if (thousand) parts.push(two(thousand) + ' Thousand');
    if (rest) parts.push(three(rest));

    let words = 'Rupees ' + (parts.join(' ') || 'Zero');
    if (decimal > 0) words += ' and ' + two(decimal) + ' Paise';
    return words + ' Only';
  }

  /** School name — School Profile → tenant record → generic fallback.
   *  Lets a school admin override the tenant name from Settings without
   *  super-admin write access on the Tenant record. */
  get headerSchoolName(): string {
    return (this.schoolProfile?.displayName?.trim()
         || this.school?.schoolName
         || 'School');
  }

  /** Logo url — Settings first, then tenant. Blank strings fall through. */
  get headerLogoUrl(): string {
    const s = (this.schoolProfile?.logoUrl || '').trim();
    if (s) return s;
    return (this.school?.logoUrl || '').trim();
  }

  /** "Line1, Line2, City, State ZIP, Country" joined from the School
   *  Profile address bits. Empty parts drop out so a partially-filled
   *  profile still reads cleanly. Falls back to the tenant record's
   *  address field when the profile has none. */
  get headerAddress(): string {
    const p = this.schoolProfile;
    if (p) {
      const stateZip = [p.state, p.zip].filter(Boolean).join(' ').trim();
      const parts = [p.addressLine1, p.addressLine2, p.city, stateZip, p.country]
        .map((x: string) => (x || '').trim())
        .filter(Boolean);
      if (parts.length > 0) return parts.join(', ');
    }
    return (this.school?.address || '').trim();
  }

  /** Optional tagline (School Profile only — the tenant record has no
   *  tagline field). Shows in a small line under the school name. */
  get headerTagline(): string {
    return (this.schoolProfile?.tagline || '').trim();
  }

  get headerPhone(): string {
    return (this.schoolProfile?.contactPhone
         || this.school?.contactPhone
         || '').trim();
  }

  get headerEmail(): string {
    return (this.schoolProfile?.contactEmail
         || this.school?.contactEmail
         || '').trim();
  }

  hostelIncludedNote(): string {
    if (!this.ledger?.hostelFee) return '';
    return `Includes ${this.formatCurrency(this.ledger.hostelFee)} hostel fee.`;
  }

  /**
   * All non-voided payments up to AND including this receipt's payment,
   * ordered by paidAt then createdAt so the receipt list reads
   * chronologically. Used to show the full payment history between
   * Total Fee and Total Paid on the receipt — parents get one document
   * that reconciles their whole year of payments, not just today's.
   */
  paymentHistoryUpToNow(): FeeLedgerPayment[] {
    if (!this.ledger?.payments || !this.payment) return [];
    const currentAt = this.payment.createdAt || this.payment.paidAt || '';
    const all = this.ledger.payments
      .filter(p => !p.voidedAt)
      .filter(p => {
        // Prefer chronological cutoff via createdAt (stable, always
        // present); fall back to paidAt when older docs lack it.
        const at = p.createdAt || p.paidAt || '';
        return at <= currentAt;
      })
      .sort((a, b) => {
        const aAt = a.createdAt || a.paidAt || '';
        const bAt = b.createdAt || b.paidAt || '';
        return aAt < bAt ? -1 : aAt > bAt ? 1 : 0;
      });
    return all;
  }

  /** Sum of payments up to and including this one — the parent-visible
   *  "Total Paid" that matches paymentHistoryUpToNow(). May differ from
   *  ledger.totalPaid when later payments already exist on the ledger. */
  paidThroughThisReceipt(): number {
    return this.paymentHistoryUpToNow().reduce((sum, p) => sum + (p.amount || 0), 0);
  }

  /** Balance right after this receipt was recorded. Derived from
   *  the class fee + hostel fee + surcharge − concession − paid so far. */
  balanceAfter(): number {
    if (!this.ledger) return 0;
    return Math.max(0, (this.ledger.totalDue || 0) - this.paidThroughThisReceipt());
  }
}

/** Data passed to the receipt when it's opened as a MatDialog. */
export interface FeeReceiptDialogData {
  ledger: StudentFeeLedger;
  payment: FeeLedgerPayment;
}
