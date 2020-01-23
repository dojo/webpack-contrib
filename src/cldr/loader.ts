'use strict';
const utils = require('loader-utils');
import * as Cldr  from 'cldrjs';
const likelySubtags = require('cldr-data/supplemental/likelySubtags.json');
const plurals = require('cldr-data/supplemental/plurals.json');
const parentLocales = require('cldr-data/supplemental/parentLocales.json');

function generateCldr(cldrData: any, locales: string[], includeInverse = false) {
	return locales.reduce((targetedCldr, locale) => {
		const cldr = new Cldr(locale);
		const langRegExp = new RegExp(`^${cldr.attributes.language}`);
		return Object.keys(cldrData).reduce((localeCldr, key) => {
			if (langRegExp.test(key)) {
				localeCldr[key] = cldrData[key];
			}
			if (includeInverse && langRegExp.test(cldrData[key])) {
				localeCldr[key] = cldrData[key];
			}
			return localeCldr;
		}, targetedCldr);
	}, {} as any);
}

module.exports = function() {
	const { locale, supportedLocales = [], sync } = utils.getOptions(this);
	console.warn('is sync', sync);
	const locales = [locale, ...supportedLocales];

	Cldr.load(likelySubtags);
	likelySubtags.supplemental.likelySubtags = generateCldr(likelySubtags.supplemental.likelySubtags, locales, true);
	plurals.supplemental['plurals-type-cardinal'] = generateCldr(
		plurals.supplemental['plurals-type-cardinal'],
		locales
	);

	function loadLocaleCldrTemplate(locale: string) {
		return `
cldrData.push(require('cldr-data/main/${locale}/ca-gregorian.json'));
cldrData.push(require('cldr-data/main/${locale}/dateFields.json'));
cldrData.push(require('cldr-data/main/${locale}/timeZoneNames.json'));
cldrData.push(require('cldr-data/main/${locale}/currencies.json'));
cldrData.push(require('cldr-data/main/${locale}/numbers.json'));
cldrData.push(require('cldr-data/main/${locale}/units.json'));
`;
	}

	function loadSupplementalCldrTemplate() {
		return `
var weekData = require('cldr-data/supplemental/weekData.json');
var ordinals = require('cldr-data/supplemental/ordinals.json');
var numberingSystems = require('cldr-data/supplemental/numberingSystems.json');
var parentLocales = ${JSON.stringify(parentLocales)};
var likelySubtags = ${JSON.stringify(likelySubtags)};
var plurals = ${JSON.stringify(plurals)};
var cldrData = [weekData, ordinals, numberingSystems, parentLocales, likelySubtags, plurals];
`;
	}

	const syncLocaleCldrData = locales.reduce((o, l) => {
		o = `${o}
${loadLocaleCldrTemplate(l)}`;
		return o;
	}, '');

	function createSupplementalCldrTemplate() {
		if (sync) {
			return 'true';
		}
		return `function {
	var promises = [
		Promise.resolve({ default: ${JSON.stringify(parentLocales)} }),
		Promise.resolve({ default: ${JSON.stringify(likelySubtags)} }),
		Promise.resolve({ default: ${JSON.stringify(plurals)} })
	];

	if (has('__i18n_date_time__')) {
		promises.push(
			import(/* webpackChunkName: "i18n/supplemental/date-time" */ 'cldr-data/supplemental/weekData.json')
		);
		promises.push(
			import(/* webpackChunkName: "i18n/supplemental/date-time" */ 'cldr-data/supplemental/timeData.json')
		);
	}
	if (has('__i18n_currency__')) {
		promises.push(
			import(/* webpackChunkName: "i18n/supplemental/currency" */ 'cldr-data/supplemental/currencyData.json')
		);
	}
	if (has('__i18n_date_time__') || has('__i18n_currency__') || has('__i18n_unit__')) {
		promises.push(
			import(/* webpackChunkName: "i18n/supplemental/common" */ 'cldr-data/supplemental/ordinals.json')
		);
		promises.push(
			import(
				/* webpackChunkName: "i18n/supplemental/common" */ 'cldr-data/supplemental/numberingSystems.json'
			)
		);
	}

	return Promise.all(promises);
}`;
	}

	function createLocaleCldrTemplate(locale: string) {
		if (sync) {
			return 'true';
		}
		return `function() {
	var promises = [];

	if (has('__i18n_date_time__')) {
		promises.push(
			import(/* webpackChunkName: "i18n/${locale}/date-time" */ 'cldr-data/main/${locale}/ca-gregorian.json')
		);
		promises.push(
			import(/* webpackChunkName: "i18n/${locale}/date-time" */ 'cldr-data/main/${locale}/dateFields.json')
		);
		promises.push(
			import(/* webpackChunkName: "i18n/${locale}/date-time" */ 'cldr-data/main/${locale}/timeZoneNames.json')
		);
	}
	if (has('__i18n_currency__')) {
		promises.push(
			import(/* webpackChunkName: "i18n/${locale}/currency" */ 'cldr-data/main/${locale}/currencies.json')
		);
	}
	if (has('__i18n_date_time__') || has('__i18n_currency__') || has('__i18n_unit__')) {
		promises.push(
			import(/* webpackChunkName: "i18n/${locale}/common" */ 'cldr-data/main/${locale}/numbers.json')
		);
	}
	if (has('__i18n_unit__')) {
		promises.push(import(/* webpackChunkName: "i18n/${locale}/unit" */ 'cldr-data/main/${locale}/units.json'));
	}

	return Promise.all(promises);
}`;
	}

	const localeLoaders = locales
		.map((locale) => {
			return `'${locale}': ${createLocaleCldrTemplate(locale)}`;
		})
		.join(',');

	return `
var has = require('@dojo/framework/core/has').default;
var i18n = require('@dojo/framework/i18n/i18n');

${sync ? loadSupplementalCldrTemplate() : ''}
${sync ? syncLocaleCldrData : ''}
${sync ? 'Globalize.load(cldrData)' : ''}

i18n.setCldrLoaders({ ${localeLoaders}, supplemental: ${createSupplementalCldrTemplate()} });
i18n.setSupportedLocales(${JSON.stringify(locales)});
i18n.setDefaultLocale('${locale}');
export default i18n.setLocale();
`;
};
