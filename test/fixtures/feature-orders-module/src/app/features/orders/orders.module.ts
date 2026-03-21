import { NgModule } from '@angular/core';
import { OrdersRoutingModule } from './orders-routing.module';
import { OrdersListComponent } from './orders-list.component';

@NgModule({
  declarations: [OrdersListComponent],
  imports: [OrdersRoutingModule]
})
export class OrdersModule {}
