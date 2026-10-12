const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const { UserTheme, User, sequelize } = require('../models');
const DEFAULTS = { mode: 'light', primaryColor: '#409eff', overlay: 0.35, hasBackground: false };
const storageRoot = () => path.resolve(process.env.THEME_UPLOAD_DIR || path.join(__dirname, '../uploads/themes'));
const error = (message, status = 400) => Object.assign(new Error(message), { status });
const filePath = file => {
  if (!/^[a-f0-9]{32}\.webp$/.test(file || '')) throw error('背景文件不存在', 404);
  return path.join(storageRoot(), file);
};
const serialize = theme => theme ? ({ mode: theme.mode, primaryColor: theme.primary_color,
  overlay: theme.overlay, hasBackground: Boolean(theme.background_file) }) : { ...DEFAULTS };
const removeFile = async file => {
  if (!file) return;
  try { await fs.unlink(filePath(file)); }
  catch (err) { if (err.code !== 'ENOENT') console.error('清理主题图片失败：', err.message); }
};
async function change(userId, operation) {
  return sequelize.transaction(async transaction => {
    // Serialize changes even when the user's theme row does not exist yet.
    await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    const [theme] = await UserTheme.findOrCreate({ where: { user_id: userId }, transaction });
    return operation(theme, transaction);
  });
}
exports.get = async userId => serialize(await UserTheme.findByPk(userId));
exports.update = async (userId, values) => {
  if (!values || !['light', 'dark'].includes(values.mode) ||
      typeof values.primaryColor !== 'string' || !/^#[a-fA-F0-9]{6}$/.test(values.primaryColor) ||
      typeof values.overlay !== 'number' || !Number.isFinite(values.overlay) || values.overlay < 0 || values.overlay > 0.85) {
    throw error('请选择有效主题、颜色和遮罩透明度（0–0.85）');
  }
  return change(userId, async (theme, transaction) => {
    await theme.update({ mode: values.mode, primary_color: values.primaryColor.toLowerCase(), overlay: values.overlay }, { transaction });
    return serialize(theme);
  });
};
exports.upload = async (userId, buffer) => {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw error('请上传 JPEG、PNG 或 WebP 图片');
  if (buffer.length > 5 * 1024 * 1024) throw error('图片不能超过5MB', 413);
  let output;
  try {
    const image = sharp(buffer, { limitInputPixels: 40000000, animated: false });
    const metadata = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) throw new Error('不支持的图片格式');
    // Decode, resize and re-encode; never serve uploaded HTML/SVG or preserve EXIF data.
    output = await image.rotate().resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  } catch { throw error('无法读取图片，请使用有效的静态 JPEG、PNG 或 WebP 文件'); }
  await fs.mkdir(storageRoot(), { recursive: true });
  const file = crypto.randomBytes(16).toString('hex') + '.webp';
  await fs.writeFile(filePath(file), output, { flag: 'wx' });
  let result;
  try {
    result = await change(userId, async (theme, transaction) => {
      const oldFile = theme.background_file;
      await theme.update({ background_file: file }, { transaction });
      return { oldFile, theme: serialize(theme) };
    });
  } catch (err) { await removeFile(file); throw err; }
  await removeFile(result.oldFile);
  return result.theme;
};
exports.background = async userId => {
  const theme = await UserTheme.findByPk(userId);
  if (!theme?.background_file) throw error('尚未设置背景图片', 404);
  try { return await fs.readFile(filePath(theme.background_file)); }
  catch (err) { if (err.code === 'ENOENT') throw error('背景图片已丢失，请重新上传', 404); throw err; }
};
exports.removeBackground = async (userId, reset = false) => {
  const result = await change(userId, async (theme, transaction) => {
    const oldFile = theme.background_file;
    await theme.update({ background_file: null,
      ...(reset ? { mode: DEFAULTS.mode, primary_color: DEFAULTS.primaryColor, overlay: DEFAULTS.overlay } : {}),
    }, { transaction });
    return { oldFile, theme: serialize(theme) };
  });
  await removeFile(result.oldFile);
  return result.theme;
};
