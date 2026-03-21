import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, combineLatest, Observable, interval } from 'rxjs';
import { map } from 'rxjs/operators';

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  revenue: number;
  orders: number;
}

export interface ChartData {
  labels: string[];
  values: number[];
}

@Injectable({ providedIn: 'root' })
export class DataService {
  // BehaviorSubject pattern - should use signal()
  private stats$ = new BehaviorSubject<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    revenue: 0,
    orders: 0
  });

  // Another BehaviorSubject - signals candidate
  private chartData$ = new BehaviorSubject<ChartData>({
    labels: [],
    values: []
  });

  // Private Subject for local state - signals candidate
  private refreshTrigger = new Subject<void>();

  // combineLatest + map pattern - should use computed()
  summary$ = combineLatest([
    this.stats$,
    this.chartData$
  ]).pipe(
    map(([stats, chart]) => ({
      ...stats,
      chartPointCount: chart.values.length,
      averageValue: chart.values.reduce((a, b) => a + b, 0) / (chart.values.length || 1)
    }))
  );

  constructor() {}

  loadStats(): void {
    const mockStats: DashboardStats = {
      totalUsers: 1250,
      activeUsers: 340,
      revenue: 52400,
      orders: 890
    };
    this.stats$.next(mockStats);
  }

  loadChartData(): void {
    const mockChart: ChartData = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      values: [120, 190, 300, 500, 200, 300]
    };
    this.chartData$.next(mockChart);
  }

  getStats(): DashboardStats {
    return this.stats$.getValue();
  }

  getChartValues(): number[] {
    return this.chartData$.getValue().values;
  }

  triggerRefresh(): void {
    this.refreshTrigger.next();
  }
}
