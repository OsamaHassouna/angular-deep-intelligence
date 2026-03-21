import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DataService } from '../anti-pattern-samples/data.service';

@Component({
  selector: 'app-proper-subscribe',
  template: `<p>{{ data }}</p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProperSubscribeComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  data: string[] = [];

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.getData()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        this.data = result;
      });
  }
}
