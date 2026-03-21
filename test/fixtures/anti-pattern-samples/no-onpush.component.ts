import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-no-onpush',
  template: `<p>{{ title }}</p>`,
})
export class NoOnPushComponent {
  @Input() title = '';
}
