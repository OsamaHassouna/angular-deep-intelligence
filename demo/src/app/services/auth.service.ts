import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { UserService } from './user.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private isAuthenticated$ = new BehaviorSubject<boolean>(false);
  private token: string | null = null;

  constructor(private userService: UserService) {}

  login(email: string, password: string): Observable<boolean> {
    this.isAuthenticated$.next(true);
    this.token = 'mock-jwt-token';
    this.userService.loadProfile(email);
    return this.isAuthenticated$.asObservable();
  }

  logout(): void {
    this.isAuthenticated$.next(false);
    this.token = null;
    this.userService.clearProfile();
  }

  getToken(): string | null {
    return this.token;
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated$.getValue();
  }
}
