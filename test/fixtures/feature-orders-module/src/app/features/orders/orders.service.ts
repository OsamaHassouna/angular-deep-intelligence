import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class OrdersService {
  fetchOrders(): Promise<unknown[]> {
    return Promise.resolve([]);
  }
}
