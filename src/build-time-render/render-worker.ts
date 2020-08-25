import { parentPort, workerData, Worker } from 'worker_threads';
import renderer from './Renderer';
import {
	serve,
	parseBtrPath,
	setupEnvironment,
	getRenderHooks,
	getScriptSources,
	getPageStyles,
	getClasses,
	getForSelector,
	getAllForSelector,
	generateBasePath,
	createError,
	getPageLinks
} from './helpers';
import { ensureDirSync } from 'fs-extra';
import { join } from 'path';
import { BtrPath, RenderWorkerResult, RenderWorkerData } from './interfaces';

const filterCss = require('filter-css');

interface RenderWorkerOptions {
	path: BtrPath;
}

const {
	root,
	scope,
	output,
	cssFiles,
	rendererType,
	basePath,
	baseUrl,
	puppeteerOptions,
	entries,
	originalManifest,
	discoverPaths,
	useHistory
}: RenderWorkerData = workerData;

export async function setup() {
	if (!parentPort) {
		throw new Error('Unable to detect worker to run build time rendering.');
	}
	const browser = await renderer(rendererType).launch(puppeteerOptions);
	const app = await serve(output, baseUrl);
	const screenshotDirectory = join(output, '..', 'info', 'screenshots');
	ensureDirSync(screenshotDirectory);

	parentPort.on('message', async ({ path }: RenderWorkerOptions) => {
		const parsedPath = parseBtrPath(path);
		const renderWorkerResult: RenderWorkerResult = {
			errors: [],
			warnings: [],
			discoveredPaths: [],
			blocksOutput: {}
		};

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
					renderWorkerResult.errors.push(createError(error, parsedPath, 'Block'));
				} else {
					renderWorkerResult.blocksOutput[modulePath] = renderWorkerResult.blocksOutput[modulePath] || {};
					renderWorkerResult.blocksOutput[modulePath][JSON.stringify(args)] = JSON.stringify(result);
					return result;
				}
			} catch (error) {
				renderWorkerResult.errors.push(createError(error, parsedPath, 'Block'));
			}
		}

		try {
			const reportError = (error: Error) => {
				if (error.message.indexOf('http://localhost') !== -1) {
					renderWorkerResult.errors.push(createError(error, parsedPath, 'Runtime'));
				}
			};
			const page = await browser.newPage();
			page.on('error', reportError);
			page.on('pageerror', reportError);
			await setupEnvironment(page, baseUrl, scope);
			await page.exposeFunction('__dojoBuildBridge', buildBridge);

			try {
				await page.goto(`http://localhost:${app.port}${baseUrl}${parsedPath}`);
				const pathDirectories = parsedPath.replace('#', '').split('/');
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
				const pageStyles = await getPageStyles(page);
				const additionalCss = pageStyles
					.filter((url: string) =>
						entries.every((entry) => !url.endsWith(originalManifest[entry.replace('.js', '.css')]))
					)
					.filter((url) => !/^http(s)?:\/\/.*/.test(url) || url.indexOf('localhost') !== -1);
				await page.screenshot({
					path: join(screenshotDirectory, `${parsedPath ? parsedPath.replace('#', '') : 'default'}.png`)
				});
				let content = await getForSelector(page, `#${root}`);
				const classes = await getClasses(page);
				const head = await getAllForSelector(page, 'head > *:not(script):not(link)');
				const styles = cssFiles.reduce((result, entry: string) => {
					let filteredCss: string = filterCss(join(output, entry), (context: string, value: string) => {
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
								classes.indexOf(parsedValue) === -1 &&
								classes.indexOf(parsedValue.replace('\\:', ':')) === -1;

							return noMatchingClass && ['.', '#'].indexOf(firstChar) !== -1;
						}
					});

					return `${result}${filteredCss}`;
				}, '');
				let script = '';

				content = content.replace(/http:\/\/localhost:\d+\//g, '');
				content = content.replace(new RegExp(baseUrl.slice(1), 'g'), '');
				if (useHistory) {
					script = generateBasePath(parsedPath, scope);
				}

				renderWorkerResult.btrResult = {
					additionalCss,
					additionalScripts,
					content,
					head,
					path,
					script,
					styles
				};

				if (discoverPaths) {
					const links = await getPageLinks(page);
					for (let i = 0; i < links.length; i++) {
						renderWorkerResult.discoveredPaths.push(links[i]);
					}
				}
			} catch (error) {
				renderWorkerResult.warnings.push(createError('Failed to visit path', parsedPath));
			} finally {
				await page.close();
			}
		} catch (error) {
			renderWorkerResult.errors.push(createError(error, parsedPath));
		}
		parentPort!.postMessage(renderWorkerResult);
	});
}

setup();
