import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-onpush-leaf',
  template: `<span>{{ label }}</span>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnPushLeafComponent {
  @Input() label = '';
}
