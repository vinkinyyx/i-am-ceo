/**
 * R18：隐私政策全文（§15.4 R18）。
 * 单一事实来源：应用内弹窗完整阅读、docs/隐私政策 与运行时资源保持同版本。
 * 不依赖网络；URL 缺失时必须仍能在应用内读完全文。
 */
export const PRIVACY_POLICY_IN_APP_VERSION = 3;

export interface PrivacyPolicyText {
  version: number;
  title: string;
  effectiveDate: string;
  developer: string;
  contact: string;
  summary: string;
  sections: Array<{ heading: string; body: string }>;
}

export const PRIVACY_POLICY_TEXT: PrivacyPolicyText = {
  version: PRIVACY_POLICY_IN_APP_VERSION,
  title: '《我是CEO》隐私政策',
  effectiveDate: '2026-11-04',
  developer: '郁延鑫（个人开发者）',
  contact: 'vinkinyu@163.com',
  summary:
    '云备份与公开榜单默认关闭。玩家主动开启云备份后，存档快照会提交至 TapTap 云存档以便跨设备恢复；开启公开榜单后，公司资产和经营年限分数会公开展示。广告功能仍默认关闭。',
  sections: [
    {
      heading: '一、我们收集的信息（极少）',
      body: '1. 游戏存档（公司、员工、财务、设置）默认保存在设备本地。你主动开启云备份后，游戏会将存档快照提交给 TapTap 云存档，用于备份与跨设备恢复；未开启时不上传经营存档。云端数据受 TapTap 平台账号、云存档能力及其规则管理。\n2. TapTap 登录由平台提供，按平台当前隐私政策处理；本游戏不主动读取稳定账号标识。云存档仅在当前平台账号上下文中操作，并按本地绑定档案隔离。\n3. 你主动开启公开榜单后，当前公司的资产分数、经营年限分数及 TapTap 榜单服务展示所需的平台玩家身份信息会提交至对应公开榜单，其他玩家可能看到。榜单内容与保留规则由平台榜单配置决定。\n4. 音频、画面设置保存在设备本地。广告功能默认关闭，未启用平台广告组件。',
    },
    {
      heading: '二、第三方 SDK 说明',
      body: '本游戏使用 TapTap 小游戏登录、云存档与（玩家主动开启时）公开榜单能力；不主动获取 openid、unionid、昵称或头像。公开榜单会按平台实际接口展示玩家身份，关闭游戏内榜单同步不一定删除平台已提交记录，需以平台提供的功能为准。广告组件默认关闭。TapTap 平台对账号、云存档和榜单数据的处理适用其隐私政策（https://www.taptap.cn/privacy-policy ，以官网当期版本为准）。',
    },
    {
      heading: '三、信息的存储与保护',
      body: '本地存档保存在设备。主动开启云备份后，存档快照通过 TapTap 云存档服务跨设备保存；主动开启公开榜单后，分数及平台展示所需身份信息提交到 TapTap 榜单服务。云端保留期限、账号关联、删除能力和地区以平台实际规则为准，本政策不承诺本游戏端无法访问或特定保留期限。广告功能默认关闭。',
    },
    {
      heading: '四、未成年人保护',
      body: '本版本不含内购，广告功能关闭。云备份和公开榜单为可选功能。游戏时长与登录限制按 TapTap 平台当前要求执行。',
    },
    {
      heading: '五、你的权利',
      body: '关闭云备份或榜单同步可停止后续提交；这不保证删除此前已提交的云档或公开榜单记录，需通过 TapTap 平台支持的管理方式处理。删除本地数据可卸载游戏或清除游戏数据。撤回同意可在隐私设置中操作；再次开启云/榜功能前需重新同意本政策。平台账号及其云存档、榜单数据权利以 TapTap 提供的渠道为准。联系：vinkinyu@163.com。',
    },
    {
      heading: '六、政策更新',
      body: '如本政策发生变更，我们将在游戏内作出提示并更新版本号。重大变更时，会在游戏启动时再次征得你的同意。',
    },
    {
      heading: '七、联系我们',
      body: '如对本政策或信息处理有任何疑问、意见或投诉，请联系：vinkinyu@163.com。我们将在收到后 15 个工作日内回复。',
    },
  ],
};

/** 拼接为可滚动阅读的完整纯文本（不依赖 WebView/DOM）。 */
export function privacyPolicyFullText(): string {
  const p = PRIVACY_POLICY_TEXT;
  const head = `${p.title}\n生效日期：${p.effectiveDate}\n开发者：${p.developer}\n联系方式：${p.contact}\n\n${p.summary}\n`;
  return head + p.sections.map((s) => `\n${s.heading}\n${s.body}`).join('\n');
}
