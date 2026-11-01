import {
  Color,
  Component,
  Graphics,
  Node,
  profiler,
  Size,
  UITransform,
  Vec3,
  view,
  Widget,
} from 'cc';
import { GameFacade } from '../../core/application/GameFacade';
import type { CandidateOffer, GameState, GameSpeed, IndustryId, CeoTrait, AnnualReport, SupportDeptType, Policy, Department, Employee } from '../../core/domain/types';
import { SUPPORT_DEPARTMENTS } from '../../core/domain/types';
import { createPlatform } from '../platform/PlatformFactory';
import { resolveSafeAreaTransform } from '../platform/SafeArea';
import { loadEconomyConfig } from '../platform/loadConfig';
import { loadRuntimeConfig } from '../platform/loadRuntimeConfig';
import { getRuntimeConfig } from '../platform/runtimeConfig';
import { AuthService } from '../../core/platform/AuthService';
import { acceptPrivacy, hasAcceptedPrivacy } from '../../core/platform/privacyConsent';
import { GameError } from '../../core/domain/errors';
import { bootTrapError, bootTrapReady, bootTrapWatchdog } from '../boot/BootTrap';
import {
  createButton,
  createLabel,
  createRect,
  moneyText,
  stretchToParent,
} from './UiFactory';
import { THEME, DESIGN_WIDTH, DESIGN_HEIGHT } from './theme';
import { audioManager } from '../audio/AudioManager';

type TabId = 'COMPANY' | 'DEPARTMENT' | 'TALENT' | 'RANK';

const INDUSTRY_LABELS: Record<IndustryId, string> = {
  TRADE: '电商贸易',
  SOFTWARE: '软件科技',
  SERVICE: '企业服务',
};

const TRAIT_LABELS: Record<CeoTrait, { name: string; desc: string }> = {
  BOLD: { name: '进取', desc: '每年 商业+2 管理+1 财务+1，擅长开发市场' },
  STEADY: { name: '稳健', desc: '每年 商业+1 管理+1 财务+2，擅长资金管理' },
  PEOPLE: { name: '亲和', desc: '每年 商业+1 管理+2 财务+1，擅长团队协作' },
};

const SUPPORT_DEPT_META: Record<SupportDeptType, { name: string; desc: string }> = {
  PROCUREMENT: { name: '采购部', desc: '降低可适用的直接采购成本' },
  CUSTOMER_SERVICE: { name: '客服部', desc: '降低售后费用' },
  MARKETING: { name: '市场部', desc: '提升潜在订单（受产能上限）' },
  FINANCE: { name: '财务部', desc: '降低固定管理费用' },
  HR: { name: '人力资源部', desc: '提升业务产能、降低招聘费' },
};

const POLICY_META: Record<Policy, { name: string; desc: string }> = {
  STEADY: { name: '稳健', desc: 'ROI≥1.0，保留6个月刚性费用' },
  GROWTH: { name: '扩张', desc: 'ROI≥0.8，适度提前准备产能' },
  PROFIT: { name: '利润优先', desc: 'ROI≥1.2，保留9个月刚性费用' },
};

let commandSeq = 0;
function nextCommandId(prefix: string): string {
  commandSeq += 1;
  return `${prefix}_${Date.now().toString(36)}_${commandSeq}`;
}

/**
 * 游戏主界面（设计文档 07 路由 S00/S01/S02/S03/T01-T04/D04/D05）。
 * 单一入口：bootstrap 后根据 phase 渲染；所有动作经 GameFacade 命令，不直接改状态。
 */
export class AppView extends Component {
  private facade!: GameFacade;
  private platform: ReturnType<typeof createPlatform> | null = null;
  private auth: AuthService | null = null;
  private authed = false;
  private root!: Node;
  private toastNode: Node | null = null;
  private selectedIndustry: IndustryId = 'TRADE';
  private selectedTrait: CeoTrait = 'BOLD';
  private customCompanyName = '';
  private customCeoName = '';
  private randomCompanyNames: string[] = [];
  private selectedNameIndex = 0;
  private activeTab: TabId = 'COMPANY';
  private rankMode: 'assets' | 'years' = 'assets';
  private pendingOffer: CandidateOffer | null = null;

  async start(): Promise<void> {
    // 启动故障捕获：真机卡启动页时把错误显示在屏幕上（诊断设施，ready 后自动失效）
    bootTrapWatchdog(this.node);
    try {
    // 关闭屏幕左下角调试统计面板（发布包不应显示）
    profiler.hideStats();
    audioManager.loadSettings();
    const platform = createPlatform();
    this.platform = platform;
    const [cfg] = await Promise.all([loadEconomyConfig(), loadRuntimeConfig()]);
    this.auth = new AuthService(platform, { endpoint: getRuntimeConfig().authEndpoint });
    this.facade = await GameFacade.bootstrap(platform, cfg);
    // 回前台先记录时间点；进入后台记录水位，用于离线结算
    this.lastForegroundMs = Date.now();
    this.buildRoot();
    this.render();

    // 首次启动隐私告知：未同意当前版本隐私政策前，先展示政策弹窗（A23）
    const privacyAccepted = await hasAcceptedPrivacy(platform);
    if (!privacyAccepted) {
      this.renderPrivacyDialog();
    } else {
      void this.ensurePlatformLogin(false);
    }

    bootTrapReady();

    // 首次触摸解锁音频（浏览器自动播放策略），并播放经营 BGM
    this.node.once(Node.EventType.TOUCH_START, () => {
      audioManager.unlock();
      const s = this.state();
      if (s.phase === 'RUNNING') void audioManager.playBgm('operation');
      else void audioManager.playBgm('startup');
    });

    // 在线经营时钟：按真实帧时间推进（仅 RUNNING 且 speed>0 时月结）
    this.schedule(this.clockTick, 0.2);

    // 前后台生命周期：进后台暂停音频+记水位；回前台做离线结算
    platform.onHide(() => {
      this.lastBackgroundMs = Date.now();
      audioManager.onAppHide();
      this.toast('已自动保存');
    });
    platform.onShow(() => this.onReturnForeground());
    } catch (err) {
      bootTrapError(err);
      throw err;
    }
  }

  /**
   * 平台登录（设计 08.4）。
   * 真机：隐私同意后调用；失败不阻断本地单机玩法，展示可重试的提示条。
   * @param silent true=静默尝试验证已有会话（回前台等场景），失败不弹强提示
   */
  private async ensurePlatformLogin(silent: boolean): Promise<void> {
    if (!this.auth) return;
    if (this.authed) return;
    try {
      const session = await this.auth.ensureAuthenticated();
      this.authed = true;
      if (!silent || session.kind === 'taptap') this.toast('平台登录成功');
    } catch (err) {
      this.authed = false;
      const code = err instanceof GameError ? err.code : '';
      if (silent) return;
      if (code === 'PLATFORM_UNAVAILABLE') {
        this.toast('网络或登录服务暂不可用，可先本地游玩');
      } else {
        this.renderLoginRetry();
      }
    }
  }

  /** 登录失败的可重试浮层（不抹本地经营档，可跳过进入单机玩法）。 */
  private renderLoginRetry(): void {
    const overlay = this.modalOverlay();
    createRect({ width: 300, height: 250, color: Color.WHITE, radius: 12, parent: overlay }).setPosition(0, 0);
    createLabel({ text: '平台登录未完成', fontSize: 18, bold: true, parent: overlay }).setPosition(0, 92);
    createLabel({
      text: 'TapTap 登录暂时失败。\n你的经营进度只保存在本机，不会丢失。\n可重试登录，或先进入单机游玩。',
      fontSize: 13,
      color: THEME.text,
      width: 250,
      lineHeight: 22,
      parent: overlay,
    }).setPosition(0, 20);
    createButton({
      text: '重试登录',
      width: 220,
      height: 46,
      parent: overlay,
      onClick: () => {
        overlay.destroy();
        void this.ensurePlatformLogin(false);
      },
    }).setPosition(0, -56);
    createButton({
      text: '先进入单机游玩',
      width: 220,
      height: 40,
      fontSize: 13,
      color: Color.WHITE,
      textColor: THEME.primary,
      parent: overlay,
      onClick: () => overlay.destroy(),
    }).setPosition(0, -106);
  }

  /** 首次启动隐私政策告知弹窗（同意前不进行任何平台登录/网络请求）。 */
  private renderPrivacyDialog(): void {
    const overlay = this.modalOverlay();
    const hasUrl = getRuntimeConfig().privacyPolicyUrl.length > 0;
    const cardH = hasUrl ? 420 : 396;
    createRect({ width: 312, height: cardH, color: Color.WHITE, radius: 12, parent: overlay }).setPosition(0, 0);
    createLabel({ text: '隐私保护提示', fontSize: 19, bold: true, parent: overlay }).setPosition(0, cardH / 2 - 28);
    createLabel({
      text:
        '《我是CEO》是本地单机经营游戏。\n' +
        '· 公司、员工、财务等经营数据仅保存在本设备，不上传、不采集；\n' +
        '· 无广告、无内购、不申请位置/相机/麦克风等无关权限；\n' +
        '· 平台登录仅用于完成 TapTap 必要的身份核验；\n' +
        '· 关闭公司只清除本机本局经营档，不注销平台账号。\n' +
        '点击“同意并继续”即表示你已阅读并同意《隐私政策》。',
      fontSize: 12,
      color: THEME.text,
      width: 268,
      lineHeight: 19,
      align: 'left',
      parent: overlay,
    }).setPosition(0, hasUrl ? 42 : 30);

    if (hasUrl) {
      createButton({
        text: '查看《隐私政策》',
        width: 200,
        height: 38,
        fontSize: 13,
        color: Color.WHITE,
        textColor: THEME.primary,
        parent: overlay,
        onClick: () => this.openPrivacyPolicy(getRuntimeConfig().privacyPolicyUrl),
      }).setPosition(0, -cardH / 2 + 104);
    }
    createButton({
      text: '同意并继续',
      width: 240,
      height: 48,
      parent: overlay,
      onClick: () => void this.onAcceptPrivacy(overlay),
    }).setPosition(0, -cardH / 2 + 34);
  }

