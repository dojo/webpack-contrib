import * as express from 'express';
import * as getPort from 'get-port';
import * as http from 'http';

export async function navigate(page: any, useHistory: boolean, route: string) {
	const promise = new Promise(async (resolve) => {
		await page.evaluate(
			(route: string, useHistory: boolean) => {
				if (useHistory) {
					route = route[0] === '/' ? route : `/${route}`;
					window.history.pushState({}, '', route);
					window.dispatchEvent(new Event('popstate'));
				} else {
					window.location.hash = route;
				}
			},
			route,
			useHistory
		);
		setTimeout(resolve, 500);
	});
	return promise;
}

export interface ServeDetails {
	server: http.Server;
	port: number;
}

export async function serve(directory: string): Promise<ServeDetails> {
	const app = express();
	const port = await getPort();
	app.use(express.static(directory));
	const promise = new Promise<ServeDetails>((resolve) => {
		const server = app.listen(port, () => {
			resolve({ server, port });
		});
	});
	return promise;
}

export async function getClasses(page: any): Promise<String[]> {
	return await page.evaluate(() => {
		// @ts-ignore
		const SHOW_ELEMENT = window.NodeFilter.SHOW_ELEMENT;
		const treeWalker = document.createTreeWalker(document.body, SHOW_ELEMENT);
		let classes: string[] = [];

		while (treeWalker.nextNode()) {
			const node = treeWalker.currentNode as HTMLElement;
			node.classList.length && classes.push.apply(classes, node.classList);
		}

		classes = classes.map((className) => `.${className}`);
		return classes;
	});
}

export async function setHasFlags(page: any): Promise<void> {
	await page.evaluateOnNewDocument(() => {
		// @ts-ignore
		window.DojoHasEnvironment = { staticFeatures: { 'build-time-render': true } };
		// @ts-ignore
		window.__public_path__ = '/';
	});
}

export async function getForSelector(page: any, selector: string) {
	return page.$eval(selector, (element: Element) => element.outerHTML);
}

export function generateRouteInjectionScript(html: string[], paths: any[], root: string): string {
	return `<script>
(function () {
	var paths = ${JSON.stringify(paths)};
	var html = ${JSON.stringify(html)};
	var element = document.getElementById('${root}');
	var target;
	paths.some(function (path, i) {
		var match = (typeof path === 'string' && path === window.location.hash) || path && (typeof path === 'object' && path.match && new RegExp(path.match.join('|')).test(window.location.hash));
		if (match) {
			target = html[i];
		}
		return match;
	});
	if (target && element) {
		var frag = document.createRange().createContextualFragment(target);
		element.parentNode.replaceChild(frag, element);
	}
}())
</script>`;
}

export function generateBasePath(route = '__app_root__') {
	return `<script>
window.__public_path__ = window.location.pathname.replace('${route}/', '');
</script>`;
}

export function getPrefix(path?: string) {
	return path
		? `${path
				.split('/')
				.map(() => '..')
				.join('/')}/`
		: '';
}
