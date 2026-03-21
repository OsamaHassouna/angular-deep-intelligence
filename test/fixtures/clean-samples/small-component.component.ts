import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-small',
  template: `
    <div class="container">
      <h1>{{ title }}</h1>
      <p>A well-sized component</p>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SmallComponent {
  title = 'Hello World';
}
