const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

module.exports = async ({ page, api, artifacts }) => {
  artifacts ||= fs.mkdtempSync(path.join(os.tmpdir(), 'flow-layout-'));
  fs.mkdirSync(artifacts, { recursive: true });
  const results = [], origin = new URL(page.url()).origin;
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const request = async (method, route, body) => {
    const response = await fetch(api + route, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.ok(response.ok, method + ' ' + route); return (await response.json()).data;
  };
  const record = (check, data = {}) => { results.push({ check, passed: true, ...data }); console.log('PASS: ' + check); };
  const fitted = async label => {
    await page.waitForFunction(() => {
      const container = document.querySelector('.canvas-scroll'), svg = document.querySelector('.flow-canvas');
      if (!container || !svg) return false;
      const box = svg.getBoundingClientRect();
      return box.height > 80 && Math.abs(box.width - container.clientWidth) < 1 && Math.abs(box.height - container.clientHeight) < 1;
    });
    const metrics = await page.locator('.canvas-scroll').evaluate(container => {
      const svg = container.querySelector('svg'), bounds = container.getBoundingClientRect(), matrix = svg.getScreenCTM();
      return { width: container.clientWidth, height: container.clientHeight, scrollWidth: container.scrollWidth, scrollHeight: container.scrollHeight,
        scaleX: matrix.a, scaleY: matrix.d, pageWidth: document.documentElement.scrollWidth, pageHeight: document.documentElement.scrollHeight,
        viewportWidth: innerWidth, viewportHeight: innerHeight,
        nodesVisible: [...svg.querySelectorAll('[data-node]')].every(node => {
          const r = node.getBoundingClientRect();
          return r.left >= bounds.left && r.right <= bounds.right && r.top >= bounds.top && r.bottom <= bounds.bottom;
        }) };
    });
    assert.ok(metrics.scrollWidth <= metrics.width + 1 && metrics.scrollHeight <= metrics.height + 1, label + ': fit must not require canvas scrolling');
    assert.ok(metrics.nodesVisible, label + ': every node must fit in the canvas');
    assert.ok(Math.abs(metrics.scaleX - metrics.scaleY) < 0.0001, label + ': node proportions must remain unchanged');
    assert.ok(metrics.pageWidth <= metrics.viewportWidth + 1 && metrics.pageHeight <= metrics.viewportHeight + 1, label + ': page must fit its viewport');
    assert.match(await page.locator('.zoom-select').innerText(), /适应容器/);
    record(label, metrics);
  };
  const zoomTo = async label => {
    await page.locator('.zoom-select .el-select__wrapper').click();
    await page.getByRole('option', { name: label, exact: true }).click();
    await page.waitForFunction(value => document.querySelector('.zoom-select')?.textContent.includes(value), label);
  };
  const position = async node => node.evaluate(element => {
    const matrix = element.transform.baseVal.consolidate().matrix;
    return { x: matrix.e, y: matrix.f };
  });
  const dragNode = async (node, dx, dy, label) => {
    await node.scrollIntoViewIfNeeded();
    const before = await position(node), bounds = await node.boundingBox();
    const scale = await page.locator('.flow-canvas').evaluate(svg => svg.getScreenCTM().a);
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2 + dx * scale, bounds.y + bounds.height / 2 + dy * scale, { steps: 8 });
    await page.mouse.up();
    const after = await position(node);
    assert.ok(Math.abs(after.x - before.x - dx) <= 1 && Math.abs(after.y - before.y - dy) <= 1, label + ': dragging must map to diagram coordinates');
    record(label, { before, after, scale });
  };
  try {
    for (const mode of ['light', 'dark']) {
      await request('PUT', '/theme', { mode, primaryColor: '#409eff', overlay: 0.35 });
      for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1024, 768], [1366, 768], [1920, 1080], [844, 390]]) {
        await page.setViewportSize({ width, height });
        await page.goto(origin + '/flowchart'); await page.locator('[data-node]').first().waitFor();
        await page.waitForFunction(value => document.documentElement.dataset.theme === value, mode);
        const name = `${mode}-${width}x${height}`;
        await fitted(name + ' default canvas');
        if ([390, 1366, 844].includes(width)) await page.screenshot({ path: path.join(artifacts, name + '.png'), fullPage: true });
        const colors = await page.evaluate(() => ({ canvas: getComputedStyle(document.querySelector('.canvas-stage')).backgroundColor,
          label: getComputedStyle(document.querySelector('.node-label')).fill, body: getComputedStyle(document.body).color }));
        assert.equal(colors.label, colors.body, name + ': node text must follow the active theme');
        await page.locator('[data-node]').first().press('Enter');
        await page.locator('#flow-label').waitFor(); await fitted(name + ' properties open');
        assert.equal(await page.locator('[data-flow-inspector-toggle]').getAttribute('aria-expanded'), 'true');
        if (width === 1366) await page.screenshot({ path: path.join(artifacts, name + '-properties.png'), fullPage: true });
        await page.locator('[data-flow-inspector-close]').click(); await fitted(name + ' properties closed');
        assert.equal(await page.locator('[data-flow-inspector-toggle]').getAttribute('aria-expanded'), 'false');
        await zoomTo('100%');
        const manual = await page.locator('.canvas-scroll').evaluate(container => {
          const bounds = container.querySelector('svg').getBoundingClientRect();
          container.scrollLeft = 200; container.scrollTop = 200;
          return { width: bounds.width, height: bounds.height, viewportWidth: container.clientWidth, viewportHeight: container.clientHeight,
            left: container.scrollLeft, top: container.scrollTop };
        });
        assert.equal(manual.width, 1600); assert.equal(manual.height, 1000);
        if (manual.viewportWidth < 1600) assert.ok(manual.left > 0);
        if (manual.viewportHeight < 1000) assert.ok(manual.top > 0);
        record(name + ' manual zoom and internal scrolling', manual);
        await page.getByRole('button', { name: '适应容器', exact: true }).click();
        await fitted(name + ' fit restored');
        await page.setViewportSize({ width: width + 64, height: height + 40 });
        await fitted(name + ' live container resize');
      }
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(origin + '/flowchart'); await page.locator('[data-node]').first().waitFor();
    await page.getByRole('button', { name: '+ 步骤', exact: true }).click();
    const added = page.locator('[data-node]').last(), addedId = await added.getAttribute('data-node');
    await page.locator('#flow-label').fill('自适应流程步骤'); await page.locator('#flow-label').blur();
    await dragNode(added, 50, 35, 'drag node in fit view');
    await zoomTo('100%'); await dragNode(added, 40, 25, 'drag node at 100%');
    await page.getByRole('button', { name: '适应容器', exact: true }).click();
    await page.getByRole('button', { name: '连线', exact: true }).click();
    await page.locator('[data-node="start"]').press('Enter'); await added.press('Enter');
    assert.equal(await page.locator('[data-edge]').count(), 4);
    const undo = page.getByRole('button', { name: '撤销', exact: true }); await undo.focus(); await undo.press('Enter');
    assert.equal(await page.locator('[data-edge]').count(), 3);
    await page.getByRole('button', { name: '重做', exact: true }).click(); assert.equal(await page.locator('[data-edge]').count(), 4);
    await page.getByRole('button', { name: '保存流程图', exact: true }).click();
    await page.getByText('流程图已保存', { exact: true }).waitFor();
    const saved = await request('GET', '/flowchart');
    assert.equal(saved.document.nodes.find(node => node.id === addedId).label, '自适应流程步骤');
    assert.equal(saved.document.nodes.length, 5); assert.equal(saved.document.edges.length, 4);
    await page.reload(); await page.locator('[data-node]').first().waitFor();
    await fitted('saved diagram reloads in fit view');
    record('add, edit, connect, keyboard undo, redo and account save');
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出 SVG', exact: true }).click();
    const exported = fs.readFileSync(await (await downloadEvent).path(), 'utf8');
    assert.ok(exported.includes('自适应流程步骤'));
    const previewContext = await page.context().browser().newContext();
    const preview = await previewContext.newPage();
    try {
      await preview.setContent(exported);
      assert.equal(await preview.locator('svg').getAttribute('width'), '1600');
      assert.equal(await preview.locator('svg').getAttribute('height'), '1000');
      assert.equal(await preview.locator('.canvas-background').evaluate(element => getComputedStyle(element).fill), 'rgb(248, 250, 252)');
      assert.equal(await preview.locator('.node-label').first().evaluate(element => getComputedStyle(element).fill), 'rgb(30, 41, 59)');
    } finally { await previewContext.close(); }
    record('SVG export renders independently of the page theme');
    await zoomTo('125%'); await page.getByRole('button', { name: '+ 结束', exact: true }).click();
    await page.locator('input[type=file]').setInputFiles({ name: 'flow-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved.document)) });
    await page.locator('.el-message-box').getByRole('button', { name: '导入', exact: true }).click();
    assert.equal(await page.locator('[data-node]').count(), 5); await fitted('import restores fitted canvas');
    await page.getByRole('button', { name: '+ 判断', exact: true }).click();
    await page.getByRole('button', { name: '返回收藏', exact: true }).click();
    await page.locator('.el-message-box').getByRole('button', { name: '继续编辑', exact: true }).click();
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    await page.getByRole('button', { name: '返回收藏', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/home');
    record('import and unsaved-change protection retain their behavior');
  } catch (error) {
    results.push({ check: 'flowchart scenario', passed: false, message: error.message });
    await page.screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }); throw error;
  } finally { fs.writeFileSync(path.join(artifacts, 'report.json'), JSON.stringify(results, null, 2)); }
  console.log(`Flowchart browser audit: ${results.length} checks passed`);
};
