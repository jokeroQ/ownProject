const builtins = new Set(['--background-main', '--background-header', '--background-aside', '--el-bg-color-overlay', '--font-primary', '--font-highlight', '--theme-muted', '--el-text-color-placeholder', '--el-border-color', '--el-border-color-light', '--el-fill-color-light', '--el-color-primary-light-9']);
function validateColorCards(cards) {
  const fail = () => { throw Object.assign(new Error('色卡格式不正确：名称1–24字，颜色为十六进制，新增变量需以 --custom- 开头且不能重复'), { status: 400 }); };
  if (!Array.isArray(cards) || cards.length > 60) fail();
  const names = new Set();
  return cards.map(card => {
    if (!card || typeof card.label !== 'string' || !card.label.trim() || card.label.trim().length > 24 || typeof card.variable !== 'string' ||
      (!builtins.has(card.variable) && !/^--custom-[a-z][a-z0-9-]{0,55}$/.test(card.variable)) || names.has(card.variable)) fail();
    names.add(card.variable);
    for (const mode of ['light', 'dark']) if (card[mode] !== undefined && (typeof card[mode] !== 'string' || !/^#[a-f0-9]{6}([a-f0-9]{2})?$/i.test(card[mode]))) fail();
    if (!card.light && !card.dark) fail();
    return { label: card.label.trim(), variable: card.variable, ...(card.light ? { light: card.light.toLowerCase() } : {}), ...(card.dark ? { dark: card.dark.toLowerCase() } : {}) };
  });
}
module.exports = { validateColorCards };
