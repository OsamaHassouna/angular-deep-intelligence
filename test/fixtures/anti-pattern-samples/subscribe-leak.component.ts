import { Component, OnInit } from '@angular/core';
import { DataService } from './data.service';

@Component({
  selector: 'app-subscribe-leak',
  templateUrl: './subscribe-leak.component.html',
})
export class SubscribeLeakComponent implements OnInit {
  data: string[] = [];
  count = 0;

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    // BAD: subscribe without cleanup
    this.dataService.getData().subscribe(result => {
      this.data = result;
    });

    // BAD: another subscribe without cleanup
    this.dataService.getCount().subscribe(count => {
      this.count = count;
    });
  }

  loadMore(): void {
    // BAD: subscribe in method without cleanup
    this.dataService.loadMore().subscribe(items => {
      this.data.push(...items);
    });
  }
}
