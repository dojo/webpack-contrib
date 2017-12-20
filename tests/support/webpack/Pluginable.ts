import Tapable = require('tapable');

export interface Plugins {
	[name: string]: Function[];
}

export default class Pluginable extends Tapable {
	get plugins(this: any): Plugins {
		return this._plugins as any;
	}

	mockApply(this: any, name: string, ...args: any[]) {
		const callbacks = this._plugins[name];

		if (callbacks) {
			return callbacks.map((callback: Function) => callback.apply(this, args));
		}

		return [];
	}
}
