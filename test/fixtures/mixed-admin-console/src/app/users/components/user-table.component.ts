import { Component } from '@angular/core';
import { UserApiService } from '../data/user-api.service';

@Component({
  selector: 'app-user-table',
  templateUrl: './user-table.component.html'
})
export class UserTableComponent {
  constructor(private readonly userApiService: UserApiService) {}

  refreshUsers(): void {
    this.userApiService.getUsers();
  }
}
