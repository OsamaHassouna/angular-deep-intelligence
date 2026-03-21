import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DataService {
  getData(): Observable<string[]> {
    return of(['item1', 'item2']);
  }

  getCount(): Observable<number> {
    return of(42);
  }

  loadMore(): Observable<string[]> {
    return of(['item3', 'item4']);
  }
}