  private async onAcceptPrivacy(overlay: Node): Promise<void> {
    if (!this.platform) return;
    await acceptPrivacy(this.platform);
    overlay.destroy();
    await this.ensurePlatformLogin(false);
    this.render();
  }

  /** 打开隐私政策：真机经 tap 能力受限，最小实现为复制/展示 URL；web 用新窗口。 */
  private openPrivacyPolicy(url: string): void {
    const overlay = this.modalOverlay();
    createRect({ width: 290, height: 190, color: Color.WHITE, radius: 12, parent: overlay }).setPosition(0, 0);
    createLabel({ text: '隐私政策链接', fontSize: 17, bold: true, parent: overlay }).setPosition(0, 66);
    createLabel({ text: url, fontSize: 12, color: THEME.primary, width: 240, parent: overlay }).setPosition(0, 16);
    createLabel({
      text: '如未自动打开，请在浏览器访问以上地址查看完整政策。',
      fontSize: 11,
      color: THEME.textWeak,
      width: 240,
      parent: overlay,
    }).setPosition(0, -24);
    createButton({
      text: '知道了',
      width: 180,
      height: 42,
      parent: overlay,
      onClick: () => overlay.destroy(),
    }).setPosition(0, -68);
    // web/编辑器可直接打开；真机运行时没有 DOM，打开失败静默（链接已展示）
    try {
      const g = globalThis as { open?: (u: string) => void };
      g.open?.(url);
    } catch {
      // ignore：小游戏运行时无 window.open
    }
  }

  private lastForegroundMs = 0;
  private lastBackgroundMs = 0;

  private async onReturnForeground(): Promise<void> {
    if (!this.facade) return;
    const now = Date.now();
    const leftAt = this.lastBackgroundMs || this.lastForegroundMs;
    this.lastForegroundMs = now;
    audioManager.onAppShow();
    // 回到前台静默重验平台会话（过期则后台刷新，不打断单机玩法）
    void this.ensurePlatformLogin(true);
    if (!leftAt || now <= leftAt) return;
    const s = this.facade.getState();
    if (s.phase !== 'RUNNING' || s.speed === 0) return;
    const r = await this.facade.settleOffline(now);
    if (r.ok && r.payload.monthsSettled > 0) {
      this.renderOfflineSummary(r.payload);
      this.render();
    }
  }

  /** 离线结算摘要弹窗（M3-01）。 */
  private renderOfflineSummary(p: { monthsSettled: number; yearsClosed: number[]; cashBefore: number; cashAfter: number }): void {
    const overlay = this.modalOverlay();
    createRect({ width: 310, height: 260, color: Color.WHITE, radius: 12, parent: overlay }).setPosition(0, 0);
    createLabel({ text: '欢迎回来', fontSize: 20, bold: true, parent: overlay }).setPosition(0, 92);
    createLabel({
      text:
        `离线期间结算 ${p.monthsSettled} 个月` +
        (p.yearsClosed.length ? `（含 ${p.yearsClosed.length} 个年度结算）` : '') +
        `\n现金：${moneyText(p.cashBefore)} → ${moneyText(p.cashAfter)}` +
        `\n净变化：${moneyText(p.cashAfter - p.cashBefore)}`,
      fontSize: 14,
      color: THEME.text,
      width: 260,
      lineHeight: 24,
      parent: overlay,
    }).setPosition(0, 20);
    createButton({
      text: '知道了',
      width: 180,
      height: 46,
      parent: overlay,
      onClick: () => overlay.destroy(),
    }).setPosition(0, -84);
  }

  private clockTick(): void {
    if (!this.facade) return;
    const s = this.facade.getState();
    if (s.phase !== 'RUNNING' || s.speed === 0) return;
    void this.facade
      .advanceRealTime(200, s.runId)
      .then((r) => {
        if (!r.ok || (r.payload.monthsAdvanced === 0 && r.payload.yearsClosed.length === 0)) return;
        // 年结短乐：按刚关闭年份的盈亏播放
        for (const y of r.payload.yearsClosed) {
          const rep = this.facade!.getAnnualReport(y);
          if (rep) {
            if (rep.profitYuan >= 0) void audioManager.yearProfit();
            else void audioManager.yearLoss();
          }
        }
        const after = this.facade!.getState();
        if (after.target3YearsAchieved && !s.target3YearsAchieved) void audioManager.threeYearGoal();
        this.render();
      })
      .catch(() => undefined);
  }

  private buildRoot(): void {
    const canvas = this.node;
    // 全屏背景（不随安全区缩放），保证安全区外的留白与应用底色一致
    const backdrop = createRect({
      name: 'Backdrop',
      width: DESIGN_WIDTH,
      height: DESIGN_HEIGHT,
      color: THEME.bg,
      radius: 0,
      parent: canvas,
    });
    backdrop.setPosition(0, 0);
    stretchToParent(backdrop);

    this.root = new Node('AppRoot');
    this.root.parent = canvas;
    this.root.addComponent(UITransform).setContentSize(new Size(DESIGN_WIDTH, DESIGN_HEIGHT));
    // 安全区避让（A21）：375×812 内容层在安全区内等比缩放并居中；
    // 编辑器/无安全区时为恒等变换（scale=1），与历史布局一致。
    let scaled = false;
    if (this.platform) {
      const safe = resolveSafeAreaTransform(this.platform);
      if (safe.applied) {
        this.root.setScale(new Vec3(safe.scale, safe.scale, 1));
        this.root.setPosition(safe.offsetX, safe.offsetY, 0);
        scaled = true;
      }
    }
    // 无安全区数据（Web 预览/旧机型）时按可视高度兜底缩放：
    // 640 高度机型上 812 设计高会被上下裁切，导致顶部信息与底部导航不可见（BUG-002）
    if (!scaled) {
      const visible = view.getVisibleSize();
      const fit = visible.height > 0 ? visible.height / DESIGN_HEIGHT : 1;
      if (fit < 0.98) {
        this.root.setScale(new Vec3(fit, fit, 1));
      }
    }
    const widget = this.root.addComponent(Widget);
    widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
    widget.top = widget.bottom = widget.left = widget.right = 0;
    // 已手动设置安全区缩放/位移，禁止 Widget 再次对齐覆盖
    widget.enabled = false;
  }

  private clearRoot(): void {
    this.root.destroyAllChildren();
    this.toastNode = null;
  }

  private state(): GameState {
    return this.facade.getState();
  }

  // ---------------------------------------------------------------- 路由渲染

  private render(): void {
    this.clearRoot();
    const s = this.state();
    if (s.phase === 'CREATING') {
      if (this.customCompanyName === '' && this.randomCompanyNames.length === 0) {
        this.selectedIndustry = 'TRADE';
        this.rollNames();
      }
      this.renderCreateCompany();
    } else if (s.phase === 'HIRING_INITIAL') {
      this.renderInitialHiring();
    } else {
      this.renderMainShell();
      if (s.phase === 'DISTRESS') this.renderDistressDialog();
    }
  }

  /** 经营困难弹窗：现金无法覆盖下月刚性费用，引导救助（一次性10万）。 */
  private renderDistressDialog(): void {
    const s = this.state();
    const risk = this.facade.assessRisk();
    const overlay = this.modalOverlay();
    createRect({ width: 320, height: 320, color: Color.WHITE, radius: 12, parent: overlay }).setPosition(0, 0);
    createLabel({ text: '经营困难', fontSize: 20, bold: true, color: THEME.danger, parent: overlay }).setPosition(0, 122);
    const rescueHint = s.rescueCapitalUsed
      ? '救助资本已使用，无法再次领取。\n请裁员、降低工资支出或关闭公司重开。'
      : `当前现金 ${moneyText(risk.cash)}，下月必要支出约 ${moneyText(risk.nextMonthNeed)}。\n月结已暂停，时间不会继续推进。`;
    createLabel({
      text: rescueHint,
      fontSize: 13,
      color: THEME.text,
      width: 266,
      lineHeight: 22,
      parent: overlay,
    }).setPosition(0, 50);

    if (!s.rescueCapitalUsed) {
      createButton({
        text: '领取 10 万元 CEO 救助资本',
        width: 250,
        height: 48,
        color: THEME.secondary,
        parent: overlay,
        onClick: () => void this.onRescue(overlay),
      }).setPosition(0, -56);
    }
    createButton({
      text: '我再想想（去裁员/调整）',
      width: 220,
      height: 42,
      fontSize: 13,
      color: Color.WHITE,
      textColor: THEME.text,
      parent: overlay,
      onClick: () => overlay.destroy(),
    }).setPosition(0, -112);
  }

