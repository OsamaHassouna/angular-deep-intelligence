import { Routes } from '@angular/router';
import { SettingsPanelComponent } from './settings/settings-panel.component';
import { UserTableComponent } from './users/components/user-table.component';

export const adminRoutes: Routes = [
  {
    path: 'users',
    component: UserTableComponent
  },
  {
    path: 'settings',
    component: SettingsPanelComponent
  }
];
