const puppeteer = require('puppeteer');
const jsdom = require('jsdom');
const { JSDOM, ResourceLoader } = jsdom;

export type Renderer = 'puppeteer' | 'jsdom';

export default (renderer: Renderer = 'puppeteer') => {
	if (renderer === 'puppeteer') {
		return puppeteer;
	}
	return {
		launch: (options: any) => {
			class CustomResourceLoader extends ResourceLoader {
				fetch(url: string, options: any) {
					if (options.element && options.element.localName === 'iframe') {
						return null;
					}
					return super.fetch(url.replace(/#.*/, ''), options);
				}
			}
			return Promise.resolve({
				close: () => {
					return Promise.resolve();
				},
				newPage: () => {
					const beforeParseFuncs: any[] = [];
					let window: any;
					return {
						evaluate: (func: () => any, ...args: any[]) => {
							return new Promise((resolve) => {
								setTimeout(() => {
									resolve(window.eval(`(${func.toString()})('${args.join(`','`)}')`));
								}, 0);
							});
						},
						evaluateOnNewDocument: (func: () => any, ...args: any[]) => {
							beforeParseFuncs.push((window: any) => {
								window.eval(`(${func.toString()})('${args.join(`','`)}')`);
							});
							return Promise.resolve();
						},
						$eval: (selector: string, func: (node: Element) => any) => {
							const node = window.document.querySelector(selector);
							return Promise.resolve(func(node));
						},
						$$eval: (selector: string, func: (nodes: Element[]) => any) => {
							const nodes = [...window.document.querySelectorAll(selector)];
							return Promise.resolve(func(nodes));
						},
						goto: (url: string) => {
							const jsdomOptions: any = {
								runScripts: 'dangerously',
								pretendToBeVisual: true,
								resources: new CustomResourceLoader()
							};

							jsdomOptions.beforeParse = (win: any) => {
								window = win;
								(global as any).document = win.document;
								(global as any).window = window;

								beforeParseFuncs.forEach((beforeParseFunc) => {
									beforeParseFunc(win);
								});
							};
							return JSDOM.fromURL(url, jsdomOptions);
						},
						exposeFunction: (name: string, func: () => any) => {
							beforeParseFuncs.push((window: any) => {
								window[name] = func;
							});
						},
						screenshot: () => {
							return Promise.resolve();
						},
						on: (eventName: string, func: () => void) => {
							// no op for now
						},
						close: () => {
							return Promise.resolve();
						}
					};
				}
			});
		}
	};
};
