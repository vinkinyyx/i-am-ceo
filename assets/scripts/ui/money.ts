/**
 * R27：金额展示格式化（纯函数，无引擎依赖）。
 * 领域层只存整数元；展示层统一加 ¥ 与千分位，负值带负号（不靠颜色单独表达）。
 */
export function moneyText(yuan: number): string {
  const sign = yuan < 0 ? '-' : '';
  const abs = Math.abs(yuan);
  return `${sign}¥${abs.toLocaleString('zh-CN')}`;
}
