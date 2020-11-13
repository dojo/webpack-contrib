import { parentPort, workerData, Worker } from 'worker_threads';
import { RenderWorkerData, RenderWorkerOptions, BlockOutput, PageResult } from './interfaces';
import renderer from './Renderer';
import {
	serve,
	setupEnvironment,
	getRenderHooks,
	getScriptSources,
	getPageStyles,
	getPageLinks,
	getClasses,
	getForSelector,
	getAllForSelector,
	generateBasePath,
	createError
} from './helpers';
import { join } from 'path';
import { ensureDirSync } from 'fs-extra';

const coreFilterCss = require('filter-css');

const {
	basePath,
	baseUrl,
	cssFiles,
	discoverPaths,
	entries,
	originalManifest,
	output,
	puppeteerOptions,
	renderType,
	root,
	scope,
	useHistory
}: RenderWorkerData = workerData;

const dynamicLinkRegExp = /rel\=(\"|\')(preconnect|prefetch|preload|prerender|dns-prefetch|stylesheet)(\"|\')/;

function filterCss(classes: string[]): string {
	return cssFiles.reduce((result, entry: string) => {
		let filteredCss: string = coreFilterCss(join(output, entry), (context: string, value: string) => {
			if (context === 'selector') {
				let parsedValue = value
					.split('\\:')
					.map((part) => part.replace(/((>?|~?):| ).*/, ''))
					.join('\\:');
				parsedValue = parsedValue
					.split('.')
					.slice(0, 2)
					.join('.');
				const firstChar = parsedValue.substr(0, 1);
				const noMatchingClass =
					classes.indexOf(parsedValue) === -1 && classes.indexOf(parsedValue.replace('\\:', ':')) === -1;

				return noMatchingClass && ['.', '#'].indexOf(firstChar) !== -1;
			}
		});
		return `${result}${filteredCss}`;
	}, '');
}

async function renderWorker() {
	if (!parentPort) {
		throw new Error('Unable to find parent port for render worker');
	}
	const browser = await renderer(renderType).launch(puppeteerOptions);
	const app = await serve(output, baseUrl);
	const screenshotDirectory = join(output, '..', 'info', 'screenshots');
	ensureDirSync(screenshotDirectory);

	parentPort.on('message', async (options: RenderWorkerOptions | 'close') => {
		if (options === 'close') {
			try {
				await browser.disconnect();
				await browser.close();
				await app.server.close();
			} finally {
				parentPort!.postMessage('cleanup-complete');
				return;
			}
		}
		const { renderPath } = options;
		const path = typeof renderPath === 'object' ? renderPath.path : renderPath;
		const errors: Error[] = [];
		const warnings: Error[] = [];
		const discoveredPaths: string[] = [];
		const blockOutput: BlockOutput = {};
		let pageResult: PageResult | undefined;

		async function buildBridge(modulePath: string, args: any[]) {
			const promise = new Promise<any>((resolve, reject) => {
				const worker = new Worker(join(__dirname, 'block-worker.js'), {
					workerData: {
						basePath,
						modulePath,
						args
					}
				});

				worker.on('message', resolve);
				worker.on('error', reject);
				worker.on('exit', (code) => {
					if (code !== 0) {
						reject(new Error(`Worker stopped with exit code ${code}`));
					}
				});
			});
			try {
				const { result, error } = await promise;
				if (error) {
					errors.push(createError(path, error, 'Block'));
				} else {
					blockOutput[modulePath] = blockOutput[modulePath] || {};
					blockOutput[modulePath][JSON.stringify(args)] = JSON.stringify(result);
					return result;
				}
			} catch (error) {
				errors.push(createError(path, error, 'Block'));
			}
		}

		try {
			const reportError = (error: Error) => {
				if (error.message.indexOf('http://localhost') !== -1) {
					errors.push(createError(path, error, 'Runtime'));
				}
			};
			const page = await browser.newPage();
			page.on('error', reportError);
			page.on('pageerror', reportError);
			await setupEnvironment(page, baseUrl, scope);
			await page.exposeFunction('__dojoBuildBridge', buildBridge);
			try {
				await page.goto(`http://localhost:${app.port}${baseUrl}${path}`);
				const pathDirectories = path.replace('#', '').split('/');
				if (pathDirectories.length > 0) {
					pathDirectories.pop();
					ensureDirSync(join(screenshotDirectory, ...pathDirectories));
				}
				let { rendering, blocksPending } = await getRenderHooks(page, scope);
				while (rendering || blocksPending) {
					({ rendering, blocksPending } = await getRenderHooks(page, scope));
				}
				const scripts = await getScriptSources(page, app.port);
				const additionalScripts = scripts.filter(
					(script) => script && entries.every((entry) => !script.endsWith(originalManifest[entry]))
				);
				const additionalCss = (await getPageStyles(page))
					.filter((url: string) =>
						entries.every((entry) => !url.endsWith(originalManifest[entry.replace('.js', '.css')]))
					)
					.filter((url) => !/^http(s)?:\/\/.*/.test(url) || url.indexOf('localhost') !== -1);
				await page.screenshot({
					path: join(screenshotDirectory, `${path ? path.replace('#', '') : 'default'}.png`)
				});
				if (discoverPaths) {
					const links = await getPageLinks(page);
					discoveredPaths.push(...links);
				}
				const classes = await getClasses(page);
				const content = (await getForSelector(page, `#${root}`)).replace(new RegExp(baseUrl.slice(1), 'g'), '');
				const head = [
					...(await getAllForSelector(page, 'head > *:not(script):not(link)')),
					...(await getAllForSelector(page, 'head > link'))
				].filter((link) => !dynamicLinkRegExp.test(link));
				const styles = filterCss(classes);

				pageResult = {
					content,
					styles,
					script: useHistory ? generateBasePath(path, scope) : '',
					head,
					additionalScripts,
					additionalCss
				};
			} catch {
				warnings.push(createError(path, 'Failed to visit path'));
			} finally {
				await page.close();
			}
		} catch (error) {
			errors.push(createError(path, error));
		}

		parentPort!.postMessage({
			path: renderPath,
			errors,
			warnings,
			pageResult,
			discoveredPaths,
			blockOutput,
			blockScripts: []
		});
	});
}

renderWorker();
