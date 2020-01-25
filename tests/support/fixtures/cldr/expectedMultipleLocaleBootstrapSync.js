var has = require('@dojo/framework/core/has').default;
var i18n = require('@dojo/framework/i18n/i18n');

var weekData = require('cldr-core/supplemental/weekData.json');
var ordinals = require('cldr-core/supplemental/ordinals.json');
var numberingSystems = require('cldr-core/supplemental/numberingSystems.json');
var parentLocales = {"supplemental":{"version":{"_unicodeVersion":"12.1.0","_cldrVersion":"36"},"parentLocales":{"parentLocale":{"en-150":"en-001","en-AG":"en-001","en-AI":"en-001","en-AU":"en-001","en-BB":"en-001","en-BM":"en-001","en-BS":"en-001","en-BW":"en-001","en-BZ":"en-001","en-CA":"en-001","en-CC":"en-001","en-CK":"en-001","en-CM":"en-001","en-CX":"en-001","en-CY":"en-001","en-DG":"en-001","en-DM":"en-001","en-ER":"en-001","en-FJ":"en-001","en-FK":"en-001","en-FM":"en-001","en-GB":"en-001","en-GD":"en-001","en-GG":"en-001","en-GH":"en-001","en-GI":"en-001","en-GM":"en-001","en-GY":"en-001","en-HK":"en-001","en-IE":"en-001","en-IL":"en-001","en-IM":"en-001","en-IN":"en-001","en-IO":"en-001","en-JE":"en-001","en-JM":"en-001","en-KE":"en-001","en-KI":"en-001","en-KN":"en-001","en-KY":"en-001","en-LC":"en-001","en-LR":"en-001","en-LS":"en-001","en-MG":"en-001","en-MO":"en-001","en-MS":"en-001","en-MT":"en-001","en-MU":"en-001","en-MW":"en-001","en-MY":"en-001","en-NA":"en-001","en-NF":"en-001","en-NG":"en-001","en-NR":"en-001","en-NU":"en-001","en-NZ":"en-001","en-PG":"en-001","en-PH":"en-001","en-PK":"en-001","en-PN":"en-001","en-PW":"en-001","en-RW":"en-001","en-SB":"en-001","en-SC":"en-001","en-SD":"en-001","en-SG":"en-001","en-SH":"en-001","en-SL":"en-001","en-SS":"en-001","en-SX":"en-001","en-SZ":"en-001","en-TC":"en-001","en-TK":"en-001","en-TO":"en-001","en-TT":"en-001","en-TV":"en-001","en-TZ":"en-001","en-UG":"en-001","en-VC":"en-001","en-VG":"en-001","en-VU":"en-001","en-WS":"en-001","en-ZA":"en-001","en-ZM":"en-001","en-ZW":"en-001","en-AT":"en-150","en-BE":"en-150","en-CH":"en-150","en-DE":"en-150","en-DK":"en-150","en-FI":"en-150","en-NL":"en-150","en-SE":"en-150","en-SI":"en-150","es-AR":"es-419","es-BO":"es-419","es-BR":"es-419","es-BZ":"es-419","es-CL":"es-419","es-CO":"es-419","es-CR":"es-419","es-CU":"es-419","es-DO":"es-419","es-EC":"es-419","es-GT":"es-419","es-HN":"es-419","es-MX":"es-419","es-NI":"es-419","es-PA":"es-419","es-PE":"es-419","es-PR":"es-419","es-PY":"es-419","es-SV":"es-419","es-US":"es-419","es-UY":"es-419","es-VE":"es-419","pt-AO":"pt-PT","pt-CH":"pt-PT","pt-CV":"pt-PT","pt-FR":"pt-PT","pt-GQ":"pt-PT","pt-GW":"pt-PT","pt-LU":"pt-PT","pt-MO":"pt-PT","pt-MZ":"pt-PT","pt-ST":"pt-PT","pt-TL":"pt-PT","az-Arab":"root","az-Cyrl":"root","blt-Latn":"root","bm-Nkoo":"root","bs-Cyrl":"root","byn-Latn":"root","cu-Glag":"root","dje-Arab":"root","dyo-Arab":"root","en-Dsrt":"root","en-Shaw":"root","ff-Adlm":"root","ff-Arab":"root","ha-Arab":"root","iu-Latn":"root","kk-Arab":"root","ku-Arab":"root","ky-Arab":"root","ky-Latn":"root","ml-Arab":"root","mn-Mong":"root","ms-Arab":"root","pa-Arab":"root","sd-Deva":"root","sd-Khoj":"root","sd-Sind":"root","shi-Latn":"root","so-Arab":"root","sr-Latn":"root","sw-Arab":"root","tg-Arab":"root","ug-Cyrl":"root","uz-Arab":"root","uz-Cyrl":"root","vai-Latn":"root","wo-Arab":"root","yo-Arab":"root","yue-Hans":"root","zh-Hant":"root","zh-Hant-MO":"zh-Hant-HK"}}}};
var likelySubtags = {"supplemental":{"version":{"_unicodeVersion":"12.1.0","_cldrVersion":"36"},"likelySubtags":{"en":"en-Latn-US","en-Shaw":"en-Shaw-GB","enn":"enn-Latn-ZZ","enq":"enq-Latn-ZZ","und":"en-Latn-US","und-002":"en-Latn-NG","und-003":"en-Latn-US","und-009":"en-Latn-AU","und-011":"en-Latn-NG","und-018":"en-Latn-ZA","und-019":"en-Latn-US","und-021":"en-Latn-US","und-053":"en-Latn-AU","und-054":"en-Latn-PG","und-057":"en-Latn-GU","und-154":"en-Latn-GB","und-202":"en-Latn-NG","und-EU":"en-Latn-GB","und-Latn-ET":"en-Latn-ET","und-QO":"en-Latn-DG","und-Shaw":"en-Shaw-GB","fr":"fr-Latn-FR","frc":"frc-Latn-US","frp":"frp-Latn-FR","frr":"frr-Latn-DE","frs":"frs-Latn-DE","und-BF":"fr-Latn-BF","und-BJ":"fr-Latn-BJ","und-BL":"fr-Latn-BL","und-Brai":"fr-Brai-FR","und-CF":"fr-Latn-CF","und-CG":"fr-Latn-CG","und-CI":"fr-Latn-CI","und-CM":"fr-Latn-CM","und-Dupl":"fr-Dupl-FR","und-FR":"fr-Latn-FR","und-GA":"fr-Latn-GA","und-GF":"fr-Latn-GF","und-GN":"fr-Latn-GN","und-GP":"fr-Latn-GP","und-Latn-DZ":"fr-Latn-DZ","und-Latn-KM":"fr-Latn-KM","und-Latn-MA":"fr-Latn-MA","und-Latn-MR":"fr-Latn-MR","und-Latn-SY":"fr-Latn-SY","und-Latn-TN":"fr-Latn-TN","und-LU":"fr-Latn-LU","und-MC":"fr-Latn-MC","und-MF":"fr-Latn-MF","und-MQ":"fr-Latn-MQ","und-NC":"fr-Latn-NC","und-PF":"fr-Latn-PF","und-PM":"fr-Latn-PM","und-RE":"fr-Latn-RE","und-SC":"fr-Latn-SC","und-SN":"fr-Latn-SN","und-TD":"fr-Latn-TD","und-TF":"fr-Latn-TF","und-TG":"fr-Latn-TG","und-WF":"fr-Latn-WF","und-YT":"fr-Latn-YT","ja":"ja-Jpan-JP","jab":"jab-Latn-ZZ","jam":"jam-Latn-JM","und-Hira":"ja-Hira-JP","und-JP":"ja-Jpan-JP","und-Jpan":"ja-Jpan-JP","und-Kana":"ja-Kana-JP"}}};
var plurals = {"supplemental":{"version":{"_unicodeVersion":"12.1.0","_cldrVersion":"36"},"plurals-type-cardinal":{"en":{"pluralRule-count-one":"i = 1 and v = 0 @integer 1","pluralRule-count-other":" @integer 0, 2~16, 100, 1000, 10000, 100000, 1000000, … @decimal 0.0~1.5, 10.0, 100.0, 1000.0, 10000.0, 100000.0, 1000000.0, …"},"fr":{"pluralRule-count-one":"i = 0,1 @integer 0, 1 @decimal 0.0~1.5","pluralRule-count-other":" @integer 2~17, 100, 1000, 10000, 100000, 1000000, … @decimal 2.0~3.5, 10.0, 100.0, 1000.0, 10000.0, 100000.0, 1000000.0, …"},"ja":{"pluralRule-count-other":" @integer 0~15, 100, 1000, 10000, 100000, 1000000, … @decimal 0.0~1.5, 10.0, 100.0, 1000.0, 10000.0, 100000.0, 1000000.0, …"}}}};
var cldrData = [weekData, ordinals, numberingSystems, parentLocales, likelySubtags, plurals];



