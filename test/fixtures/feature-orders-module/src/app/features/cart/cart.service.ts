import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CartService {
  loadCart(): Promise<unknown[]> {
    return Promise.resolve([]);
  }
}
