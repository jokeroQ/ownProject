const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '../../noIdea_Front/src/assets/maps');
const country = JSON.parse(fs.readFileSync(path.join(root, 'china.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'provinces/manifest.json'), 'utf8').replace(/^\uFEFF/, ''));
test('China city map assets preserve source geometry and match every available province', async t => {
  const provinces = country.features.filter(feature => typeof feature.properties.adcode === 'number');
  assert.equal(provinces.length, 34); assert.equal(manifest.length, 33);
  for (const province of provinces.filter(feature => feature.properties.childrenNum > 0)) {
    await t.test(province.properties.name, () => {
      const entry = manifest.find(item => item.adcode === province.properties.adcode); assert.ok(entry);
      const bytes = fs.readFileSync(path.join(root, `provinces/${entry.adcode}.json`));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
      const source = JSON.parse(bytes.toString('utf8')); assert.equal(source.type, 'FeatureCollection'); assert.equal(source.features.length, entry.features);
      assert.equal(new Set(source.features.map(feature => feature.properties.adcode)).size, entry.features);
      for (const feature of source.features) {
        assert.ok(feature.properties.name && Number.isInteger(feature.properties.adcode));
        assert.ok(['Polygon', 'MultiPolygon'].includes(feature.geometry.type));
        assert.ok(feature.geometry.coordinates.flat(Infinity).every(value => Number.isFinite(value)));
      }
    });
  }
});
