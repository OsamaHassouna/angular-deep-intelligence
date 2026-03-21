import { Component } from '@angular/core';
import { TransactionsService } from './transactions.service';

@Component({
  selector: 'app-transactions-page',
  templateUrl: './transactions-page.component.html'
})
export class TransactionsPageComponent {
  constructor(private readonly transactionsService: TransactionsService) {}

  loadTransactions(): void {
    this.transactionsService.getTransactions();
  }
}
