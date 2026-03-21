import { Component, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { interval, timer, fromEvent, Subject } from 'rxjs';
import { DataService, DashboardStats, ChartData } from '../services/data.service';
import { UserService, UserProfile } from '../services/user.service';

interface StatCard {
  label: string;
  value: number;
  previousValue: number;
  icon: string;
}

interface Order {
  id: string;
  customer: string;
  amount: number;
  status: string;
  date: Date;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('revenueChart') revenueChartRef!: ElementRef;
  @ViewChild('activityChart') activityChartRef!: ElementRef;

  stats: DashboardStats | null = null;
  chartData: ChartData | null = null;
  orders: Order[] = [];
  currentUser: UserProfile | null = null;
  filterText = '';
  sortColumn = 'date';
  sortDirection: 'asc' | 'desc' = 'desc';
  selectedDateRange = '7d';
  isLoading = false;
  errorMessage = '';
  refreshInterval = 30000;
  notificationCount = 0;
  sidebarOpen = true;
  theme = 'light';
  pageSize = 25;
  currentPage = 1;
  totalPages = 1;

  private destroy$ = new Subject<void>();

  constructor(
    private elementRef: ElementRef,
    private dataService: DataService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
    this.setupAutoRefresh();
    this.setupKeyboardShortcuts();
    this.setupUserTracking();
    this.setupNotifications();
    this.loadOrders();
    this.loadUserPreferences();
    this.initializeTheme();
  }

  ngAfterViewInit(): void {
    this.renderRevenueChart();
    this.renderActivityChart();
    this.setupResizeObserver();
  }

  private loadDashboardData(): void {
    this.isLoading = true;
    this.dataService.loadStats();
    this.dataService.summary$.subscribe(summary => {
      this.stats = {
        totalUsers: summary.totalUsers,
        activeUsers: summary.activeUsers,
        revenue: summary.revenue,
        orders: summary.orders
      };
      this.isLoading = false;
    });

    this.dataService.loadChartData();
  }

  private setupAutoRefresh(): void {
    interval(this.refreshInterval).subscribe(() => {
      this.refresh();
    });
  }

  private setupKeyboardShortcuts(): void {
    fromEvent(document, 'keydown').subscribe((event: Event) => {
      const keyEvent = event as KeyboardEvent;
      if (keyEvent.ctrlKey && keyEvent.key === 'r') {
        event.preventDefault();
        this.refresh();
      }
      if (keyEvent.key === 'Escape') {
        this.closeSidebar();
      }
    });
  }

  private setupUserTracking(): void {
    this.userService.getUser$().subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.loadUserSpecificData(user);
      }
    });
  }

  private setupNotifications(): void {
    timer(0, 60000).subscribe(() => {
      this.checkForNotifications();
    });
  }

  private loadOrders(): void {
    this.orders = [
      { id: 'ORD-001', customer: 'Alice Johnson', amount: 299.99, status: 'completed', date: new Date('2024-01-15') },
      { id: 'ORD-002', customer: 'Bob Smith', amount: 149.50, status: 'pending', date: new Date('2024-01-14') },
      { id: 'ORD-003', customer: 'Carol Davis', amount: 599.00, status: 'shipped', date: new Date('2024-01-13') },
      { id: 'ORD-004', customer: 'David Wilson', amount: 89.99, status: 'cancelled', date: new Date('2024-01-12') },
      { id: 'ORD-005', customer: 'Eve Martinez', amount: 450.00, status: 'completed', date: new Date('2024-01-11') },
      { id: 'ORD-006', customer: 'Frank Lee', amount: 1200.00, status: 'pending', date: new Date('2024-01-10') },
      { id: 'ORD-007', customer: 'Grace Kim', amount: 75.50, status: 'completed', date: new Date('2024-01-09') },
      { id: 'ORD-008', customer: 'Henry Chen', amount: 340.00, status: 'shipped', date: new Date('2024-01-08') }
    ];
    this.totalPages = Math.ceil(this.orders.length / this.pageSize);
  }

  private loadUserPreferences(): void {
    const saved = localStorage.getItem('dashboard-prefs');
    if (saved) {
      const prefs = JSON.parse(saved);
      this.theme = prefs.theme || 'light';
      this.pageSize = prefs.pageSize || 25;
      this.selectedDateRange = prefs.dateRange || '7d';
    }
  }

  private initializeTheme(): void {
    const container = this.elementRef.nativeElement;
    container.classList.add(`theme-${this.theme}`);

    const header = document.querySelector('.dashboard-header');
    if (header) {
      (header as HTMLElement).style.backgroundColor = this.theme === 'dark' ? '#1a1a2e' : '#ffffff';
    }
  }

  private renderRevenueChart(): void {
    if (!this.revenueChartRef) return;

    const chartEl = this.revenueChartRef.nativeElement;
    chartEl.innerHTML = '';

    const canvas = document.createElement('canvas');
    canvas.width = chartEl.offsetWidth;
    canvas.height = 300;
    chartEl.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(10, 10, 100, 200);
    }
  }

  private renderActivityChart(): void {
    if (!this.activityChartRef) return;

    const el = this.activityChartRef.nativeElement;
    el.innerHTML = '<div class="chart-placeholder">Loading chart...</div>';
  }

  private setupResizeObserver(): void {
    fromEvent(window, 'resize').subscribe(() => {
      this.renderRevenueChart();
      this.renderActivityChart();
    });
  }

  private loadUserSpecificData(user: UserProfile): void {
    if (user.role === 'admin') {
      this.loadAdminMetrics();
    }
  }

  private loadAdminMetrics(): void {
    this.notificationCount = 5;
  }

  private checkForNotifications(): void {
    this.notificationCount = Math.floor(Math.random() * 10);
  }

  refresh(): void {
    this.isLoading = true;
    this.loadDashboardData();
    this.renderRevenueChart();
    this.renderActivityChart();
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      (sidebar as HTMLElement).style.display = 'none';
    }
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  getFormattedDate(): string {
    return new Date().toLocaleString();
  }

  getStatCards(): StatCard[] {
    if (!this.stats) return [];
    return [
      { label: 'Total Users', value: this.stats.totalUsers, previousValue: 1100, icon: 'users' },
      { label: 'Active Users', value: this.stats.activeUsers, previousValue: 300, icon: 'activity' },
      { label: 'Revenue', value: this.stats.revenue, previousValue: 48000, icon: 'dollar' },
      { label: 'Orders', value: this.stats.orders, previousValue: 820, icon: 'cart' }
    ];
  }

  formatNumber(value: number): string {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toString();
  }

  formatCurrency(amount: number): string {
    return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  isPositiveTrend(stat: StatCard): boolean {
    return stat.value > stat.previousValue;
  }

  calculateTrend(stat: StatCard): string {
    if (stat.previousValue === 0) return '0';
    const change = ((stat.value - stat.previousValue) / stat.previousValue) * 100;
    return (change > 0 ? '+' : '') + change.toFixed(1);
  }

  hasChartData(): boolean {
    return this.chartData !== null && this.chartData.values.length > 0;
  }

  getFilteredOrders(): Order[] {
    let filtered = [...this.orders];

    if (this.filterText) {
      const search = this.filterText.toLowerCase();
      filtered = filtered.filter(o =>
        o.customer.toLowerCase().includes(search) ||
        o.id.toLowerCase().includes(search) ||
        o.status.toLowerCase().includes(search)
      );
    }

    filtered.sort((a, b) => {
      const aVal = a[this.sortColumn as keyof Order];
      const bVal = b[this.sortColumn as keyof Order];
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });

    const start = (this.currentPage - 1) * this.pageSize;
    return filtered.slice(start, start + this.pageSize);
  }

  getStatusClass(status: string): string {
    const classMap: Record<string, string> = {
      completed: 'status-success',
      pending: 'status-warning',
      shipped: 'status-info',
      cancelled: 'status-danger'
    };
    return classMap[status] || 'status-default';
  }

  onSort(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  onDateRangeChange(range: string): void {
    this.selectedDateRange = range;
    this.refresh();
  }

  exportData(format: 'csv' | 'json'): void {
    const data = this.getFilteredOrders();

    if (format === 'csv') {
      const headers = 'Order ID,Customer,Amount,Status,Date\n';
      const rows = data.map(o =>
        `${o.id},${o.customer},${o.amount},${o.status},${o.date.toISOString()}`
      ).join('\n');
      this.downloadFile(headers + rows, 'orders.csv', 'text/csv');
    } else {
      this.downloadFile(JSON.stringify(data, null, 2), 'orders.json', 'application/json');
    }
  }

  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  savePreferences(): void {
    const prefs = {
      theme: this.theme,
      pageSize: this.pageSize,
      dateRange: this.selectedDateRange
    };
    localStorage.setItem('dashboard-prefs', JSON.stringify(prefs));
  }

  toggleTheme(): void {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    const container = this.elementRef.nativeElement;
    container.classList.remove('theme-light', 'theme-dark');
    container.classList.add(`theme-${this.theme}`);
    this.savePreferences();
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  getUserDisplayName(): string {
    if (this.currentUser) {
      return this.currentUser.name;
    }
    return 'User';
  }

  getNotificationBadge(): string {
    if (this.notificationCount > 99) return '99+';
    return this.notificationCount.toString();
  }

  isDataStale(): boolean {
    return false;
  }

  getHealthScore(): number {
    if (!this.stats) return 0;
    const userRatio = this.stats.activeUsers / (this.stats.totalUsers || 1);
    const orderRate = this.stats.orders / 1000;
    return Math.round((userRatio * 50 + orderRate * 50) * 100) / 100;
  }
}
