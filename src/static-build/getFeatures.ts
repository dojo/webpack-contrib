import { readFileSync } from 'fs';
export type FeatureMap = { [feature: string]: boolean };
export type Features = string | string[];

/**
 * A simple function to return a `FeatureMap` from JSON
 * @param mid MID to JSON file
 * @param isRunningInNode Optional parameter that can be used to indicate whether
 * this is running in Node or a browser environment.
 */
function load(mid: string, isRunningInNode = true): FeatureMap | undefined {
	try {
		let result: FeatureMap;
		if (isRunningInNode) {
			result = require(mid);
		}
		else {
			result = JSON.parse(readFileSync((require as any).toUrl(mid), 'utf8'));
		}
		return result;
	}
	catch (e) { }
}

/**
 * Retrieve the largest set of non-conflicting features for the supplied feature sets.
 * @param features The features to look for
 * @param isRunningInNode Optional parameter that can be used to indicate whether
 * this is running in Node or a browser environment.
 */
export default function getFeatures(features?: Features, isRunningInNode = true): FeatureMap {
	// No features supplied in the args, bail with no static features
	if (!features) {
		return {};
	}

	const featureNames = Array.isArray(features) ? features : [ features ];
	const featureMaps = featureNames
		.map((name) => load(`./features/${name}.json`, isRunningInNode));

	if (!featureMaps.every((exists) => !!exists)) {
		featureMaps.forEach((exists, idx) => {
			if (!exists) {
				console.log('Cannot resolve feature set:', featureNames[idx]);
			}
		});
		return {};
	}

	// Reduce the array of loaded features to the largest set of features where the values do not
	// conflict with each other.  Once a value conflicts, it is removed from the feature map.
	const seenFeatures = new Set<string>();
	return (featureMaps as FeatureMap[]).reduce((previous, current) => {
		Object.keys(current).forEach((key) => {
			if (!(key in previous) && !seenFeatures.has(key)) {
				seenFeatures.add(key);
				previous[key] = current[key];
			}
			else if (key in previous && previous[key] !== current[key]) {
				delete previous[key];
			}
		});
		return previous;
	}, {} as FeatureMap);
}
