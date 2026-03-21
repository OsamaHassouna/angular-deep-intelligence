import { Component, OnInit } from '@angular/core';
import { DataService, DashboardStats } from '../services/data.service';

@Component({
  selector: 'app-feature',
  template: `
    <div class="feature-page">
      <h2>Feature Analytics</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <span class="label">Total Users</span>
          <span class="value">{{ stats?.totalUsers }}</span>
        </div>
        <div class="stat-card">
          <span class="label">Active</span>
          <span class="value">{{ stats?.activeUsers }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .feature-page { padding: 24px; }
    .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .stat-card { background: #f5f5f5; padding: 16px; border-radius: 8px; }
    .label { display: block; font-size: 12px; color: #666; }
    .value { display: block; font-size: 24px; font-weight: 600; }
  `]
})
export class FeatureComponent implements OnInit {
  stats: DashboardStats | null = null;

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.loadStats();
    this.stats = this.dataService.getStats();
  }
}
