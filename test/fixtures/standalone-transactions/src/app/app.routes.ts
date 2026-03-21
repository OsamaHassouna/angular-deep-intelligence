import { Routes } from '@angular/router';
import { DashboardPageComponent } from './dashboard/dashboard-page.component';
import { TransactionsPageComponent } from './transactions/transactions-page.component';

export const appRoutes: Routes = [
  {
    path: '',
    component: DashboardPageComponent
  },
  {
    path: 'transactions',
    component: TransactionsPageComponent
  }
];