  private async onRescue(overlay: Node): Promise<void> {
    const s = this.state();
    const r = await this.facade.injectRescueCapital({
      commandId: nextCommandId('rescue'),
      expectedRunId: s.runId,
    });
    overlay.destroy();
    if (!r.ok) {
      this.toast(r.displayMessage);
      return;
    }
    this.toast(`已到账救助资本 ${moneyText(r.payload.amountYuan)}（不计收入/利润）`);
    this.render();
  }

  // ---------------------------------------------------------------- S01 创建公司

  private rollNames(): void {
    const rolled = this.facade.rollCompanyNames(this.selectedIndustry, 3);
    this.randomCompanyNames = Array.from(rolled).map((n) => String(n));
    this.selectedNameIndex = 0;
  }

  private renderCreateCompany(): void {
    const panel = this.fullPanel();
    createLabel({ text: '《我是CEO》', fontSize: 26, bold: true, color: THEME.primary, parent: panel })
      .setPosition(0, 340);
    createLabel({ text: '1/3 创建公司', fontSize: 13, color: THEME.textWeak, parent: panel }).setPosition(
      0,
      308,
    );

    createLabel({ text: '选择主营行业', fontSize: 14, bold: true, parent: panel }).setPosition(
      0,
      268,
    );
    createLabel({ text: '（创建后不可更换）', fontSize: 11, color: THEME.textWeak, parent: panel }).setPosition(
      0,
      250,
    );
    (Object.keys(INDUSTRY_LABELS) as IndustryId[]).forEach((id, i) => {
      const selected = this.selectedIndustry === id;
      const btn = createButton({
        text: INDUSTRY_LABELS[id],
        width: 320,
        height: 48,
        color: selected ? THEME.primary : Color.WHITE,
        textColor: selected ? Color.WHITE : THEME.text,
        parent: panel,
        onClick: () => {
          this.selectedIndustry = id;
          this.rollNames();
          this.render();
        },
      });
      btn.setPosition(0, 222 - i * 56);
    });

    createLabel({ text: '公司名称', fontSize: 14, bold: true, parent: panel }).setPosition(0, 56);
    this.randomCompanyNames.forEach((name, i) => {
      const selected = this.selectedNameIndex === i;
      createButton({
        text: name,
        width: 320,
        height: 44,
        fontSize: 13,
        color: selected ? THEME.secondary : Color.WHITE,
        textColor: selected ? Color.WHITE : THEME.text,
        parent: panel,
        onClick: () => {
          this.selectedNameIndex = i;
          this.render();
        },
      }).setPosition(0, 20 - i * 54);
    });

    createButton({
      text: '换一批',
      width: 100,
      height: 38,
      color: Color.WHITE,
      textColor: THEME.primary,
      fontSize: 13,
      parent: panel,
      onClick: () => {
        this.rollNames();
        this.render();
      },
    }).setPosition(0, -178);
    createLabel({
      text: '（也可在后续版本使用自定义名称）',
      fontSize: 11,
      color: THEME.textWeak,
      width: 320,
      parent: panel,
    }).setPosition(0, -214);

    const chosenName = this.randomCompanyNames[this.selectedNameIndex] ?? '';
    createButton({
      text: '下一步：创建 CEO',
      width: 320,
      height: 50,
      parent: panel,
      disabled: chosenName.length < 2,
      onClick: () => this.renderCreateCeo(),
    }).setPosition(0, -330);
  }

  // ---------------------------------------------------------------- S02 CEO

  private renderCreateCeo(): void {
    const panel = this.fullPanel();
    createLabel({ text: '《我是CEO》', fontSize: 26, bold: true, color: THEME.primary, parent: panel }).setPosition(
      0,
      340,
    );
    createLabel({ text: '2/3 设定 CEO', fontSize: 13, color: THEME.textWeak, parent: panel }).setPosition(0, 308);

    createLabel({ text: 'CEO 姓名', fontSize: 14, bold: true, parent: panel }).setPosition(0, 262);
    this.customCeoName = this.customCeoName || `CEO${Math.floor(Math.random() * 900 + 100)}`;
    createLabel({ text: this.customCeoName, fontSize: 16, color: THEME.primary, parent: panel }).setPosition(
      0,
      232,
    );
    createButton({
      text: '随机姓名',
      width: 110,
      height: 36,
      color: Color.WHITE,
      textColor: THEME.primary,
      fontSize: 13,
      parent: panel,
      onClick: () => {
        this.customCeoName = `CEO${Math.floor(Math.random() * 900 + 100)}`;
        this.render();
      },
    }).setPosition(0, 198);

    createLabel({ text: '选择性格（决定年度成长方向）', fontSize: 14, bold: true, parent: panel }).setPosition(
      0,
      150,
    );
    (Object.keys(TRAIT_LABELS) as CeoTrait[]).forEach((trait, i) => {
      const meta = TRAIT_LABELS[trait];
      const selected = this.selectedTrait === trait;
      const card = createRect({
        width: 330,
        height: 78,
        color: selected ? new Color().fromHEX('#EAF1FB') : Color.WHITE,
        radius: 8,
        parent: panel,
      });
      card.setPosition(0, 100 - i * 92);
      card.on(Node.EventType.TOUCH_END, () => {
        this.selectedTrait = trait;
        this.render();
      });
      createLabel({
        text: meta.name,
        fontSize: 15,
        bold: true,
        color: selected ? THEME.primary : THEME.text,
        align: 'left',
        width: 80,
        parent: card,
      }).setPosition(-115, 18);
      createLabel({
        text: meta.desc,
        fontSize: 11,
        color: THEME.textWeak,
        align: 'left',
        width: 220,
        parent: card,
      }).setPosition(20, -10);
    });

    createLabel({ text: '初始能力：商业 50 ｜ 管理 50 ｜ 财务 50', fontSize: 12, color: THEME.textWeak, parent: panel }).setPosition(
      0,
      -180,
    );

    createButton({
      text: '上一步',
      width: 150,
      height: 48,
      color: Color.WHITE,
      textColor: THEME.text,
      parent: panel,
      onClick: () => this.render(),
    }).setPosition(-85, -300);
    createButton({
      text: '下一步：招聘员工',
      width: 150,
      height: 48,
      parent: panel,
      onClick: () => void this.submitCreateCompany(),
    }).setPosition(85, -300);
  }

  private async submitCreateCompany(): Promise<void> {
    const s = this.state();
    const name = this.randomCompanyNames[this.selectedNameIndex] ?? '';
    const result = await this.facade.createCompany(
      {
        companyName: name,
        industry: this.selectedIndustry,
        ceoName: this.customCeoName,
        ceoTrait: this.selectedTrait,
      },
      { commandId: nextCommandId('create'), expectedRunId: s.runId },
    );
    if (!result.ok) {
      this.toast(result.displayMessage);
      return;
    }
    this.render();
  }

  // ---------------------------------------------------------------- S03 首聘

  private renderInitialHiring(): void {
    const panel = this.fullPanel();
    const s = this.state();
    createLabel({ text: '3/3 初始招聘', fontSize: 22, bold: true, color: THEME.primary, parent: panel }).setPosition(
      0,
      350,
    );
    createLabel({
      text: `已录用 ${s.onboarding.initialHiresCompleted}/2（开始经营前需招聘 2 人）`,
      fontSize: 13,
      color: THEME.textWeak,
      parent: panel,
    }).setPosition(0, 318);
    createLabel({ text: `现金 ${moneyText(s.company?.cashYuan ?? 0)}`, fontSize: 14, bold: true, parent: panel }).setPosition(
      0,
      288,
    );

    const deptId = s.departments[0]?.deptId;
    if (!deptId) {
      this.toast('部门数据异常');
      return;
    }
    this.pendingOffer = this.facade.getOffer(deptId);

    createLabel({
      text: '招聘费 = 1 个月月薪（确认时立即支付）',
      fontSize: 11,
      color: THEME.textWeak,
      width: 330,
      parent: panel,
    }).setPosition(0, 262);
    this.pendingOffer.candidates.forEach((c, idx) => {
      const card = createRect({ width: 335, height: 112, color: Color.WHITE, radius: 8, parent: panel });
      card.setPosition(0, 196 - idx * 118);
      const archetypeName = c.archetype === 'A' ? '即战力' : c.archetype === 'B' ? '潜力股' : '经济型';
      createLabel({
        text: `${c.name}（${archetypeName}）`,
        fontSize: 15,
        bold: true,
        align: 'left',
        width: 200,
        parent: card,
      }).setPosition(-60, 36);
      createLabel({
        text: `能力 ${c.skill}  潜力 ${c.potential}  协作 ${c.teamwork}`,
        fontSize: 12,
        align: 'left',
        color: THEME.textWeak,
        width: 300,
        parent: card,
      }).setPosition(-10, 10);
      createLabel({
        text: `月薪 ${moneyText(c.salaryMonthlyYuan)} ｜ 招聘费 ${moneyText(c.salaryMonthlyYuan)}`,
        fontSize: 12,
        align: 'left',
        color: THEME.primary,
        width: 230,
        parent: card,
      }).setPosition(-42, -16);
      createButton({
        text: '录用',
        width: 72,
        height: 38,
        fontSize: 13,
        parent: card,
        onClick: () => void this.hireInitial(c.candidateId),
      }).setPosition(124, -32);
    });

    const done = s.onboarding.initialHiresCompleted >= 2;
    createButton({
      text: done ? '进入公司' : '完成首聘后进入',
      width: 320,
      height: 50,
      parent: panel,
      disabled: !done,
      onClick: () => void this.startClock(),
    }).setPosition(0, -360);
  }

