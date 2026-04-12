import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { HeaderComponent } from './header.component';
import { SidebarComponent } from './sidebar.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatSidenavModule,
    HeaderComponent,
    SidebarComponent,
  ],
  template: `
    <div class="layout-wrapper">
      <app-header (toggleSidebar)="sidenav.toggle()" />

      <mat-sidenav-container class="sidenav-container">
        <mat-sidenav
          #sidenav
          mode="side"
          [opened]="true"
          class="app-sidenav"
        >
          <app-sidebar />
        </mat-sidenav>

        <mat-sidenav-content class="main-content">
          <div class="content-wrapper">
            <router-outlet />
          </div>
        </mat-sidenav-content>
      </mat-sidenav-container>
    </div>
  `,
  styles: `
    .layout-wrapper {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    .sidenav-container {
      flex: 1;
      overflow: hidden;
    }

    .app-sidenav {
      width: 260px;
      border-right: none;
      background-color: #1e1e2f;
    }

    .main-content {
      background-color: #f5f5f5;
    }

    .content-wrapper {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }
  `,
})
export class MainLayoutComponent {
  @ViewChild('sidenav') sidenav!: MatSidenav;
}
