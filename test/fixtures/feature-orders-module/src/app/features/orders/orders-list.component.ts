import { Component } from '@angular/core';
import { OrdersService } from './orders.service';

@Component({
  selector: 'app-orders-list',
  templateUrl: './orders-list.component.html'
})
export class OrdersListComponent {
  constructor(private readonly ordersService: OrdersService) {}

  loadOrders(): void {
    this.ordersService.fetchOrders();
  }
}
