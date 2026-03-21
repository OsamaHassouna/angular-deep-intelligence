import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// Imagine these are real shared components spread across the shared/ directory
import { ButtonComponent } from './components/button.component';
import { CardComponent } from './components/card.component';
import { ModalComponent } from './components/modal.component';
import { TooltipDirective } from './components/tooltip.directive';
import { LoaderComponent } from './components/loader.component';
import { AlertComponent } from './components/alert.component';
import { BadgeComponent } from './components/badge.component';
import { AvatarComponent } from './components/avatar.component';
import { TabsComponent } from './components/tabs.component';
import { AccordionComponent } from './components/accordion.component';
import { PaginationComponent } from './components/pagination.component';
import { BreadcrumbComponent } from './components/breadcrumb.component';
import { DropdownComponent } from './components/dropdown.component';
import { SearchInputComponent } from './components/search-input.component';
import { DataTableComponent } from './components/data-table.component';
import { ChartWrapperComponent } from './components/chart-wrapper.component';
import { StatusPipe } from './pipes/status.pipe';
import { DateFormatPipe } from './pipes/date-format.pipe';

// Third-party module re-exports (bloat signal)
import { MaterialModule } from './material.module';
import { ChartModule } from './chart.module';
import { IconModule } from './icon.module';
import { ToastModule } from './toast.module';
import { DragDropModule } from './drag-drop.module';
import { VirtualScrollModule } from './virtual-scroll.module';

@NgModule({
  declarations: [
    ButtonComponent,
    CardComponent,
    ModalComponent,
    TooltipDirective,
    LoaderComponent,
    AlertComponent,
    BadgeComponent,
    AvatarComponent,
    TabsComponent,
    AccordionComponent,
    PaginationComponent,
    BreadcrumbComponent,
    DropdownComponent,
    SearchInputComponent,
    DataTableComponent,
    ChartWrapperComponent,
    StatusPipe,
    DateFormatPipe
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
    ChartModule,
    IconModule,
    ToastModule,
    DragDropModule,
    VirtualScrollModule
  ],
  exports: [
    ButtonComponent,
    CardComponent,
    ModalComponent,
    TooltipDirective,
    LoaderComponent,
    AlertComponent,
    BadgeComponent,
    AvatarComponent,
    TabsComponent,
    AccordionComponent,
    PaginationComponent,
    BreadcrumbComponent,
    DropdownComponent,
    SearchInputComponent,
    DataTableComponent,
    ChartWrapperComponent,
    StatusPipe,
    DateFormatPipe,
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ]
})
export class SharedModule {}
