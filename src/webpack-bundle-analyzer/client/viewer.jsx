/** @jsx h */
import { h, render } from 'preact';

import Sunburst from './components/Sunburst';
/* eslint no-unused-vars: "off" */
import styles from './viewer.css';

// Initializing WebSocket for live updates
let ws;
try {
  ws = new WebSocket(`ws://${location.host}`);
} catch (err) {
  console.warn(
    "Couldn't connect to analyzer websocket server so you'll have to reload page manually to see updates"
  );
}

window.addEventListener('load', () => {
  renderApp(window.chartData);

  if (ws) {
    ws.addEventListener('message', event => {
      const msg = JSON.parse(event.data);

      if (msg.event === 'chartDataUpdated') {
        renderApp(msg.data);
      }
    });
  }
}, false);

let app;
function renderApp(chartData) {
  app = render(<Sunburst data={chartData}/>, document.getElementById('app'));
}
