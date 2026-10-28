const GROUPS = ['国内', '国外', '欧美', '日韩'];
const COUNTRIES = ['中国大陆', '中国香港', '中国台湾', '日本', '韩国', '美国', '英国', '法国', '泰国'];
const codes = ('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' ');
const domestic = new Set(['CN', 'HK', 'MO', 'TW']);
const western = new Set(('AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM UA VA AG AI AR AW BB BL BM BO BQ BR BS BZ CA CL CO CR CU CW DM DO EC FK GD GF GL GP GT GY HN HT JM KN KY LC MF MQ MS MX NI PA PE PM PR PY SR SV SX TC TT UM US UY VC VE VG VI').split(' '));
const names = new Intl.DisplayNames(['zh-Hans'], { type: 'region' });
const englishNames = new Intl.DisplayNames(['en'], { type: 'region' });
const canonical = code => ({ CN: '中国大陆', HK: '中国香港', MO: '中国澳门', TW: '中国台湾' })[code] || names.of(code);
const aliases = new Map();
for (const code of codes) for (const name of [code, canonical(code), names.of(code), englishNames.of(code)]) aliases.set(name.toLowerCase(), code);
for (const [name, code] of Object.entries({ 内地: 'CN', 大陆: 'CN', 中国内地: 'CN', 香港: 'HK', 澳门: 'MO', 台湾: 'TW', 台灣: 'TW', 香港特别行政区: 'HK', 澳门特别行政区: 'MO', 英格兰: 'GB', 美利坚合众国: 'US', USA: 'US', UK: 'GB', 国产: 'CN' })) aliases.set(name.toLowerCase(), code);
const regionCode = value => typeof value === 'string' ? aliases.get(value.trim().toLowerCase()) : undefined;
const regionName = code => regionCode(code) ? canonical(regionCode(code)) : '';
function matchesCode(code, selection) {
  if (!code) return false;
  if (selection === '国内') return domestic.has(code);
  if (selection === '国外') return !domestic.has(code);
  if (selection === '欧美') return western.has(code);
  if (selection === '日韩') return ['JP', 'KR'].includes(code);
  return code === regionCode(selection);
}
function matchesRegion(regions, selection) {
  return !selection || (Array.isArray(regions) && regions.some(region => matchesCode(regionCode(region), selection)));
}
function regionPattern(selection) {
  const values = [...aliases].filter(([, code]) => matchesCode(code, selection)).map(([name]) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return '"(' + values.join('|') + ')"';
}
function regionsFromTags(tags) {
  // A tag like "TV" is a format, not evidence that an anime was produced in Tuvalu.
  return [...new Set((Array.isArray(tags) ? tags : []).filter(tag => typeof tag === 'string' && !/^[a-z]{2}$/i.test(tag.trim())).map(tag => regionName(tag)).filter(Boolean))];
}
// These are the individual country filters already supported by the live UI.
// Stored catalog and personal library grouping supports all known country metadata.
const LIVE_COUNTRIES = { 国内: COUNTRIES.slice(0, 3), 国外: COUNTRIES.slice(3), 欧美: ['美国', '英国', '法国'], 日韩: ['日本', '韩国'] };
module.exports = { GROUPS, COUNTRIES, REGIONS: [...GROUPS, ...COUNTRIES], matchesRegion, regionPattern, regionName, regionsFromTags, LIVE_COUNTRIES };