  private async hireInitial(candidateId: string): Promise<void> {
    const s = this.state();
    const deptId = s.departments[0]?.deptId;
    const offerId = this.pendingOffer?.offerId;
    if (!deptId || !offerId) return;
    const result = await this.facade.hireEmployee(
      { offerId, candidateId, departmentId: deptId },
      { commandId: nextCommandId('hire'), expectedRunId: s.runId },
    );
    if (!result.ok) {
      this.toast(result.displayMessage);
      return;
    }
    this.toast(`已录用，支付招聘费 ${moneyText(result.payload.feePaidYuan)}`);
    this.render();
  }

  private async startClock(): Promise<void> {
    const s = this.state();
    const result = await this.facade.startOperating({
      commandId: nextCommandId('start'),
      expectedRunId: s.runId,
    });
    if (!result.ok) {
      this.toast(result.displayMessage);
      return;
    }
    this.render();
  }

  // ---------------------------------------------------------------- 四 Tab 主壳

  private renderMainShell(): void {
    const panel = this.fullPanel();

    const body = new Node('Body');
    body.parent = panel;
    body.addComponent(UITransform).setContentSize(new Size(375, 700));
    // BUG-004：原 +30 位移会把顶部栏推出 812 设计高上边界（公司名被裁切），
    // 与底部导航也无冲突，故按设计坐标原点对齐。
    body.setPosition(0, 0);

    if (this.activeTab === 'COMPANY') this.renderCompanyTab(body);
    else if (this.activeTab === 'DEPARTMENT') this.renderDepartmentTab(body);
    else if (this.activeTab === 'TALENT') this.renderTalentTab(body);
    else this.renderRankTab(body);

    this.renderBottomTabs(panel);
  }

  private renderCompanyTab(parent: Node): void {
    const s = this.state();
    const company = s.company;
    if (!company) return;

    // 顶部栏
    createRect({ width: 375, height: 88, color: THEME.primary, radius: 0, parent: parent }).setPosition(0, 356);
    createLabel({
      text: company.name,
      fontSize: 17,
      bold: true,
      color: Color.WHITE,
      width: 240,
      parent: parent,
    }).setPosition(-38, 372);
    createLabel({
      text: `${INDUSTRY_LABELS[company.industry]} · 创业第 ${s.gameYear} 年 · 第 ${s.gameMonth} 月`,
      fontSize: 11,
      color: new Color(220, 230, 245),
      parent: parent,
    }).setPosition(-38, 348);
    createButton({
      text: '设置',
      width: 56,
      height: 34,
      fontSize: 12,
      color: new Color(255, 255, 255, 40),
      parent: parent,
      onClick: () => this.renderSettings(),
    }).setPosition(145, 360);

    // 三大指标：现金 / 本年累计收入 / 本年累计利润
    const ledgers = this.facade.getYearLedgers(s.gameYear);
    const yRevenue = ledgers.reduce((sum, l) => sum + l.revenueYuan, 0);
    const yProfit = ledgers.reduce((sum, l) => sum + l.profitYuan, 0);
    const profitColor = yProfit < 0 ? THEME.danger : THEME.profit;
    const metrics: Array<[string, string, Color]> = [
      ['现金', moneyText(company.cashYuan), THEME.text],
      ['本年收入', moneyText(yRevenue), THEME.text],
      ['本年利润', `${yProfit < 0 ? '-' : ''}${moneyText(Math.abs(yProfit))}`, profitColor],
    ];
    metrics.forEach(([title, value, color], i) => {
      const card = createRect({ width: 112, height: 78, color: Color.WHITE, radius: 8, parent: parent });
      card.setPosition(-120 + i * 120, 276);
      createLabel({ text: title, fontSize: 12, color: THEME.textWeak, parent: card }).setPosition(0, 20);
      createLabel({ text: value, fontSize: 14, bold: true, color, width: 104, parent: card }).setPosition(0, -8);
    });

    // 时间控制
    this.renderTimeControl(parent, 210);

    // CEO 卡
    const ceoCard = createRect({ width: 343, height: 56, color: Color.WHITE, radius: 8, parent: parent });
    ceoCard.setPosition(0, 146);
    createLabel({
      text: `${s.ceo?.name ?? ''}（${TRAIT_LABELS[s.ceo?.trait ?? 'STEADY'].name}）`,
      fontSize: 13,
      bold: true,
      align: 'left',
      width: 160,
      parent: ceoCard,
    }).setPosition(-84, 8);
    createLabel({
      text: `商业 ${s.ceo?.businessSkill} · 管理 ${s.ceo?.managementSkill} · 财务 ${s.ceo?.financeSkill}`,
      fontSize: 12,
      color: THEME.textWeak,
      align: 'left',
      width: 220,
      parent: ceoCard,
    }).setPosition(-56, -12);
    createLabel({
      text: `员工 ${s.employees.length} 人`,
      fontSize: 12,
      color: THEME.primary,
      width: 90,
      parent: ceoCard,
    }).setPosition(118, 0);

    // 业务资产与操作
    const actionCard = createRect({ width: 343, height: 120, color: Color.WHITE, radius: 8, parent: parent });
    actionCard.setPosition(0, 50);
    createLabel({
      text: `业务资产：${moneyText(company.businessAssetBookYuan)}（产能加成）`,
      fontSize: 13,
      bold: true,
      align: 'left',
      width: 320,
      parent: actionCard,
    }).setPosition(0, 38);
    createButton({
      text: '扩大产能（1万起）',
      width: 158,
      height: 42,
      fontSize: 13,
      color: THEME.secondary,
      parent: actionCard,
      onClick: () => this.renderInvestDialog(),
    }).setPosition(-83, -14);
    createButton({
      text: '年度报告',
      width: 158,
      height: 42,
      fontSize: 13,
      color: Color.WHITE,
      textColor: THEME.primary,
      parent: actionCard,
      onClick: () => this.renderAnnualReport(),
    }).setPosition(83, -14);

    // 连续盈利目标进度
    createLabel({
      text: s.target3YearsAchieved
        ? '已达成连续 3 年盈利目标，可继续自由经营'
        : `连续盈利：${s.consecutiveProfitableYears}/3 年`,
      fontSize: 12,
      color: s.target3YearsAchieved ? THEME.profit : THEME.textWeak,
      width: 320,
      parent: parent,
    }).setPosition(0, -36);

    // 新手引导 TUT-04/05：看板预览态（暂停）讲解三指标，确认后开始经营
    if (s.phase === 'TUTORIAL_DASHBOARD') {
      this.renderStartOperatingBubble();
    }
  }

  /** TUT-04 三指标 + TUT-05 开始经营合并引导：确认即启动时钟。 */
  private renderStartOperatingBubble(): void {
    const overlay = this.modalOverlay(true);
    createRect({
      width: 308,
      height: 236,
      color: new Color(39, 50, 68, 245),
      radius: 12,
      parent: overlay,
    }).setPosition(0, 0);
    createLabel({ text: '新手提示', fontSize: 15, bold: true, color: Color.WHITE, parent: overlay }).setPosition(
      0,
      86,
    );
    createLabel({
      text: '营收是卖出去多少；利润才是扣掉成本后赚的钱。\n\n公司会自动经营，你可以暂停或加速时间。',
      fontSize: 14,
      color: Color.WHITE,
      width: 264,
      lineHeight: 22,
      parent: overlay,
    }).setPosition(0, 16);
    createButton({
      text: '开始经营',
      width: 168,
      height: 46,
      color: THEME.secondary,
      parent: overlay,
      onClick: () => {
        overlay.destroy();
        void this.startClock();
      },
    }).setPosition(0, -78);
  }

  private renderTimeControl(parent: Node, centerY: number): void {
    const s = this.state();
    const wrap = createRect({ width: 343, height: 52, color: Color.WHITE, radius: 8, parent });
    wrap.setPosition(0, centerY);
    createLabel({ text: '时间', fontSize: 12, color: THEME.textWeak, parent: wrap }).setPosition(-140, 0);
    const speeds: Array<[string, GameSpeed]> = [
      ['暂停', 0],
      ['1×', 1],
      ['2×', 2],
      ['5×', 5],
    ];
    speeds.forEach(([label, speed], i) => {
      const active = s.speed === speed;
      createButton({
        text: label,
        width: 52,
        height: 36,
        fontSize: 13,
        color: active ? THEME.primary : new Color(238, 241, 247),
        textColor: active ? Color.WHITE : THEME.textWeak,
        parent: wrap,
        onClick: () => void this.onSetSpeed(speed),
      }).setPosition(-66 + i * 60, 0);
    });
  }

  private async onSetSpeed(speed: GameSpeed): Promise<void> {
    const s = this.state();
    const r = await this.facade.setSpeed(speed, { commandId: nextCommandId('speed'), expectedRunId: s.runId });
    if (!r.ok) {
      this.toast(r.displayMessage);
      return;
    }
    audioManager.speedChange();
    this.render();
  }

