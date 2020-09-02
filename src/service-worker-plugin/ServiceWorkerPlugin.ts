import { Compiler } from 'webpack';

const CopyWebpackPlugin = require('copy-webpack-plugin');
const { GenerateSW } = require('workbox-webpack-plugin');

const precachePropertiesMap: any = {
	baseDir: 'globDirectory',
	ignore: 'globIgnores',
	include: 'globPatterns',
	index: 'directoryIndex',
	maxCacheSize: 'maximumFileSizeToCacheInBytes',
	strict: 'globStrict',
	symlinks: 'globFollow'
};

export interface ServiceWorkerOptions {
	bundles?: string[];
	cachePrefix?: string;
	clientsClaim?: boolean;
	excludeBundles?: string[];
	importScripts?: string[];
	precache?: ServiceWorkerPrecacheOptions;
	routes?: ServiceWorkerRoute[];
	skipWaiting?: boolean;
}

export interface ServiceWorkerPrecacheOptions {
	baseDir?: string;
	ignore?: string[];
	include?: string | string[];
	index?: string;
	maxCacheSize?: number;
	strict?: boolean;
	symlinks?: boolean;
}

export interface ServiceWorkerRoute {
	urlPattern: string;
	strategy: ServiceWorkerStrategy;
	options?: ServiceWorkerRouteOptions;
}

export interface ServiceWorkerRouteOptions {
	cacheName?: string;
	cacheableResponse?: { statuses?: number[]; headers?: { [key: string]: string } };
	expiration?: { maxEntries?: number; maxAgeSeconds?: number };
	networkTimeoutSeconds?: number;
}

export type ServiceWorkerStrategy = 'cacheFirst' | 'networkFirst' | 'networkOnly' | 'staleWhileRevalidate';

interface WorkboxPrecacheOptions {
	cacheId?: string;
	clientsClaim?: boolean;
	directoryIndex?: string;
	globDirectory?: string;
	globFollow?: boolean;
	globIgnore?: string[];
	globPatterns?: string | string[];
	globStrict?: boolean;
	maximumFileSizeToCacheInBytes?: number;
	skipWaiting?: boolean;
}

/**
 * A custom webpack plugin that either generates a service worker with predefined routes, or copies the specified
 * service worker file to the output directory.
 *
 * @param compiler The webpack compiler instance
 */
export default class ServiceWorkerPlugin {
	private _serviceWorker: string | ServiceWorkerOptions;

	constructor(serviceWorker: string | ServiceWorkerOptions) {
		this._serviceWorker = serviceWorker;
	}

	/**
	 * Generate the service worker or copy the custom service worker to the output directory.
	 *
	 * @param compiler The webpack compiler instance
	 */
	apply(compiler: Compiler) {
		if (typeof this._serviceWorker === 'string') {
			return this._copyServiceWorker(compiler);
		}

		const {
			bundles,
			cachePrefix,
			clientsClaim,
			excludeBundles,
			importScripts = [],
			precache = {},
			routes = [],
			skipWaiting
		} = this._serviceWorker;

		const precacheProperties = Object.keys(precache).reduce((precacheProperties: WorkboxPrecacheOptions, key) => {
			const workboxKey: keyof WorkboxPrecacheOptions = precachePropertiesMap[key];
			if (workboxKey) {
				precacheProperties[workboxKey] = (precache as any)[key];
			}
			return precacheProperties;
		}, Object.create(null));

		const generateSW = new GenerateSW(
			this._getDefinedOptions({
				...precacheProperties,
				cacheId: cachePrefix,
				chunks: bundles,
				clientsClaim,
				excludeChunks: excludeBundles,
				importScripts,
				importWorkboxFrom: 'local',
				skipWaiting,
				runtimeCaching: routes.map((route) => {
					const { options = {}, strategy, urlPattern } = route;
					const { cacheName, cacheableResponse, expiration, networkTimeoutSeconds } = options;

					if (!urlPattern || !strategy) {
						throw new Error('Each route must have both a `urlPattern` and `strategy`');
					}

					return {
						urlPattern: new RegExp(urlPattern),
						handler: strategy,
						options: this._getDefinedOptions({
							cacheName,
							cacheableResponse,
							expiration,
							networkTimeoutSeconds
						})
					};
				})
			})
		);
		generateSW.apply(compiler);
	}

	/**
	 * @private
	 * Return a webpack plugin that copies the specified service worker file to the output directory.
	 *
	 * @param compiler The webpack compiler instance
	 */
	private _copyServiceWorker(compiler: Compiler) {
		if (!this._serviceWorker) {
			throw new Error('The service worker path must be a non-empty string');
		}

		compiler.hooks.beforeRun.tapAsync(this.constructor.name, (compiler: Compiler, next: () => void) => {
			new CopyWebpackPlugin([{ from: this._serviceWorker, to: 'service-worker.js' }]).apply(compiler);
			next();
		});
	}

	/**
	 * @private
	 * Return an object containing only defined values.
	 *
	 * @param options The options to filter
	 */
	private _getDefinedOptions<T>(options: Partial<T>): Partial<T> {
		return Object.keys(options).reduce((filtered, key) => {
			const value = (options as any)[key];
			if (typeof value !== 'undefined') {
				filtered[key] = value;
			}
			return filtered;
		}, Object.create(null));
	}
}