cldrData.push(require('cldr-data/main/en/ca-gregorian.json'));
cldrData.push(require('cldr-data/main/en/dateFields.json'));
cldrData.push(require('cldr-data/main/en/timeZoneNames.json'));
cldrData.push(require('cldr-data/main/en/currencies.json'));
cldrData.push(require('cldr-data/main/en/numbers.json'));
cldrData.push(require('cldr-data/main/en/units.json'));


cldrData.push(require('cldr-data/main/fr/ca-gregorian.json'));
cldrData.push(require('cldr-data/main/fr/dateFields.json'));
cldrData.push(require('cldr-data/main/fr/timeZoneNames.json'));
cldrData.push(require('cldr-data/main/fr/currencies.json'));
cldrData.push(require('cldr-data/main/fr/numbers.json'));
cldrData.push(require('cldr-data/main/fr/units.json'));


cldrData.push(require('cldr-data/main/ja/ca-gregorian.json'));
cldrData.push(require('cldr-data/main/ja/dateFields.json'));
cldrData.push(require('cldr-data/main/ja/timeZoneNames.json'));
cldrData.push(require('cldr-data/main/ja/currencies.json'));
cldrData.push(require('cldr-data/main/ja/numbers.json'));
cldrData.push(require('cldr-data/main/ja/units.json'));

Globalize.load(cldrData)
i18n.setCldrLoaders({ 'en': true,'fr': true,'ja': true, supplemental: true });
i18n.setSupportedLocales(["en","fr","ja"]);
i18n.setDefaultLocale('en');
export default i18n.setLocale();
