export type FeatureMap = { [feature: string]: boolean };
export type Features = string | string[];

/**
 * A simple function to return a `FeatureMap` from JSON
 * @param mid MID to JSON file
 * this is running in Node or a browser environment.
 */
function load(mid: string): FeatureMap | undefined {
	try {
		return require(mid) as FeatureMap;
	}
	catch (e) { }
}

/**
 * Retrieve the largest set of non-conflicting features for the supplied feature sets.
 * @param features The features to look for
 * this is running in Node or a browser environment.
 */
export default function getFeatures(features?: Features): FeatureMap {
	// No features supplied in the args, bail with no static features
	if (!features) {
		return {};
	}

	const featureNames = Array.isArray(features) ? features : [ features ];
	const featureMaps = featureNames
		.map((name) => load(`./features/${name}.json`));

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
