var has = require('@dojo/framework/core/has').default;
var i18n = require('@dojo/framework/i18n/i18n');

var weekData = require('cldr-core/supplemental/weekData.json');
var ordinals = require('cldr-core/supplemental/ordinals.json');
var numberingSystems = require('cldr-core/supplemental/numberingSystems.json');
var parentLocales = require('cldr-core/supplemental/parentLocales.json');
var likelySubtags = require('cldr-core/supplemental/likelySubtags.json');
var plurals = require('cldr-core/supplemental/plurals.json');
var cldrData = [weekData, ordinals, numberingSystems, parentLocales, likelySubtags, plurals];



cldrData.push(require('cldr-data/main/en/ca-gregorian.json'));
cldrData.push(require('cldr-data/main/en/dateFields.json'));
cldrData.push(require('cldr-data/main/en/timeZoneNames.json'));
cldrData.push(require('cldr-data/main/en/currencies.json'));
cldrData.push(require('cldr-data/main/en/numbers.json'));
cldrData.push(require('cldr-data/main/en/units.json'));

Globalize.load(cldrData)
i18n.setCldrLoaders({ 'en': true, fallback: true, supplemental: true });
i18n.setSupportedLocales(["en"]);
i18n.setDefaultLocale('en');
export default i18n.setLocale({ default: true });