  private deptHeadcount(s: GameState, deptId: string): number {
    return s.employees.filter((e) => e.status === 'ACTIVE' && e.departmentId === deptId).length;
  }

  // ---------------------------------------------------------------- 部门页

  private renderDepartmentTab(parent: Node): void {
    const s = this.state();
    createLabel({ text: '部门', fontSize: 22, bold: true, color: THEME.text, parent: parent }).setPosition(0, 344);

    // 经营方针
    createRect({ width: 343, height: 92, color: Color.WHITE, radius: 8, parent: parent }).setPosition(0, 282);
    createLabel({ text: `自动经营方针：${POLICY_META[s.policy].name}（${POLICY_META[s.policy].desc}）`, fontSize: 12, color: THEME.textWeak, width: 320, parent: parent }).setPosition(0, 312);
    (['GROWTH', 'STEADY', 'PROFIT'] as Policy[]).forEach((p, i) => {
      createButton({
        text: POLICY_META[p].name,
        width: 88,
        height: 38,
        fontSize: 13,
        color: s.policy === p ? THEME.primary : THEME.divider,
        textColor: s.policy === p ? Color.WHITE : THEME.text,
        parent: parent,
        onClick: () => void this.onSetPolicy(p),
      }).setPosition(-100 + i * 100, 268);
    });

    // 部门卡片列表（主营 + 已建支持部门 + 未建入口）
    const biz = s.departments.find((d) => d.type === 'BUSINESS')!;
    const createdTypes = new Set(s.departments.map((d) => d.type));
    const notCreated = SUPPORT_DEPARTMENTS.filter((t) => !createdTypes.has(t));

    let y = 214;
    for (const dept of [biz, ...s.departments.filter((d) => d.type !== 'BUSINESS')]) {
      this.renderDeptCard(parent, s, dept, y);
      y -= 104;
    }
    for (const type of notCreated) {
      this.renderUncreatedDept(parent, type, y);
      y -= 66;
    }
  }

  private renderDeptCard(parent: Node, s: GameState, dept: Department, y: number): void {
    const name = dept.type === 'BUSINESS' ? '主营业务部' : SUPPORT_DEPT_META[dept.type as SupportDeptType].name;
    const desc = dept.type === 'BUSINESS' ? '交付主营产能' : SUPPORT_DEPT_META[dept.type as SupportDeptType].desc;
    const count = this.deptHeadcount(s, dept.deptId);
    const wages = s.employees
      .filter((e) => e.status === 'ACTIVE' && e.departmentId === dept.deptId)
      .reduce((sum, e) => sum + e.salaryMonthlyYuan, 0);

    createRect({ width: 343, height: 92, color: Color.WHITE, radius: 8, parent: parent }).setPosition(0, y);
    createLabel({ text: name, fontSize: 15, bold: true, width: 170, align: 'left', parent: parent }).setPosition(-77, y + 28);
    createLabel({ text: desc, fontSize: 11, color: THEME.textWeak, width: 210, align: 'left', parent: parent }).setPosition(-57, y + 10);
    createLabel({
      text: count === 0 && dept.type !== 'BUSINESS' ? '尚未配置人员：无部门效益' : `在岗 ${count} 人｜月薪合计 ${moneyText(wages)}`,
      fontSize: 11,
      color: count === 0 ? THEME.warning : THEME.secondary,
      width: 210,
      align: 'left',
      parent: parent,
    }).setPosition(-57, y - 12);

    // 编制模式切换
    createButton({
      text: dept.staffingMode === 'AUTO' ? '自动' : '手动',
      width: 54,
      height: 34,
      fontSize: 12,
      color: dept.staffingMode === 'AUTO' ? THEME.secondary : THEME.divider,
      textColor: dept.staffingMode === 'AUTO' ? Color.WHITE : THEME.text,
      parent: parent,
      onClick: () => void this.onToggleStaffing(dept),
    }).setPosition(106, y + 18);
    // 招聘
    createButton({
      text: '招聘',
      width: 54,
      height: 34,
      fontSize: 12,
      parent: parent,
      onClick: () => this.openHireForDept(dept.deptId),
    }).setPosition(160, y + 18);
  }

  private renderUncreatedDept(parent: Node, type: SupportDeptType, y: number): void {
    const meta = SUPPORT_DEPT_META[type];
    createRect({ width: 343, height: 56, color: Color.WHITE, radius: 8, parent: parent }).setPosition(0, y);
    createLabel({ text: meta.name, fontSize: 14, bold: true, width: 150, align: 'left', parent: parent }).setPosition(-87, y + 12);
    createLabel({ text: `${meta.desc}｜设立费 ${moneyText(10000)}`, fontSize: 10, color: THEME.textWeak, width: 200, align: 'left', parent: parent }).setPosition(-62, y - 10);
    createButton({
      text: '创建',
      width: 54,
      height: 34,
      fontSize: 12,
      parent: parent,
      onClick: () => this.confirmCreateDept(type),
    }).setPosition(150, y);
  }

  private async onSetPolicy(policy: Policy): Promise<void> {
    const s = this.state();
    const r = await this.facade.setPolicy(policy, { commandId: nextCommandId('policy'), expectedRunId: s.runId });
    if (!r.ok) this.toast(r.displayMessage);
    else this.render();
  }

  private async onToggleStaffing(dept: Department): Promise<void> {
    const s = this.state();
    const next = dept.staffingMode === 'AUTO' ? 'LOCKED' : 'AUTO';
    const r = await this.facade.setStaffingMode(dept.deptId, next, {
      commandId: nextCommandId('mode'),
      expectedRunId: s.runId,
    });
    if (!r.ok) this.toast(r.displayMessage);
    else this.render();
  }

  private confirmCreateDept(type: SupportDeptType): void {
    const s = this.state();
    const pv = this.facade.previewCreateDepartment(type);
    const overlay = this.modalOverlay();
    createRect({ width: 310, height: 250, color: Color.WHITE, radius: 12, parent: overlay }).setPosition(0, 0);
    createLabel({ text: `创建${SUPPORT_DEPT_META[type].name}`, fontSize: 18, bold: true, parent: overlay }).setPosition(0, 86);
    createLabel({
      text: `${SUPPORT_DEPT_META[type].desc}\n设立费 ${moneyText(pv.feeYuan)}（确认即扣现金）。\n创建后默认手动编制，不自动招人；0 员工无效益。`,
      fontSize: 13,
      color: THEME.text,
      width: 256,
      align: 'left',
      lineHeight: 22,
      parent: overlay,
    }).setPosition(0, 24);
    createButton({
      text: `支付 ${moneyText(pv.feeYuan)} 创建`,
      width: 200,
      height: 46,
      parent: overlay,
      onClick: () => void this.doCreateDept(type, overlay),
    }).setPosition(0, -72);
    createButton({
      text: '取消',
      width: 120,
      height: 40,
      fontSize: 13,
      color: Color.WHITE,
      textColor: THEME.text,
      parent: overlay,
      onClick: () => overlay.destroy(),
    }).setPosition(0, -112);
  }

  private async doCreateDept(type: SupportDeptType, overlay: Node): Promise<void> {
    const s = this.state();
    const r = await this.facade.createDepartment(type, {
      commandId: nextCommandId('dept'),
      expectedRunId: s.runId,
    });
    overlay.destroy();
    if (!r.ok) {
      this.toast(r.displayMessage);
      return;
    }
    this.toast(`已创建${SUPPORT_DEPT_META[type].name}，支付 ${moneyText(r.payload.feePaidYuan)}`);
    audioManager.createDepartment();
    this.render();
  }

  // ---------------------------------------------------------------- 人才页

  private renderTalentTab(parent: Node): void {
    const s = this.state();
    createLabel({ text: '员工', fontSize: 22, bold: true, color: THEME.text, parent: parent }).setPosition(0, 344);
    const active = s.employees.filter((e) => e.status === 'ACTIVE');
    createLabel({
      text: `在职 ${active.length} 人（点击详情可裁员/调岗）`,
      fontSize: 12,
      color: THEME.textWeak,
      parent: parent,
    }).setPosition(0, 316);

    let y = 282;
    for (const emp of active) {
      this.renderEmployeeCard(parent, s, emp, y);
      y -= 84;
    }
  }

  private renderEmployeeCard(parent: Node, s: GameState, emp: Employee, y: number): void {
    const dept = s.departments.find((d) => d.deptId === emp.departmentId);
    const deptName = dept
      ? dept.type === 'BUSINESS'
        ? '主营'
        : SUPPORT_DEPT_META[dept.type as SupportDeptType].name.replace('部', '')
      : '—';
    createRect({ width: 343, height: 72, color: Color.WHITE, radius: 8, parent: parent }).setPosition(0, y);
    createLabel({ text: `${emp.name}（${deptName}）`, fontSize: 15, bold: true, width: 200, align: 'left', parent: parent }).setPosition(-62, y + 18);
    createLabel({
      text: `能力 ${emp.skill}｜潜力 ${emp.potential}｜协作 ${emp.teamwork}`,
      fontSize: 12,
      color: THEME.textWeak,
      width: 220,
      align: 'left',
      parent: parent,
    }).setPosition(-52, y - 2);
    createLabel({
      text: `月薪 ${moneyText(emp.salaryMonthlyYuan)}`,
      fontSize: 12,
      color: THEME.primary,
      width: 140,
      align: 'left',
      parent: parent,
    }).setPosition(-92, y - 22);
    createButton({
      text: '详情',
      width: 56,
      height: 36,
      fontSize: 12,
      parent: parent,
      onClick: () => this.openEmployeeDetail(emp.employeeId),
    }).setPosition(138, y);
  }

