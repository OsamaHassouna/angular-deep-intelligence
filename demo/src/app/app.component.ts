import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <h1>ADI Demo App</h1>
    <router-outlet></router-outlet>
  `
})
export class AppComponent {
  title = 'ADI Demo App';
}
