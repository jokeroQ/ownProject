# China province map source

- Provider: [DataV GeoAtlas](https://datav.aliyun.com/portal/school/atlas/area_selector)
- Download: https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json
- Retrieved: 2026-10-22
- SHA-256: 99adfeded5223848bbe37a0a12f8023e11ee12161c7800521c27db42fdeac275
- File: `china.json` (582,522 bytes), original response, no geometry edits.
- Contents: 34 named province-level features and the original maritime boundary feature (`100000_JD`).

The map is bundled locally; there are no runtime requests to the provider. Keep the source attribution in the page footer. Download the complete source again when updating; do not redraw or simplify individual borders manually.

## Province subdivisions

- Retrieved: 2026-10-22.
- Download pattern: `https://geo.datav.aliyun.com/areas_v3/bound/{provinceAdcode}_full.json`.
- Files: `provinces/{provinceAdcode}.json`, all 33 available provincial subdivision collections, 475 features, about 3.68 MiB total.
- Integrity: `provinces/manifest.json` records the source names, feature counts, byte sizes and SHA-256 hashes for every collection.
- Original response text and geometry are preserved. Data is served locally and cached; the initial view loads only the national source. On first zoom to city detail, the 27 ordinary provincial files are loaded with at most four concurrent requests and composed into a national city layer with the same bounding coordinates. Municipalities, Hong Kong and Macao retain their complete city outlines, and Taiwan retains its available province outline. No district-level drilldown is rendered.
- The source has no Taiwan subdivision collection. Its province view reuses the intact Taiwan feature from `china.json`, without inventing or redrawing city borders.
- Direct-administered municipalities, Hong Kong and Macao expose district-level features; other provinces expose the provider's city-level and directly administered subdivisions.
