import { Color } from 'cc';

/**
 * 视觉主题（设计文档 13.2）。
 * 主色蓝、辅色青绿、浅背景、深字；盈亏同时用正负号+颜色，不只靠颜色。
 */
export const THEME = {
  primary: new Color().fromHEX('#3668B2'),
  secondary: new Color().fromHEX('#5D9F8C'),
  bg: new Color().fromHEX('#F5F7FB'),
  card: new Color().fromHEX('#FFFFFF'),
  text: new Color().fromHEX('#273244'),
  textWeak: new Color().fromHEX('#697386'),
  danger: new Color().fromHEX('#C75353'),
  profit: new Color().fromHEX('#2E9E6B'),
  divider: new Color().fromHEX('#E3E8F0'),
  warning: new Color().fromHEX('#D9922E'),
  disabled: new Color().fromHEX('#B7BFCB'),
};

export const DESIGN_WIDTH = 375;
export const DESIGN_HEIGHT = 812;
export const MIN_TOUCH = 44;
