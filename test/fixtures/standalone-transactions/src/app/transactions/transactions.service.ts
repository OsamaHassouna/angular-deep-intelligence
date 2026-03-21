import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TransactionsService {
  getTransactions(): Promise<unknown[]> {
    return Promise.resolve([]);
  }
}
