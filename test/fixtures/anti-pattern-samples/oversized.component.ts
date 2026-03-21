import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from './user.service';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';
import { LoggerService } from './logger.service';
import { ConfigService } from './config.service';

@Component({
  selector: 'app-oversized',
  templateUrl: './oversized.component.html',
  styleUrls: ['./oversized.component.scss'],
})
export class OversizedComponent implements OnInit {
  userForm: FormGroup;
  profileForm: FormGroup;
  settingsForm: FormGroup;
  users: any[] = [];
  selectedUser: any = null;
  isLoading = false;
  isEditing = false;
  searchTerm = '';
  filterBy = 'all';
  sortBy = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';
  currentPage = 1;
  pageSize = 20;
  totalItems = 0;
  showAdvanced = false;
  showExport = false;
  showImport = false;
  errorMessage = '';
  successMessage = '';
  tabs = ['profile', 'settings', 'activity', 'permissions'];
  activeTab = 'profile';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private userService: UserService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private loggerService: LoggerService,
    private configService: ConfigService,
  ) {
    this.userForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      role: ['user'],
      department: [''],
      phone: [''],
      address: [''],
      city: [''],
      country: [''],
    });
    this.profileForm = this.fb.group({
      bio: [''],
      avatar: [''],
      theme: ['light'],
      language: ['en'],
      timezone: ['UTC'],
    });
    this.settingsForm = this.fb.group({
      emailNotifications: [true],
      pushNotifications: [true],
      twoFactor: [false],
      sessionTimeout: [30],
      autoSave: [true],
    });
  }

  ngOnInit(): void {
    this.loadUsers();
    this.loadConfig();
    this.setupSearch();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.errorMessage = '';
    // Simulated loading
    setTimeout(() => {
      this.users = [];
      this.isLoading = false;
    }, 1000);
  }

  loadConfig(): void {
    // Load configuration
    const config = { pageSize: 20 };
    this.pageSize = config.pageSize;
  }

  setupSearch(): void {
    // Setup debounced search
  }

  onSearch(term: string): void {
    this.searchTerm = term;
    this.currentPage = 1;
    this.loadUsers();
  }

  onFilter(filterBy: string): void {
    this.filterBy = filterBy;
    this.currentPage = 1;
    this.loadUsers();
  }

  onSort(column: string): void {
    if (this.sortBy === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortDirection = 'asc';
    }
    this.loadUsers();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadUsers();
  }

  onSelectUser(user: any): void {
    this.selectedUser = user;
    this.isEditing = false;
    this.patchForms(user);
    this.activeTab = 'profile';
  }

  onEditUser(): void {
    this.isEditing = true;
  }

  onCancelEdit(): void {
    this.isEditing = false;
    if (this.selectedUser) {
      this.patchForms(this.selectedUser);
    }
  }

  onSaveUser(): void {
    if (!this.userForm.valid) {
      this.errorMessage = 'Please fill in all required fields.';
      return;
    }
    this.isLoading = true;
    // Save logic
    setTimeout(() => {
      this.isLoading = false;
      this.isEditing = false;
      this.successMessage = 'User saved successfully.';
      this.loadUsers();
    }, 500);
  }

  onDeleteUser(user: any): void {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }
    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
      this.selectedUser = null;
      this.loadUsers();
    }, 500);
  }

  onCreateUser(): void {
    this.selectedUser = null;
    this.isEditing = true;
    this.userForm.reset();
    this.profileForm.reset();
    this.settingsForm.reset();
  }

  onExportUsers(): void {
    this.showExport = true;
    // Export logic
    const data = JSON.stringify(this.users);
    this.loggerService.log('Users exported');
  }

  onImportUsers(): void {
    this.showImport = true;
  }

  onTabChange(tab: string): void {
    this.activeTab = tab;
  }

  onToggleAdvanced(): void {
    this.showAdvanced = !this.showAdvanced;
  }

  onBulkAction(action: string): void {
    switch (action) {
      case 'activate':
        this.bulkActivate();
        break;
      case 'deactivate':
        this.bulkDeactivate();
        break;
      case 'delete':
        this.bulkDelete();
        break;
      case 'export':
        this.onExportUsers();
        break;
    }
  }

  onResetPassword(user: any): void {
    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
      this.successMessage = 'Password reset email sent.';
    }, 500);
  }

  onToggleTwoFactor(): void {
    const current = this.settingsForm.get('twoFactor')?.value;
    this.settingsForm.patchValue({ twoFactor: !current });
  }

  onUpdatePermissions(permissions: any): void {
    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
      this.successMessage = 'Permissions updated.';
    }, 300);
  }

  onViewActivity(user: any): void {
    this.activeTab = 'activity';
    // Load activity data
  }

  trackByUserId(_index: number, user: any): string {
    return user.id;
  }

  getFilteredUsers(): any[] {
    let filtered = [...this.users];
    if (this.searchTerm) {
      filtered = filtered.filter(u =>
        u.name?.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
    if (this.filterBy !== 'all') {
      filtered = filtered.filter(u => u.role === this.filterBy);
    }
    return filtered;
  }

  getSortedUsers(): any[] {
    const filtered = this.getFilteredUsers();
    return filtered.sort((a, b) => {
      const aVal = a[this.sortBy] || '';
      const bVal = b[this.sortBy] || '';
      const cmp = aVal.localeCompare(bVal);
      return this.sortDirection === 'asc' ? cmp : -cmp;
    });
  }

  getPaginatedUsers(): any[] {
    const sorted = this.getSortedUsers();
    const start = (this.currentPage - 1) * this.pageSize;
    return sorted.slice(start, start + this.pageSize);
  }

  getTotalPages(): number {
    return Math.ceil(this.getFilteredUsers().length / this.pageSize);
  }

  getPageNumbers(): number[] {
    const total = this.getTotalPages();
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  isFormDirty(): boolean {
    return this.userForm.dirty || this.profileForm.dirty || this.settingsForm.dirty;
  }

  canDeactivate(): boolean {
    if (this.isFormDirty()) {
      return confirm('You have unsaved changes. Are you sure you want to leave?');
    }
    return true;
  }

  private patchForms(user: any): void {
    this.userForm.patchValue({
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      phone: user.phone,
      address: user.address,
      city: user.city,
      country: user.country,
    });
    this.profileForm.patchValue({
      bio: user.bio,
      avatar: user.avatar,
      theme: user.theme,
      language: user.language,
      timezone: user.timezone,
    });
    this.settingsForm.patchValue({
      emailNotifications: user.emailNotifications,
      pushNotifications: user.pushNotifications,
      twoFactor: user.twoFactor,
      sessionTimeout: user.sessionTimeout,
      autoSave: user.autoSave,
    });
  }

  private bulkActivate(): void {
    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
      this.successMessage = 'Users activated.';
      this.loadUsers();
    }, 500);
  }

  private bulkDeactivate(): void {
    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
      this.successMessage = 'Users deactivated.';
      this.loadUsers();
    }, 500);
  }

  private bulkDelete(): void {
    if (!confirm('Delete selected users?')) {
      return;
    }
    this.isLoading = true;
    setTimeout(() => {
      this.isLoading = false;
      this.successMessage = 'Users deleted.';
      this.loadUsers();
    }, 500);
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  private validateEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2);
  }
}