  private openEmployeeDetail(employeeId: string): void {
    const s = this.state();
    const emp = s.employees.find((e) => e.employeeId === employeeId);
    if (!emp) return;
    const dept = s.departments.find((d) => d.deptId === emp.departmentId);
    const deptName = dept
      ? dept.type === 'BUSINESS'
        ? '主营业务部'
        : SUPPORT_DEPT_META[dept.type as SupportDeptType].name
      : '—';

    const overlay = this.modalOverlay();
    createRect({ width: 320, height: 380, color: Color.WHITE, radius: 12, parent: overlay }).setPosition(0, 0);
    createLabel({ text: emp.name, fontSize: 18, bold: true, parent: overlay }).setPosition(0, 156);
    createLabel({
      text:
        `部门：${deptName}\n` +
        `专业能力：${emp.skill}（年末按潜力成长）\n` +
        `成长潜力：${emp.potential}\n团队协作：${emp.teamwork}\n` +
        `月薪：${moneyText(emp.salaryMonthlyYuan)}\n\n` +
        `调岗：下月生效，无招聘费/赔偿；\n裁员：主动触发，按任职年数补偿。`,
      fontSize: 13,
      color: THEME.text,
      width: 270,
      lineHeight: 22,
      align: 'left',
      parent: overlay,
    }).setPosition(0, 56);

    createButton({
      text: '调岗',
      width: 96,
      height: 44,
      fontSize: 14,
      color: THEME.secondary,
      parent: overlay,
      onClick: () => {
        overlay.destroy();
        this.openTransfer(employeeId);
      },
    }).setPosition(-62, -110);
    createButton({
      text: '裁员',
      width: 96,
      height: 44,
      fontSize: 14,
      color: THEME.danger,
      parent: overlay,
      onClick: () => {
        overlay.destroy();
        this.openLayoffConfirm(employeeId);
      },
    }).setPosition(62, -110);
    createButton({
      text: '关闭',
      width: 220,
      height: 40,
      fontSize: 13,
      color: Color.WHITE,
      textColor: THEME.text,
      parent: overlay,
      onClick: () => overlay.destroy(),
    }).setPosition(0, -158);
  }

  private openTransfer(employeeId: string): void {
    const s = this.state();
    const emp = s.employees.find((e) => e.employeeId === employeeId);
    if (!emp) return;
    const targets = s.departments.filter((d) => d.deptId !== emp.departmentId);

    const overlay = this.modalOverlay();
    createRect({ width: 310, height: 80 + targets.length * 54, color: Color.WHITE, radius: 12, parent: overlay }).setPosition(0, 0);
    createLabel({ text: `将 ${emp.name} 调往（下月生效）`, fontSize: 16, bold: true, parent: overlay }).setPosition(0, targets.length * 27 + 14);
    targets.forEach((d, i) => {
      const label = d.type === 'BUSINESS' ? '主营业务部' : SUPPORT_DEPT_META[d.type as SupportDeptType].name;
      createButton({
        text: label,
        width: 240,
        height: 42,
        fontSize: 14,
        parent: overlay,
        onClick: () => void this.doTransfer(employeeId, d.deptId, overlay),
      }).setPosition(0, targets.length * 27 - 26 - i * 54);
    });
    createButton({
      text: '取消',
      width: 120,
      height: 36,
      fontSize: 13,
      color: Color.WHITE,
      textColor: THEME.text,
      parent: overlay,
      onClick: () => overlay.destroy(),
    }).setPosition(0, -(targets.length * 27 + 30));
  }

  private async doTransfer(employeeId: string, toDeptId: string, overlay: Node): Promise<void> {
    const s = this.state();
    const r = await this.facade.transferEmployee(employeeId, toDeptId, {
      commandId: nextCommandId('transfer'),
      expectedRunId: s.runId,
    });
    overlay.destroy();
    if (!r.ok) this.toast(r.displayMessage);
    else {
      this.toast('已安排调岗，下月生效');
      this.render();
    }
  }

  private layoffToken: { employeeId: string; severanceYuan: number; expiresAtMs: number; previewedAtMs: number } | null = null;

  private openLayoffConfirm(employeeId: string): void {
    const pv = this.facade.previewLayoff(employeeId, Date.now());
    this.layoffToken = this.facade.createLayoffToken(pv, Date.now());
    const overlay = this.modalOverlay();
    createRect({ width: 312, height: 350, color: Color.WHITE, radius: 12, parent: overlay }).setPosition(0, 0);
    createLabel({ text: '确认裁员？', fontSize: 18, bold: true, color: THEME.danger, parent: overlay }).setPosition(0, 140);
    createLabel({
      text:
        `员工：${pv.name}\n任职：${pv.tenureYears} 年（${pv.tenureMonths} 个月）\n` +
        `月薪：${moneyText(pv.salaryMonthlyYuan)}\n补偿月数：${pv.severanceMonths} 个月\n\n` +
        `补偿金额：${moneyText(pv.severanceYuan)}（确认即支付）\n` +
        `次年约节约工资：${moneyText(pv.nextYearSalarySavingYuan)}\n` +
        `裁后现金：${moneyText(pv.cashAfterYuan)}`,
      fontSize: 13,
      color: THEME.text,
      width: 266,
      lineHeight: 22,
      align: 'left',
      parent: overlay,
    }).setPosition(0, 28);
    createButton({
      text: `确认支付补偿 ${moneyText(pv.severanceYuan)}`,
      width: 240,
      height: 48,
      color: THEME.danger,
      parent: overlay,
      onClick: () => void this.doLayoff(overlay),
    }).setPosition(0, -104);
    createButton({
      text: '再想想（取消）',
      width: 200,
      height: 40,
      fontSize: 13,
      color: Color.WHITE,
      textColor: THEME.text,
      parent: overlay,
      onClick: () => overlay.destroy(),
    }).setPosition(0, -146);
  }

  private async doLayoff(overlay: Node): Promise<void> {
    if (!this.layoffToken) {
      overlay.destroy();
      return;
    }
    const s = this.state();
    const token = this.layoffToken;
    const r = await this.facade.confirmLayoff(token, {
      commandId: nextCommandId('layoff'),
      expectedRunId: s.runId,
    });
    overlay.destroy();
    this.layoffToken = null;
    if (!r.ok) {
      this.toast(r.displayMessage);
      return;
    }
    this.toast(`已支付补偿 ${moneyText(r.payload.severancePaidYuan)}，次月离岗`);
    audioManager.layoff();
    this.render();
  }

  private openHireForDept(deptId: string): void {
    const offer = this.facade.getOffer(deptId);
    this.pendingOffer = offer;
    this.renderHireDialog(offer, deptId);
  }

  private renderHireDialog(offer: CandidateOffer, deptId: string): void {
    const s = this.state();
    const overlay = this.modalOverlay();
    createRect({ width: 340, height: 470, color: Color.WHITE, radius: 12, parent: overlay }).setPosition(0, 0);
    createLabel({ text: '招聘候选人', fontSize: 18, bold: true, parent: overlay }).setPosition(0, 206);
    createLabel({ text: '招聘费=1个月月薪（HR已生效可折扣），次月到岗', fontSize: 10, color: THEME.textWeak, width: 300, parent: overlay }).setPosition(0, 186);

    offer.candidates.forEach((c, idx) => {
      const cardY = 150 - idx * 108;
      createRect({ width: 308, height: 98, color: THEME.bg, radius: 8, parent: overlay }).setPosition(0, cardY);
      const arch = c.archetype === 'A' ? '即战力' : c.archetype === 'B' ? '潜力股' : '经济型';
      createLabel({ text: `${c.name}（${arch}）`, fontSize: 14, bold: true, width: 180, align: 'left', parent: overlay }).setPosition(-56, cardY + 32);
      createLabel({ text: `能力 ${c.skill} 潜力 ${c.potential} 协作 ${c.teamwork}`, fontSize: 11, color: THEME.textWeak, width: 200, align: 'left', parent: overlay }).setPosition(-46, cardY + 12);
      createLabel({ text: `月薪 ${moneyText(c.salaryMonthlyYuan)}｜招聘费 ${moneyText(c.salaryMonthlyYuan)}`, fontSize: 11, color: THEME.primary, width: 200, align: 'left', parent: overlay }).setPosition(-46, cardY - 8);
      createButton({
        text: '录用',
        width: 60,
        height: 38,
        fontSize: 13,
        parent: overlay,
        disabled: s.company!.cashYuan < c.salaryMonthlyYuan,
        onClick: () => void this.hireFromDialog(c.candidateId, deptId, overlay),
      }).setPosition(124, cardY);
    });

    createButton({
      text: '换一批',
      width: 96,
      height: 40,
      fontSize: 13,
      color: Color.WHITE,
      textColor: THEME.primary,
      parent: overlay,
      onClick: () => {
        overlay.destroy();
        void this.refreshHire(deptId);
      },
    }).setPosition(-60, -206);
    createButton({
      text: '关闭',
      width: 96,
      height: 40,
      fontSize: 13,
      color: Color.WHITE,
      textColor: THEME.text,
      parent: overlay,
      onClick: () => overlay.destroy(),
    }).setPosition(60, -206);
  }

