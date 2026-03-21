import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private currentUser$ = new BehaviorSubject<UserProfile | null>(null);

  constructor(private authService: AuthService) {}

  loadProfile(email: string): void {
    const mockProfile: UserProfile = {
      id: '1',
      name: 'Demo User',
      email,
      role: 'admin'
    };
    this.currentUser$.next(mockProfile);
  }

  clearProfile(): void {
    this.currentUser$.next(null);
  }

  getCurrentUser(): UserProfile | null {
    return this.currentUser$.getValue();
  }

  isAdmin(): boolean {
    const user = this.currentUser$.getValue();
    return user?.role === 'admin';
  }

  getUser$(): Observable<UserProfile | null> {
    return this.currentUser$.asObservable();
  }
}
