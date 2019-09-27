import * as express from 'express';
import * as getPort from 'get-port';
import * as http from 'http';
import * as url from 'url';
import * as history from 'connect-history-api-fallback';

export interface ServeDetails {
	server: http.Server;
	port: number;
}

export async function serve(directory: string, base: string): Promise<ServeDetails> {
	const app = express();
	const port = await getPort();
	app.use(base, express.static(directory));
	app.use(
		base,
		history({
			rewrites: [
				{
					from: /^.*\.(?!html).*$/,
					to: (context: any) => {
						const { host, referer } = context.request.headers;
						const { url: originalUrl } = context.request;
						if (!referer || referer.endsWith(host + originalUrl)) {
							return originalUrl;
						}
						const parsedUrl = url.parse(referer);
						const paths = parsedUrl && parsedUrl.pathname ? parsedUrl.pathname.split('/') : [];
						const urlRewrite = paths.reduce((rewrite, segment) => {
							if (!segment) {
								return rewrite;
							}
							return rewrite.replace(`/${segment}`, '');
						}, context.parsedUrl.pathname);
						return urlRewrite;
					}
				}
			]
		})
	);
	app.use(base, express.static(directory));
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
			node.classList.length && classes.push.apply(classes, Array.from(node.classList));
		}

		classes = classes.map((className) => `.${className}`);
		return classes;
	});
}

export async function setupEnvironment(page: any, base: string, scope?: string): Promise<void> {
	if (scope) {
		await page.evaluateOnNewDocument(
			(base: string, scope: string) => {
				// @ts-ignore
				window.DojoHasEnvironment = { staticFeatures: { 'build-time-render': true } };
				// @ts-ignore
				if (!window[scope]) {
					// @ts-ignore
					window[scope] = {};
				}
				// @ts-ignore
				window[scope].publicPath = base;
				// @ts-ignore
				window[scope].base = base;
			},
			base,
			scope
		);
	} else {
		await page.evaluateOnNewDocument((base: string) => {
			// @ts-ignore
			window.DojoHasEnvironment = { staticFeatures: { 'build-time-render': true } };
			// @ts-ignore
			window.__public_path__ = base;
			// @ts-ignore
			window.__app_base__ = base;
		}, base);
	}
}

export async function getForSelector(page: any, selector: string) {
	return page.$eval(selector, (element: Element) => element.outerHTML);
}

export async function getScriptSources(page: any, port: number): Promise<string[]> {
	const scripts: string[] = await page.$$eval('script', (elements: HTMLScriptElement[]) =>
		elements.map((element) => element.src)
	);
	return scripts.map((script) => script.replace(`http://localhost:${port}/`, ''));
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

export function generateBasePath(route = '', scope?: string) {
	if (scope) {
		return `<script>
	if (!window['${scope}']) {
		window['${scope}'].publicPath = window.location.pathname.replace(${new RegExp(`(\/)?${route}(\/)?$`)}, '/');
	}
</script>`;
	}
	return `<script>
	window.__public_path__ = window.location.pathname.replace(${new RegExp(`(\/)?${route}(\/)?$`)}, '/');
</script>`;
}

export async function getPageStyles(page: any): Promise<string[]> {
	const css = await page.$$eval(
		'link[rel=stylesheet]',
		(links: any) => links.map((link: any) => link.getAttribute('href')) as string[]
	);

	return css.map((url: string) => url.replace(/http:\/\/localhost:\d+\//g, ''));
}