  private async refreshHire(deptId: string): Promise<void> {
    const s = this.state();
    const r = await this.facade.refreshOffer(deptId, { commandId: nextCommandId('refresh'), expectedRunId: s.runId });
    if (!r.ok) {
      this.toast(r.displayMessage);
      return;
    }
    this.pendingOffer = r.payload;
    this.renderHireDialog(r.payload, deptId);
  }

  private async hireFromDialog(candidateId: string, deptId: string, overlay: Node): Promise<void> {
    const s = this.state();
    const offerId = this.pendingOffer?.offerId ?? this.facade.getOffer(deptId).offerId;
    const r = await this.facade.hireEmployee(
      { offerId, candidateId, departmentId: deptId },
      { commandId: nextCommandId('hire'), expectedRunId: s.runId },
    );
    overlay.destroy();
    if (!r.ok) {
      this.toast(r.displayMessage);
      return;
    }
    this.toast(`已录用，支付招聘费 ${moneyText(r.payload.feePaidYuan)}，次月到岗`);
    audioManager.recruit();
    this.render();
  }

  // ---------------------------------------------------------------- 排行榜

  private renderRankTab(parent: Node): void {
    createLabel({ text: '本地模拟排行', fontSize: 22, bold: true, color: THEME.text, parent: parent }).setPosition(0, 336);

    createButton({
      text: '资产榜',
      width: 100,
      height: 38,
      fontSize: 14,
      color: this.rankMode === 'assets' ? THEME.primary : THEME.divider,
      textColor: this.rankMode === 'assets' ? Color.WHITE : THEME.text,
      parent,
      onClick: () => { this.rankMode = 'assets'; this.render(); },
    }).setPosition(-58, 300);
    createButton({
      text: '年限榜',
      width: 100,
      height: 38,
      fontSize: 14,
      color: this.rankMode === 'years' ? THEME.primary : THEME.divider,
      textColor: this.rankMode === 'years' ? Color.WHITE : THEME.text,
      parent,
      onClick: () => { this.rankMode = 'years'; this.render(); },
    }).setPosition(58, 300);

    const rows = this.rankMode === 'assets'
      ? this.facade.assetsLeaderboard()
      : this.facade.yearsLeaderboard();

    // 展示前 8 名（含玩家高亮）
    rows.slice(0, 8).forEach((row, i) => {
      const y = 252 - i * 52;
      createRect({
        width: 343,
        height: 46,
        color: row.isPlayer ? new Color(224, 236, 255) : Color.WHITE,
        radius: 6,
        parent,
      }).setPosition(0, y);
      createLabel({ text: `${i + 1}`, fontSize: 14, bold: true, width: 30, color: i < 3 ? THEME.warning : THEME.textWeak, parent }).setPosition(-158, y);
      createLabel({
        text: row.isPlayer ? `${row.name}（你）` : row.name,
        fontSize: 13,
        bold: row.isPlayer,
        width: 170,
        align: 'left',
        color: row.isPlayer ? THEME.primary : THEME.text,
        parent,
      }).setPosition(-50, y);
      const metric = this.rankMode === 'assets'
        ? moneyText(row.assetsYuan)
        : `${row.yearsOperated} 年`;
      createLabel({ text: metric, fontSize: 13, width: 110, align: 'right', color: THEME.text, parent }).setPosition(105, y);
    });

    // 玩家名次
    const all = rows;
    const playerRank = all.findIndex((r) => r.isPlayer) + 1;
    createLabel({
      text: playerRank > 0 ? `你的排名：第 ${playerRank} / ${all.length} 名` : '',
      fontSize: 12,
      color: THEME.textWeak,
      parent,
    }).setPosition(0, -180);
  }

  private renderBottomTabs(parent: Node): void {
    const tabs: Array<[TabId, string]> = [
      ['COMPANY', '公司'],
      ['DEPARTMENT', '部门'],
      ['TALENT', '人才'],
      ['RANK', '排行'],
    ];
    createRect({ width: 375, height: 72, color: Color.WHITE, radius: 0, parent: parent }).setPosition(0, -372);
    tabs.forEach(([id, label], i) => {
      const active = this.activeTab === id;
      const x = -141 + i * 94;
      createButton({
        text: label,
        width: 80,
        height: 56,
        fontSize: 13,
        color: new Color(0, 0, 0, 0),
        textColor: active ? THEME.primary : THEME.textWeak,
        parent: parent,
        onClick: () => {
          this.activeTab = id;
          this.render();
        },
      }).setPosition(x, -372);
    });
  }

  // ---------------------------------------------------------------- 扩产与年报

  private renderInvestDialog(): void {
    const s = this.state();
    const overlay = this.modalOverlay();
    createRect({ width: 320, height: 400, color: Color.WHITE, radius: 12, parent: overlay }).setPosition(0, -10);
    createLabel({ text: '扩大主营业务产能', fontSize: 18, bold: true, parent: overlay }).setPosition(0, 150);
    createLabel({
      text: `可用现金 ${moneyText(s.company?.cashYuan ?? 0)}`,
      fontSize: 13,
      color: THEME.textWeak,
      parent: overlay,
    }).setPosition(0, 116);
    createLabel({
      text: '每投入 1 万元，交付产能 +1.5%（封顶 +30%）。\n现金即时换为业务资产，不计当月利润，次年起按 10% 折旧。',
      fontSize: 11,
      color: THEME.textWeak,
      width: 300,
      lineHeight: 16,
      parent: overlay,
    }).setPosition(0, 70);

    const steps = [10_000, 50_000, 100_000];
    steps.forEach((amount, i) => {
      const preview = this.facade.previewInvest(amount);
      const affordable = preview.ok && preview.payload.cashAfter >= 0;
      createButton({
        text: `投入 ${moneyText(amount)}${affordable ? '' : '（现金不足）'}`,
        width: 280,
        height: 42,
        fontSize: 13,
        color: affordable ? THEME.secondary : THEME.disabled,
        disabled: !affordable,
        parent: overlay,
        onClick: () => void this.onInvest(amount),
      }).setPosition(0, 10 - i * 52);
    });

    createButton({
      text: '取消',
      width: 280,
      height: 42,
      color: Color.WHITE,
      textColor: THEME.textWeak,
      fontSize: 14,
      parent: overlay,
      onClick: () => overlay.destroy(),
    }).setPosition(0, -190);
  }

  private async onInvest(amount: number): Promise<void> {
    const s = this.state();
    const r = await this.facade.invest(amount, {
      commandId: nextCommandId('invest'),
      expectedRunId: s.runId,
    });
    if (!r.ok) {
      this.toast(r.displayMessage);
      return;
    }
    this.toast(`已投入 ${moneyText(amount)}，产能加成已更新`);
    this.render();
  }

  private renderAnnualReport(): void {
    const s = this.state();
    const years = s.annualReports.map((r) => r.year).sort((a, b) => b - a);
    const report: AnnualReport | null =
      years.length > 0 ? this.facade.getAnnualReport(years[0]) : null;
    const overlay = this.modalOverlay();
    createRect({ width: 324, height: 572, color: Color.WHITE, radius: 12, parent: overlay }).setPosition(0, 54);
    createLabel({
      text: report ? `第 ${report.year} 年财务报告` : '年度财务报告',
      fontSize: 18,
      bold: true,
      parent: overlay,
    }).setPosition(0, 330);

    if (!report) {
      createLabel({
        text: '首个经营年度尚未结束。\n完成 12 个月结算后可在此查看年报。',
        fontSize: 13,
        color: THEME.textWeak,
        width: 280,
        lineHeight: 20,
        parent: overlay,
      }).setPosition(0, 80);
      createButton({
        text: '知道了',
        width: 240,
        height: 46,
        parent: overlay,
        onClick: () => overlay.destroy(),
      }).setPosition(0, -120);
      return;
    }

    const rows: Array<[string, number, boolean]> = [
      ['营业收入', report.revenueYuan, false],
      ['直接成本', report.directCostYuan, true],
      ['其他运营费', report.otherOperatingCostYuan, true],
      ['售后费用', report.afterSalesCostYuan, true],
      ['固定管理费', report.fixedCostYuan, true],
      ['员工工资', report.payrollYuan, true],
      ['招聘费', report.recruitmentCostYuan, true],
      ['裁员赔偿', report.severanceCostYuan, true],
      ['部门设置费', report.deptSetupCostYuan, true],
      ['事件损益', report.eventCostYuan, true],
      ['折旧', report.depreciationYuan, true],
    ];
    rows.forEach(([label, value, cost], i) => {
      createLabel({ text: label, fontSize: 12, align: 'left', color: THEME.textWeak, width: 150, parent: overlay })
        .setPosition(-78, 282 - i * 30);
      createLabel({
        text: value === 0 ? '¥0' : moneyText(value),
        fontSize: 12,
        align: 'right',
        color: cost && value !== 0 ? THEME.danger : THEME.text,
        width: 150,
        parent: overlay,
      }).setPosition(84, 282 - i * 30);
    });

    const profitColor = report.profitYuan < 0 ? THEME.danger : THEME.profit;
    createRect({ width: 300, height: 76, color: new Color(238, 244, 252), radius: 8, parent: overlay }).setPosition(0, -78);
    createLabel({ text: '本年净利润', fontSize: 12, color: THEME.textWeak, parent: overlay }).setPosition(0, -60);
    createLabel({
      text: `${report.profitYuan < 0 ? '-' : ''}${moneyText(Math.abs(report.profitYuan))}`,
      fontSize: 22,
      bold: true,
      color: profitColor,
      parent: overlay,
    }).setPosition(0, -90);

    createLabel({
      text: `期初现金 ${moneyText(report.cashOpenYuan)}　期末 ${moneyText(report.cashCloseYuan)}\n总资产 ${moneyText(report.assetCloseYuan)}　期末员工 ${report.headcountClose} 人`,
      fontSize: 11,
      color: THEME.textWeak,
      width: 300,
      lineHeight: 18,
      parent: overlay,
    }).setPosition(0, -138);

    createButton({
      text: '关闭',
      width: 240,
      height: 46,
      parent: overlay,
      onClick: () => overlay.destroy(),
    }).setPosition(0, -200);
  }

