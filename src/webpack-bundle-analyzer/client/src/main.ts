import global from '@dojo/framework/shim/global';
import ProjectorMixin from '@dojo/framework/widget-core/mixins/Projector';
import { App } from './App';
import ResizeObserver from 'resize-observer-polyfill';

if (!global.ResizeObserver) {
	global.ResizeObserver = ResizeObserver;
}

const Projector = ProjectorMixin(App);
const projector = new Projector();
projector.append(global.document.getElementById('app'));
