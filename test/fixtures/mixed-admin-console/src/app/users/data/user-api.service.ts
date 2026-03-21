import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UserApiService {
  getUsers(): Promise<unknown[]> {
    return Promise.resolve([]);
  }
}