  // ---------------------------------------------------------------- D04/D05 设置与关闭公司

  private renderSettings(): void {
    const overlay = this.modalOverlay();
    const audio = audioManager.getSettings();
    createRect({ width: 320, height: 468, color: Color.WHITE, radius: 12, parent: overlay }).setPosition(0, 0);
    createLabel({ text: '设置', fontSize: 18, bold: true, parent: overlay }).setPosition(0, 198);

    const toggle = (
      y: number,
      label: string,
      on: boolean,
      onToggle: () => void,
    ): void => {
      createLabel({ text: label, fontSize: 14, width: 180, align: 'left', parent: overlay }).setPosition(-60, y);
      createButton({
        text: on ? '开' : '关',
        width: 64,
        height: 36,
        fontSize: 14,
        color: on ? THEME.secondary : THEME.divider,
        textColor: on ? Color.WHITE : THEME.text,
        parent: overlay,
        onClick: onToggle,
      }).setPosition(116, y);
    };

    createLabel({ text: '声音', fontSize: 13, bold: true, color: THEME.textWeak, width: 260, align: 'left', parent: overlay }).setPosition(-20, 140);
    toggle(100, '总开关（关闭后全静音）', audio.masterEnabled, () => {
      const a = audioManager.getSettings();
      audioManager.updateSettings({ masterEnabled: !a.masterEnabled });
      audioManager.uiTap();
      this.rebuildSettings(overlay);
    });
    toggle(56, '背景音乐', audio.musicEnabled, () => {
      const a = audioManager.getSettings();
      audioManager.updateSettings({ musicEnabled: !a.musicEnabled });
      audioManager.uiTap();
      this.rebuildSettings(overlay);
    });
    toggle(12, '操作音效/提示', audio.sfxEnabled, () => {
      const a = audioManager.getSettings();
      audioManager.updateSettings({ sfxEnabled: !a.sfxEnabled });
      if (!a.sfxEnabled) audioManager.uiTap();
      this.rebuildSettings(overlay);
    });

    createButton({
      text: '重新查看操作指引',
      width: 240,
      height: 42,
      fontSize: 13,
      color: Color.WHITE,
      textColor: THEME.primary,
      parent: overlay,
      onClick: () => {
        overlay.destroy();
        this.replayTutorial();
      },
    }).setPosition(0, -40);

    createButton({
      text: '隐私政策',
      width: 240,
      height: 40,
      fontSize: 13,
      color: Color.WHITE,
      textColor: THEME.primary,
      parent: overlay,
      onClick: () => {
        const url = getRuntimeConfig().privacyPolicyUrl;
        if (url) this.openPrivacyPolicy(url);
        else this.toast('隐私政策地址将在正式上架前配置');
      },
    }).setPosition(0, -88);

    createButton({
      text: '关闭公司并重新创业',
      width: 240,
      height: 42,
      fontSize: 13,
      color: Color.WHITE,
      textColor: THEME.danger,
      parent: overlay,
      onClick: () => {
        overlay.destroy();
        this.renderCloseConfirm();
      },
    }).setPosition(0, -136);

    createButton({
      text: '取消',
      width: 240,
      height: 40,
      color: THEME.textWeak,
      parent: overlay,
      onClick: () => overlay.destroy(),
    }).setPosition(0, -184);
  }

  /**
   * 设置弹窗内切换开关后重建弹窗自身（BUG-001）：
   * 直接 this.render() 会重建整个页面并销毁弹窗，导致用户看到弹窗"消失"。
   */
  private rebuildSettings(overlay: Node): void {
    this.scheduleOnce(() => {
      if (!overlay.isValid) return;
      overlay.destroy();
      this.renderSettings();
    }, 0);
  }

  /** 帮助重播（M3-05）：重新展示关键操作说明，不改变业务状态。 */
  private replayTutorial(): void {
    const overlay = this.modalOverlay();
    createRect({ width: 320, height: 360, color: Color.WHITE, radius: 12, parent: overlay }).setPosition(0, 0);
    createLabel({ text: '操作指引', fontSize: 18, bold: true, parent: overlay }).setPosition(0, 146);
    createLabel({
      text:
        '公司页：实时现金/收入/利润、时间倍速、扩产与年报。\n' +
        '部门页：创建采购/客服/市场/财务/HR，切自动或手动，招聘员工。\n' +
        '人才页：查看员工详情，可调岗或裁员（有补偿）。\n' +
        '离线：每 40 分钟结 1 个月，最多 36 个月。\n' +
        '现金不足会暂停经营，可领一次 10 万救助。\n' +
        '目标：连续 3 年盈利。',
      fontSize: 13,
      color: THEME.text,
      width: 272,
      lineHeight: 24,
      parent: overlay,
    }).setPosition(0, 20);
    createButton({
      text: '知道了',
      width: 200,
      height: 46,
      parent: overlay,
      onClick: () => overlay.destroy(),
    }).setPosition(0, -132);
  }

  private renderCloseConfirm(): void {
    const s = this.state();
    const overlay = this.modalOverlay();
    createRect({ width: 320, height: 360, color: Color.WHITE, radius: 12, parent: overlay }).setPosition(0, 0);
    createLabel({ text: '关闭公司并重来？', fontSize: 18, bold: true, color: THEME.danger, parent: overlay }).setPosition(
      0,
      140,
    );
    createLabel({
      text:
        `将永久清除本局：\n公司：${s.company?.name ?? ''}\n员工：${s.employees.length} 人\n现金：${moneyText(s.company?.cashYuan ?? 0)}\n已完成年度：${s.annualReports.length}\n\n` +
        '此操作不可撤销，但不会注销你的平台账号。',
      fontSize: 13,
      color: THEME.text,
      width: 270,
      lineHeight: 20,
      align: 'left',
      parent: overlay,
    }).setPosition(0, 30);

    const preview = this.facade.beginCloseCompany(Date.now());
    createButton({
      text: '永久清除本局',
      width: 250,
      height: 48,
      color: THEME.danger,
      parent: overlay,
      onClick: () => void this.doClose(preview.confirmationToken, preview.expiresAtMs, preview.oldRunId),
    }).setPosition(0, -110);
    createButton({
      text: '再想想（取消）',
      width: 250,
      height: 44,
      color: THEME.textWeak,
      parent: overlay,
      onClick: () => overlay.destroy(),
    }).setPosition(0, -162);
  }

  private async doClose(token: string, expiresAtMs: number, oldRunId: string): Promise<void> {
    const result = await this.facade.confirmCloseCompany(
      { confirmationToken: token, expiresAtMs, oldRunId },
      Date.now(),
    );
    if (!result.ok) {
      this.toast(result.displayMessage);
      return;
    }
    // 重置向导临时选择
    this.customCompanyName = '';
    this.customCeoName = '';
    this.randomCompanyNames = [];
    this.activeTab = 'COMPANY';
    this.toast('公司已关闭，开始新的创业');
    this.render();
  }

  // ---------------------------------------------------------------- 引导与通用控件

  private fullPanel(): Node {
    const panel = createRect({
      name: 'FullPanel',
      width: DESIGN_WIDTH,
      height: DESIGN_HEIGHT,
      color: THEME.bg,
      radius: 0,
      parent: this.root,
    });
    panel.setPosition(0, 0);
    stretchToParent(panel);
    return panel;
  }

  private modalOverlay(transparent = false): Node {
    const overlay = new Node('ModalOverlay');
    overlay.parent = this.root;
    overlay.addComponent(UITransform).setContentSize(new Size(DESIGN_WIDTH, DESIGN_HEIGHT));
    if (!transparent) {
      const g = overlay.addComponent(Graphics);
      g.fillColor = new Color(0, 0, 0, 130);
      g.rect(-DESIGN_WIDTH / 2, -DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT);
      g.fill();
    }
    overlay.on(Node.EventType.TOUCH_END, (e) => e.propagationStopped = true);
    return overlay;
  }

  private toast(message: string): void {
    if (this.toastNode) this.toastNode.destroy();
    const node = createRect({ width: 300, height: 44, color: new Color(39, 50, 68, 235), radius: 8, parent: this.root });
    node.setPosition(0, -300);
    createLabel({ text: message, fontSize: 13, color: Color.WHITE, width: 284, parent: node }).setPosition(0, 0);
    this.toastNode = node;
    this.scheduleOnce(() => {
      if (node.isValid) node.destroy();
    }, 2.2);
  }
}
