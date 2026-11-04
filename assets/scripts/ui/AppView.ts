import {
  BlockInputEvents,
  Button,
  Color,
  Component,
  EditBox,
  Graphics,
  Label,
  Mask,
  Node,
  profiler,
  ScrollView,
  Size,
  UIOpacity,
  UITransform,
  Vec2,
  view,
} from 'cc';
import { GameFacade } from '../../core/application/GameFacade';
import type { CandidateOffer, GameState, GameSpeed, IndustryId, CeoTrait, AnnualReport, SupportDeptType, Policy, Department, DeptType } from '../../core/domain/types';
import type { DepartmentVM, UncreatedDeptVM } from '../../core/application/DepartmentOverviewService';
import type { TalentRowVM } from '../../core/application/TalentOverviewService';
import { createPlatform } from '../platform/PlatformFactory';
import { computeShellLayout, computePaneLayout, computeScrollBody, type ShellLayout } from './shellLayout';
import {
  CEO_NAME_MAX,
  CREATE_COPY,
  CreateSubmitGuard,
  INDUSTRY_PRESENTATION,
  candidateRows,
  ceoNameError,
  generateCeoName,
  initialHireView,
} from './createFlow';
import { loadEconomyConfig } from '../platform/loadConfig';
import { loadRuntimeConfig } from '../platform/loadRuntimeConfig';
import { getRuntimeConfig } from '../platform/runtimeConfig';
import { AuthService } from '../../core/platform/AuthService';
import { acceptPrivacy, hasAcceptedPrivacy } from '../../core/platform/privacyConsent';
import { PRIVACY_POLICY_TEXT } from '../../core/platform/privacyPolicyText';
import { GameError } from '../../core/domain/errors';
import { validateCompanyName } from '../../core/domain/validation';
import { openConfirmDialog, openInputDialog, openScrollableDialog, type DialogHandle } from './dialogs';
import { createForegroundClock } from '../../core/platform/foregroundClock';
import { bootTrapError, bootTrapReady, bootTrapWatchdog } from '../boot/BootTrap';
import { getBootController, initCocosBootDiagnostics } from '../boot/cocosBootHost';
import {
  createButton,
  createLabel,
  createRect,
  moneyText,
  stretchToParent,
  attachCoverBackground,
} from './UiFactory';
import { THEME, DESIGN_WIDTH, DESIGN_HEIGHT } from './theme';
import { TEXT_TOKENS } from './textTokens';
import { audioManager } from '../audio/AudioManager';
import { loadAdsConfig } from '../ads/loadAdsConfig';
import { TapRewardedAdProvider } from '../../core/platform/TapRewardedAdProvider';
import { isAdCouponAvailable } from '../../core/application/AdRewardService';
import { AdRewardCoordinator } from '../ads/AdRewardCoordinator';
import { loadCloudConfig, loadLeaderboardConfig } from '../platform/loadExternalServiceConfig';
import type { CloudRuntimeConfig } from '../../core/persistence/CloudSaveTypes';
import type { LeaderboardRuntimeConfig } from '../../core/platform/externalServiceConfig';
import { CloudSyncService } from '../../core/application/CloudSyncService';
import { TapCloudSaveProvider } from '../../core/platform/TapCloudSaveProvider';
import { TapLeaderboardProvider } from '../../core/platform/TapLeaderboardProvider';

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

/** R29：部门效益口径说明（与月结同一套领域公式，页面只解释不重算）。 */
const DEPT_EFFECT_TEXT: Record<SupportDeptType, string> = {
  PROCUREMENT: '对可适用直接采购成本的节省',
  CUSTOMER_SERVICE: '对售后费用的节省',
  MARKETING: '提升潜在订单（收入仍取 min(订单, 产能)）',
  FINANCE: '对固定管理费与其他可控运营费的节省',
  HR: '提升主营交付产能；招聘费折扣另计',
};

const VALUE_KIND_TEXT: Record<DepartmentVM['valueKind'], string> = {
  BUSINESS_DELIVERY: '主营毛利',
  COST_SAVING: '成本节省',
  DEMAND_UPLIFT: '需求增量',
  CAPACITY_UPLIFT: '产能增量',
  NO_EFFECT: '无效益',
};

/** 卡片内金额压缩（仅展示，不改领域值；详情弹窗仍用精确金额）。 */
function compactMoney(yuan: number): string {
  const sign = yuan < 0 ? '-' : '';
  const abs = Math.abs(yuan);
  if (abs >= 10_000) return `${sign}¥${(abs / 10_000).toFixed(1)}万`;
  return `${sign}¥${abs.toLocaleString('zh-CN')}`;
}

function percentText(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

const COMPANY_NAME_ERROR_TEXT: Record<
  'EMPTY' | 'TOO_SHORT' | 'TOO_LONG' | 'CONTROL_CHAR' | 'TAG' | 'FORBIDDEN_WORD',
  string
> = {
  EMPTY: '公司名不能为空',
  TOO_SHORT: '公司名至少 2 个字',
  TOO_LONG: '公司名最多 20 个字',
  CONTROL_CHAR: '公司名不能包含控制字符',
  TAG: '公司名不能包含网页标签',
  FORBIDDEN_WORD: '公司名包含不允许的词语，请换一个',
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
  /** 创建流程子步骤：公司页 / CEO 页（避免两者都靠 phase 分发导致互相覆盖）。 */
  private createStep: 'COMPANY' | 'CEO' = 'COMPANY';
  /** 首聘 2/2 后先停留在 S03 让玩家点「进入公司」，而不是被领域态直接切走。 */
  private awaitingEnterCompany = false;
  private customCompanyName = '';
  private customCeoName = '';
  private randomCompanyNames: string[] = [];
  /** 选中的候选名下标；-1 表示使用自定义名称。 */
  private selectedNameIndex = 0;
  /** 「换一批」批次序号：每次点击递增，保证换出不同名字。 */
  private nameNonce = 0;
  private activeTab: TabId = 'COMPANY';
  private rankMode: 'assets' | 'years' = 'assets';
  private leaderboardConfig: LeaderboardRuntimeConfig | null = null;
  private leaderboardConsent = false;
  private cloudConfig: CloudRuntimeConfig | null = null;
  private cloudStatusText = '云备份尚未检查';
  private cloudSync: CloudSyncService | null = null;
  private annualReportYear: number | null = null;
  private pendingOffer: CandidateOffer | null = null;
  /** R24：主壳布局引用——热 resize 时只重算几何，不重建内容（保 Tab/滚动/输入）。 */
  private shell: {
    scrollRoot: Node;
    viewNode: Node;
    content: Node;
    scrollView: ScrollView;
    footer: Node;
    footerBg: Graphics;
    footerButtons: Node[];
    /** Tab 内容在 authored 坐标（812 中心原点）下的最低下探。 */
    minBottom: number;
    /** 当前内容容器相对 authored 坐标的整体位移。 */
    shift: number;
  } | null = null;
  /** R24：布局监听注销句柄（平台 resize + 引擎 canvas-resize）。 */
  private unbindLayout: Array<() => void> = [];
  /** R27：创建三步页的滚动壳（与主壳互斥；热 resize 只重算几何）。 */
  private createPane: {
    header: Node | null;
    scrollRoot: Node;
    viewNode: Node;
    content: Node;
    scrollView: ScrollView;
    footer: Node;
    footerBg: Graphics;
    footerButtons: Node[];
    headerHeight: number;
    footerHeight: number;
    minBottom: number;
    shift: number;
  } | null = null;
  /** R27：创建公司提交守卫（同一意图一个 commandId，连点只发一次）。 */
  private createGuard = new CreateSubmitGuard();
  private createCommandId: string | null = null;
  private ceoNameNonce = 0;
  private ceoErrorLabel: Node | null = null;
  /** R28：时间按钮引用——暂停/倍速切换只就地重绘，不重建整页、不重置滚动。 */
  private speedButtons: Array<{ node: Node; speed: GameSpeed }> = [];
  /** R30：人才页筛选（'ALL' 或部门 deptId）。 */
  private talentFilterKey = 'ALL';
  /** R30：人才页虚拟化卡片池（只渲染可视窗口，复用节点不串员工）。 */
  private talentPool: {
    rows: TalentRowVM[];
    listTop: number;
    step: number;
    cards: Array<{ node: Node; name: Node; meta: Node; pay: Node; state: Node; index: number }>;
  } | null = null;

  override async start(): Promise<void> {
    // 启动故障捕获：真机卡启动页时把错误显示在屏幕上（诊断设施，ready 后自动失效）
    bootTrapWatchdog(this.node);
    // R03：统一启动诊断（引擎前注入片段可能已安装；这里取得控制器并补引擎后阶段打点）
    const boot = getBootController() ?? initCocosBootDiagnostics();
    boot.begin('scene');
    boot.end('scene');
    try {
    // 关闭屏幕左下角调试统计面板（发布包不应显示）
    profiler.hideStats();
    audioManager.loadSettings();
    boot.begin('engine');
    const platform = createPlatform();
    this.platform = platform;
    boot.end('engine');
    boot.begin('config');
    const [cfg] = await Promise.all([loadEconomyConfig(), loadRuntimeConfig()]);
    boot.end('config');
    this.auth = new AuthService(platform, { endpoint: getRuntimeConfig().authEndpoint });
    boot.begin('save');
    // R13：显式装载结果——unavailable/corrupt 时不创建可写 facade、不开启时钟
    const loadResult = await GameFacade.bootstrapWithStatus(platform, cfg);
    boot.end('save');
    if (loadResult.kind === 'unavailable' || loadResult.kind === 'corrupt') {
      const code = loadResult.kind === 'unavailable'
        ? (loadResult.reason === 'timeout' ? 'SAVE_UNAVAILABLE_TIMEOUT' : 'SAVE_UNAVAILABLE')
        : 'SAVE_CORRUPT';
      this.renderSaveGateError(code, 'save', loadResult.kind);
      boot.fail('BOOT_SAVE_GATE', 'save', `${loadResult.kind}:${loadResult.message}`);
      return;
    }
    this.facade = loadResult.facade;
    if (loadResult.kind === 'recovered') this.toast('已从本地备份恢复存档');
    // 回前台先记录时间点；进入后台记录水位，用于离线结算
    this.lastForegroundMs = Date.now();
    this.lastFrameMs = Date.now();
    this.buildRoot();
    this.render();
    this.bindLayoutListeners();
    // R03：只有 UI 已建好且事件绑定完成才声明 interactive（而非引擎 init 成功即完成）
    boot.markInteractive();

    // 首次启动隐私告知：未同意当前版本隐私政策前，先展示政策弹窗（A23）
    const privacyAccepted = await hasAcceptedPrivacy(platform);
    if (!privacyAccepted) {
      this.renderPrivacyDialog();
    } else {
      void this.ensurePlatformLogin(false);
      void this.setupAdsAfterConsent();
      void this.setupLeaderboardAfterConsent();
      void this.setupCloudAfterConsent();
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
    // 每秒保存一次真实进度，避免 5Hz 双槽事务产生过多平台存储写入。
    // GameClock 仍按真实 elapsed 逐月结算；跨阈值 tick 会在同一事务内补齐所有月份。
    this.schedule(this.clockTick, 1);

    // 前后台生命周期：进后台暂停音频+记水位；回前台做离线结算
    platform.onHide(() => {
      const now = Date.now();
      this.lastBackgroundMs = now;
      this.fgClock.enterBackground(now);
      audioManager.onAppHide();
      this.adCoordinator?.cancelLoading();
      this.adForegroundEligibleSinceMs = 0;
      // R15：保存提示只跟随真实提交结果，不在 onHide 无条件声称“已自动保存”
    });
    platform.onShow(() => this.onReturnForeground());
    } catch (err) {
      const stage = boot.snapshot().stage;
      const code = err instanceof GameError ? err.code : 'BOOT_FAILED';
      boot.fail('APP_START_FAILED', stage, err instanceof Error ? err.message : String(err));
      bootTrapError(err);
      // R07：正式错误页（错误编号 + 重试/退出），不仅结束首屏留下黑屏
      this.renderBootError(code, stage);
    }
  }

  /** R13：存档不可读/损坏专用闸门页：重试与退出；不提供新建、不开启时钟。 */
  private renderSaveGateError(code: string, stage: string, kind: 'unavailable' | 'corrupt'): void {
    try {
      const overlay = this.modalOverlay(true);
      createRect({ width: 320, height: 320, color: Color.WHITE, radius: 12, parent: overlay }).setPosition(0, 0);
      createLabel({ text: kind === 'corrupt' ? '本地存档异常' : '暂时读不到存档', fontSize: 20, bold: true, parent: overlay }).setPosition(0, 120);
      createLabel({
        text:
          kind === 'corrupt'
            ? `错误编号：${code}\n本地存档校验未通过，为避免覆盖你的进度，\n暂不创建新公司。可重试读取或退出后再进。`
            : `错误编号：${code}\n存储暂时无响应（可能是系统卡顿或权限问题）。\n进度仍在本机，不会被替换。请重试。`,
        fontSize: 14,
        color: THEME.text,
        width: 272,
        lineHeight: 22,
        parent: overlay,
      }).setPosition(0, 30);
      createButton({
        text: '重试读取',
        width: 220,
        height: 46,
        parent: overlay,
        onClick: () => {
          overlay.destroy();
          void this.restartBootAfterSaveGate();
        },
      }).setPosition(0, -80);
      createButton({
        text: '退出',
        width: 220,
        height: 40,
        fontSize: 14,
        color: Color.WHITE,
        textColor: THEME.textWeak,
        parent: overlay,
        onClick: () => {
          const g = globalThis as { tap?: { exitMiniProgram?: () => void } };
          g.tap?.exitMiniProgram?.();
        },
      }).setPosition(0, -132);
    } catch {
      /* Cocos UI 也不可用时 BootTrap 提供最后通道 */
    }
  }

  /** R13：闸门重试只重新执行一次启动尝试（不叠加 bootstrap/时钟）。 */
  private async restartBootAfterSaveGate(): Promise<void> {
    try {
      const platform = this.platform ?? createPlatform();
      this.platform = platform;
      const [cfg] = await Promise.all([loadEconomyConfig(), loadRuntimeConfig()]);
      const loadResult = await GameFacade.bootstrapWithStatus(platform, cfg);
      if (loadResult.kind === 'unavailable' || loadResult.kind === 'corrupt') {
        const code = loadResult.kind === 'unavailable' ? 'SAVE_UNAVAILABLE' : 'SAVE_CORRUPT';
        this.renderSaveGateError(code, 'save', loadResult.kind);
        return;
      }
      this.facade = loadResult.facade;
      this.lastForegroundMs = Date.now();
      this.buildRoot();
      this.render();
      this.bindLayoutListeners();
      const privacyAccepted = await hasAcceptedPrivacy(platform);
      if (!privacyAccepted) this.renderPrivacyDialog();
      else { void this.ensurePlatformLogin(false); void this.setupAdsAfterConsent(); void this.setupLeaderboardAfterConsent(); void this.setupCloudAfterConsent(); }
      this.schedule(this.clockTick, 1);
    } catch {
      this.renderSaveGateError('SAVE_UNAVAILABLE', 'save', 'unavailable');
    }
  }

  /** R03/R07：启动失败页——错误编号、阶段、重试与退出；不自动新建公司。 */
  private renderBootError(code: string, stage: string): void {
    try {
      const overlay = this.modalOverlay(true);
      createRect({ width: 320, height: 300, color: Color.WHITE, radius: 12, parent: overlay }).setPosition(0, 0);
      createLabel({ text: '启动失败', fontSize: 20, bold: true, parent: overlay }).setPosition(0, 110);
      createLabel({
        text: `错误编号：${code}\n阶段：${stage}\n\n本地经营数据未被修改，可重试启动；\n多次失败请稍后再试。`,
        fontSize: 14,
        color: THEME.text,
        width: 272,
        lineHeight: 22,
        parent: overlay,
      }).setPosition(0, 20);
      createButton({
        text: '重试',
        width: 220,
        height: 46,
        parent: overlay,
        onClick: () => {
          overlay.destroy();
          void this.start();
        },
      }).setPosition(0, -70);
      createButton({
        text: '退出',
        width: 220,
        height: 40,
        fontSize: 14,
        color: Color.WHITE,
        textColor: THEME.textWeak,
        parent: overlay,
        onClick: () => {
          const g = globalThis as { tap?: { exitMiniProgram?: () => void } };
          g.tap?.exitMiniProgram?.();
        },
      }).setPosition(0, -122);
    } catch {
      // Cocos UI 也不可用时，BootTrap 2D 画布/看门狗仍提供最后通道
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

  /** 首次启动隐私政策告知弹窗（R18：可在应用内读完全文；同意落盘成功前不登录/不外发）。 */
  private renderPrivacyDialog(): void {
    const layout = this.shellLayout();
    const overlay = this.modalOverlay();
    // R25：标题与底部操作固定，政策全文放可滚动正文（小屏也能读到结尾）
    const handle = openScrollableDialog({
      overlay,
      viewportHeight: layout.viewportHeight,
      title: '隐私保护提示',
      width: 320,
      desiredBodyHeight: 380,
    });
    const contentWidth = 320 - 56;
    const body = handle.body;
    createLabel({
      text: PRIVACY_POLICY_TEXT.summary,
      fontSize: 12,
      color: THEME.text,
      width: contentWidth,
      lineHeight: 19,
      align: 'left',
      parent: body,
    });
    for (const section of PRIVACY_POLICY_TEXT.sections) {
      createLabel({
        text: section.heading,
        fontSize: 13,
        bold: true,
        color: THEME.primary,
        width: contentWidth,
        align: 'left',
        parent: body,
      });
      createLabel({
        text: section.body,
        fontSize: 12,
        color: THEME.text,
        width: contentWidth,
        lineHeight: 19,
        align: 'left',
        parent: body,
      });
    }
    createLabel({
      text: `生效日期：${PRIVACY_POLICY_TEXT.effectiveDate}  联系：${PRIVACY_POLICY_TEXT.contact}`,
      fontSize: 11,
      color: THEME.textWeak,
      width: contentWidth,
      align: 'left',
      parent: body,
    });

    createButton({
      text: '同意并继续',
      width: 168,
      height: 48,
      parent: handle.footer,
      onClick: () => void this.onAcceptPrivacy(handle),
    }).setPosition(-60, 0);
    createButton({
      text: '不同意并退出',
      width: 110,
      height: 44,
      fontSize: 13,
      color: Color.WHITE,
      textColor: THEME.textWeak,
      parent: handle.footer,
      onClick: () => {
        handle.close();
        const g = globalThis as { tap?: { exitMiniProgram?: () => void } };
        g.tap?.exitMiniProgram?.();
      },
    }).setPosition(87, 0);
  }

  private async onAcceptPrivacy(handle: DialogHandle): Promise<void> {
    if (!this.platform || this.privacyBusy) return;
    this.privacyBusy = true;
    try {
      // R18：同意记录必须先成功落盘，成功后才允许平台登录/外发
      await acceptPrivacy(this.platform);
    } catch {
      this.privacyBusy = false;
      handle.setError('同意记录保存失败，请重试或检查存储权限');
      return;
    }
    handle.close();
    await this.ensurePlatformLogin(false);
    await this.setupAdsAfterConsent();
    await this.setupLeaderboardAfterConsent();
    await this.setupCloudAfterConsent();
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
  /** R25：隐私同意落盘进行中（防止重复点击发起两次登录）。 */
  private privacyBusy = false;
  /** R15：前后台真实时间水位（去重/防回拨），替代固定 200ms 与无条件保存提示。 */
  private readonly fgClock = createForegroundClock(() => Date.now());
  private lastFrameMs = 0;
  private settlingForeground = false;
  private clockTickInFlight = false;
  private pendingForegroundSettlement = false;
  private pendingOnlineTick: { elapsedMs: number; runId: string; atMs: number } | null = null;
  private adCoordinator: AdRewardCoordinator | null = null;
  private adForegroundEligibleSinceMs = 0;
  private adFirstEligibleRunId: string | null = null;
  private persistenceRecoveryOverlay: Node | null = null;

  private async setupAdsAfterConsent(): Promise<void> {
    if (!this.facade || !this.platform || !(await hasAcceptedPrivacy(this.platform))) return;
    const config = await loadAdsConfig();
    const provider = new TapRewardedAdProvider(config.enabled, config.rewardedAdUnitId);
    this.adCoordinator = new AdRewardCoordinator(provider, this.facade);
    try { await this.adCoordinator.recoverInterruptedSession(); }
    catch { if (this.facade.getPersistenceStatus() !== 'ready') this.renderPersistenceRecovery(); }
  }

  private async setupLeaderboardAfterConsent(): Promise<void> {
    if (!this.platform || !(await hasAcceptedPrivacy(this.platform))) return;
    this.leaderboardConfig = await loadLeaderboardConfig();
    this.leaderboardConsent = await this.platform.get<boolean>('ceo/leaderboard/consent/v1').catch(() => false) === true;
  }

  private async setupCloudAfterConsent(): Promise<void> {
    if (!this.platform || !(await hasAcceptedPrivacy(this.platform))) return;
    this.cloudConfig = await loadCloudConfig();
    const environment = this.cloudConfig.environment === 'production' ? 'production' : 'test';
    this.cloudSync = new CloudSyncService(new TapCloudSaveProvider(), this.platform, this.cloudConfig,
      this.cloudConfig.appId, environment, null);
    const status = await this.cloudSync.status();
    this.cloudStatusText = status.available
      ? '云备份可用；请先完成账号绑定'
      : '云备份未配置，当前进度只保存在本机';
  }

  private async maybeShowDailyRewardPrompt(): Promise<void> {
    if (!this.facade || !this.adCoordinator || this.facade.getState().phase !== 'RUNNING') return;
    if (this.adCoordinator.hasActiveSession()) return;
    if (this.root?.children.some((child) => child.name === 'ModalOverlay' && child.activeInHierarchy)) return;
    if (!this.facade.canRequestRewardedAd() || (this.facade.getState().adRewards?.couponIds.length ?? 0) > 0) return;
    const marked = await this.facade.markRewardPromptShown();
    if (marked.ok && marked.payload) this.renderRewardPrompt('完整观看可领1张免招聘费券，仅免一次招聘费，月薪照常支付，下月到岗；每天最多领取1次，7天内使用。');
  }

  private renderRewardPrompt(message: string): void {
    const overlay = this.modalOverlay();
    createRect({ width: 310, height: 220, color: Color.WHITE, radius: 12, parent: overlay });
    createLabel({ text: '自愿激励广告', fontSize: 18, bold: true, parent: overlay }).setPosition(0, 72);
    createLabel({ text: `${message}\n完整观看后发券；也可跳过继续经营。`, fontSize: 13, color: THEME.text, width: 270, lineHeight: 22, align: 'center', parent: overlay }).setPosition(0, 12);
    createButton({ text: '看视频领取', width: 130, height: 42, parent: overlay, onClick: () => { overlay.destroy(); void this.requestAdCoupon(); } }).setPosition(-72, -72);
    createButton({ text: '跳过', width: 110, height: 42, color: Color.WHITE, textColor: THEME.textWeak, parent: overlay, onClick: () => overlay.destroy() }).setPosition(72, -72);
  }

  private async requestAdCoupon(): Promise<void> {
    if (!this.adCoordinator) return;
    if (!this.adCoordinator.hasPendingGrant() && !this.isAdForegroundEligible()) { this.toast('经营满1分钟后可自愿观看广告'); return; }
    audioManager.pauseForReason('REWARDED_AD');
    const result = await this.adCoordinator.request().finally(() => audioManager.resumeForReason('REWARDED_AD'));
    if (result.kind === 'completed') {
      this.toast('已领取招聘券：仅免一次招聘费，月薪照付');
      this.render();
    } else if (result.kind === 'skipped') this.toast('未完整观看，本次未发券');
    else this.toast('广告暂不可用，可继续经营');
  }

  private async onReturnForeground(): Promise<void> {
    if (!this.facade) return;
    // R15：连续/重复 onShow 只允许一个结算尝试，旧 attempt 不再触发弹窗或写档
    if (this.settlingForeground) return;
    this.settlingForeground = true;
    try {
      const now = Date.now();
      const elapsedMs = this.fgClock.peekForegroundElapsed(now);
      this.lastForegroundMs = now;
      this.lastFrameMs = 0;
      audioManager.onAppShow();
      if (this.adCoordinator?.hasActiveSession()) {
        // Native ad coverage can trigger hide/show. Lifecycle alone is not a failed view.
        this.lastFrameMs = now;
        this.fgClock.markSettled(now);
        return;
      }
      // 回到前台静默重验平台会话（过期则后台刷新，不打断单机玩法）
      void this.ensurePlatformLogin(true);
      if (elapsedMs <= 0) {
        this.fgClock.markSettled(now);
        this.lastFrameMs = now;
        return;
      }
      this.pendingForegroundSettlement = true;
      const r = await this.facade.settleOffline(now);
      if (!r.ok) {
        if (this.facade.getPersistenceStatus() !== 'ready') this.renderPersistenceRecovery();
        return; // keep the interval pending; retry/reload must reconcile before consuming it
      }
      // 只有结算提交成功后才消费该区间；paused/非经营态也由settleOffline更新水位。
      this.pendingForegroundSettlement = false;
      this.fgClock.markSettled(now);
      this.lastFrameMs = now;
      if (r.ok && r.payload.monthsSettled > 0) {
        this.renderOfflineSummary(r.payload);
        this.render();
      }
    } finally {
      this.settlingForeground = false;
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
    this.tickAdEligibility();
    if (this.settlingForeground || this.clockTickInFlight) return;
    if (this.pendingForegroundSettlement) {
      void this.onReturnForeground();
      return;
    }
    if (this.pendingOnlineTick) {
      void this.reconcilePendingOnlineTick();
      return;
    }
    if (this.adCoordinator?.hasActiveSession()) { this.lastFrameMs = Date.now(); return; }
    if (this.facade.getPersistenceStatus() !== 'ready') {
      this.lastFrameMs = 0;
      this.renderPersistenceRecovery();
      return;
    }
    const s = this.facade.getState();
    if (s.phase !== 'RUNNING' || s.speed === 0) {
      this.lastFrameMs = Date.now();
      return;
    }
    // R15：用真实帧间隔，不再固定传 200ms；首帧/异常回拨按 0 处理
    const now = Date.now();
    const dt = this.lastFrameMs > 0 && now > this.lastFrameMs ? now - this.lastFrameMs : 0;
    if (dt <= 0) return;
    this.clockTickInFlight = true;
    void this.facade
      .advanceRealTime(dt, s.runId, now)
      .then((r) => {
        if (!r.ok) {
          if (this.facade?.getPersistenceStatus() === 'ready') {
            if (this.facade.getState().runId !== s.runId) this.lastFrameMs = now;
            // Keep the elapsed interval pending after a known non-commit conflict.
            return;
          }
          this.pendingOnlineTick = { elapsedMs: dt, runId: s.runId, atMs: now };
          this.lastFrameMs = 0;
          this.renderPersistenceRecovery();
          return;
        }
        this.pendingOnlineTick = null;
        this.lastFrameMs = now;
        // 在线推进已消耗的真实时间同步到前后台水位，避免下次离线重复计入
        this.fgClock.noteOnlineProgress(now);
        if (r.payload.monthsAdvanced === 0 && r.payload.yearsClosed.length === 0) return;
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
      .catch(() => {
        if (this.facade?.getPersistenceStatus() !== 'ready') {
          this.pendingOnlineTick = { elapsedMs: dt, runId: s.runId, atMs: now };
          this.lastFrameMs = 0;
          this.renderPersistenceRecovery();
        }
      })
      .finally(() => { this.clockTickInFlight = false; });
  }

  private tickAdEligibility(): void {
    if (!this.facade || !this.adCoordinator || !this.facade.getState().company) {
      this.adForegroundEligibleSinceMs = 0;
      this.adFirstEligibleRunId = null;
      return;
    }
    const state = this.facade.getState();
    if (state.phase !== 'RUNNING' || state.onboarding.initialHiresCompleted < 2 || this.adCoordinator.hasActiveSession()) {
      this.adForegroundEligibleSinceMs = 0;
      this.adFirstEligibleRunId = null;
      return;
    }
    const now = Date.now();
    if (this.adFirstEligibleRunId !== state.runId) {
      this.adFirstEligibleRunId = state.runId;
      this.adForegroundEligibleSinceMs = now;
      return;
    }
    if (this.adForegroundEligibleSinceMs === 0) this.adForegroundEligibleSinceMs = now;
    if (now - this.adForegroundEligibleSinceMs >= 60_000) void this.maybeShowDailyRewardPrompt();
  }

  private isAdForegroundEligible(): boolean {
    if (!this.facade || !this.adCoordinator) return false;
    const state = this.facade.getState();
    return state.phase === 'RUNNING' && state.onboarding.initialHiresCompleted >= 2
      && this.adFirstEligibleRunId === state.runId && this.adForegroundEligibleSinceMs > 0
      && Date.now() - this.adForegroundEligibleSinceMs >= 60_000
      && (!this.adCoordinator.hasActiveSession() || this.adCoordinator.hasPendingGrant());
  }

  private async reconcilePendingOnlineTick(): Promise<void> {
    const pending = this.pendingOnlineTick;
    if (!pending || !this.facade || this.facade.getPersistenceStatus() !== 'ready') return;
    const current = this.facade.getState();
    if (current.runId !== pending.runId) {
      this.pendingOnlineTick = null;
      this.lastFrameMs = Date.now();
      return;
    }
    if (current.lastWallClockMs >= pending.atMs) {
      this.pendingOnlineTick = null;
      this.lastFrameMs = pending.atMs;
      this.fgClock.noteOnlineProgress(pending.atMs);
      return;
    }
    this.clockTickInFlight = true;
    try {
      const result = await this.facade.advanceRealTime(pending.elapsedMs, pending.runId, pending.atMs);
      if (!result.ok) {
        if (this.facade.getPersistenceStatus() !== 'ready') this.renderPersistenceRecovery();
        return;
      }
      this.pendingOnlineTick = null;
      this.lastFrameMs = pending.atMs;
      this.fgClock.noteOnlineProgress(pending.atMs);
      if (result.payload.monthsAdvanced > 0 || result.payload.yearsClosed.length > 0) this.render();
    } catch {
      if (this.facade.getPersistenceStatus() !== 'ready') this.renderPersistenceRecovery();
    } finally {
      this.clockTickInFlight = false;
    }
  }

  private renderPersistenceRecovery(): void {
    if (!this.facade || this.persistenceRecoveryOverlay?.isValid) return;
    const overlay = this.modalOverlay();
    this.persistenceRecoveryOverlay = overlay;
    createRect({ width: 318, height: 250, color: Color.WHITE, radius: 12, parent: overlay });
    createLabel({ text: '正在保护经营存档', fontSize: 18, bold: true, parent: overlay }).setPosition(0, 88);
    createLabel({
      text: '上次操作的保存结果尚未确认。经营时间已暂停，请重试核对；核对前不会提交新操作。',
      fontSize: 13, color: THEME.text, width: 276, lineHeight: 22, align: 'center', parent: overlay,
    }).setPosition(0, 20);
    createButton({
      text: '重试核对存档', width: 220, height: 44, parent: overlay,
      onClick: async () => {
        try {
          if (this.facade?.getPersistenceStatus() === 'reset-pending') {
            overlay.destroy();
            this.persistenceRecoveryOverlay = null;
            await this.restartBootAfterSaveGate();
            return;
          }
          await this.facade?.retryPersistenceRecovery();
          if (this.facade?.getPersistenceStatus() !== 'ready') return;
          if (this.pendingOnlineTick) await this.reconcilePendingOnlineTick();
          if (this.facade?.getPersistenceStatus() !== 'ready') return;
          overlay.destroy();
          this.persistenceRecoveryOverlay = null;
          this.render();
          await this.onReturnForeground();
        } catch {
          this.toast('存档仍无法确认，请稍后再试');
        }
      },
    }).setPosition(0, -62);
    createButton({ text: '退出', width: 180, height: 38, fontSize: 13, color: Color.WHITE, textColor: THEME.textWeak, parent: overlay,
      onClick: () => { const g = globalThis as { tap?: { exitMiniProgram?: () => void } }; g.tap?.exitMiniProgram?.(); },
    }).setPosition(0, -118);
  }

  private buildRoot(): void {
    const canvas = this.node;
    // 全屏背景铺满画布，保证安全区/高屏外的留白与应用底色一致
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
    attachCoverBackground(backdrop, 'backgrounds/CEO_BG_SoftBlue_UI_9x20/spriteFrame');

    this.root = new Node('AppRoot');
    this.root.parent = canvas;
    this.root.addComponent(UITransform).setContentSize(new Size(DESIGN_WIDTH, DESIGN_HEIGHT));
    // R24：不再对 812 内容层整体缩放（原 BUG-002 兜底会把页面缩到 640 并等比缩小所有文字/热区）；
    // 改为页面壳按真实安全区锚定 Header/Footer，Body 取剩余高度滚动（见 renderMainShell/shellLayout）。
  }

  /** R24：当前窗口的壳布局（平台异常时回落设计基准，不阻断渲染）。 */
  private shellLayout(): ShellLayout {
    try {
      return computeShellLayout(this.platform ? this.platform.getWindowInfo() : null);
    } catch {
      return computeShellLayout(null);
    }
  }

  /** R24：订阅窗口/安全区变化；重复调用幂等（存档闸门重试路径会再次走到）。 */
  private bindLayoutListeners(): void {
    if (this.unbindLayout.length > 0) return;
    const relayout = () => this.relayout();
    const platform = this.platform;
    if (platform && typeof platform.onWindowResize === 'function') {
      this.unbindLayout.push(platform.onWindowResize(() => relayout()));
    }
    // 引擎级兜底：web/编辑器窗口拖拽、横竖屏切换
    view.on('canvas-resize', relayout, this);
    this.unbindLayout.push(() => view.off('canvas-resize', relayout, this));
  }

  /** R24/R27：热 resize 只重算壳几何，不重建内容——当前 Tab/页面、滚动位置与输入全部保留。 */
  private relayout(): void {
    const layout = this.shellLayout();
    if (this.shell) {
      const offset = this.shell.scrollView.getScrollOffset();
      this.applyShellLayout(layout, offset);
    }
    if (this.createPane) this.applyCreatePane(layout);
  }

  override onDestroy(): void {
    for (const unbind of this.unbindLayout) unbind();
    this.unbindLayout = [];
  }

  private clearRoot(): void {
    this.root.destroyAllChildren();
    this.toastNode = null;
    this.shell = null;
    this.createPane = null;
    this.createGuard = new CreateSubmitGuard();
    this.createCommandId = null;
    this.ceoErrorLabel = null;
    this.speedButtons = [];
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
      // 创建流程有两页（公司 / CEO），必须按子步骤分发，否则 CEO 页任何点击都会回到公司页
      if (this.createStep === 'CEO') this.renderCreateCeo();
      else this.renderCreateCompany();
    } else if (s.phase === 'HIRING_INITIAL' || (s.phase === 'TUTORIAL_DASHBOARD' && this.awaitingEnterCompany)) {
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

  // ---------------------------------------------------------------- R27 创建页通用壳

  /** 创建三步页：固定页头/页脚 + 中间滚动主体（与主壳同一套 authored 坐标）。 */
  private mountCreatePage(
    layout: ShellLayout,
    opts: { headerHeight?: number; footerHeight?: number },
  ): { content: Node; footer: Node } {
    const panel = this.fullPanel();
    const headerHeight = opts.headerHeight ?? 0;
    const footerHeight = opts.footerHeight ?? 72;
    const pane = computePaneLayout(layout, { headerHeight, footerHeight });

    let header: Node | null = null;
    if (headerHeight > 0) {
      header = createRect({
        name: 'CreateHeader',
        width: DESIGN_WIDTH,
        height: headerHeight,
        color: Color.WHITE,
        radius: 0,
        parent: panel,
      });
      header.addComponent(BlockInputEvents);
    }

    const scrollRoot = new Node('CreateScroll');
    scrollRoot.parent = panel;
    scrollRoot.addComponent(UITransform).setContentSize(new Size(DESIGN_WIDTH, pane.bodyHeight));
    scrollRoot.addComponent(BlockInputEvents);
    const scrollView = scrollRoot.addComponent(ScrollView);
    scrollView.horizontal = false;
    scrollView.vertical = true;

    const viewNode = new Node('CreateView');
    viewNode.parent = scrollRoot;
    viewNode.addComponent(UITransform).setContentSize(new Size(DESIGN_WIDTH, pane.bodyHeight));
    const mask = viewNode.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_RECT;

    const content = new Node('CreateContent');
    content.parent = viewNode;
    content.addComponent(UITransform).setContentSize(new Size(DESIGN_WIDTH, DESIGN_HEIGHT));
    scrollView.content = content;

    const footer = new Node('CreateFooter');
    footer.parent = panel;
    footer.addComponent(UITransform).setContentSize(new Size(DESIGN_WIDTH, pane.footerTotal));
    footer.addComponent(BlockInputEvents);
    const footerBg = footer.addComponent(Graphics);

    this.createPane = {
      header,
      scrollRoot,
      viewNode,
      content,
      scrollView,
      footer,
      footerBg,
      footerButtons: [],
      headerHeight,
      footerHeight,
      minBottom: 0,
      shift: 0,
    };
    return { content, footer };
  }

  /** 创建页底部固定操作按钮（几何由 applyCreatePane 统一摆放）。 */
  private addCreateFooterButton(opts: {
    text: string;
    x: number;
    width: number;
    height?: number;
    disabled?: boolean;
    color?: Color;
    textColor?: Color;
    fontSize?: number;
    onClick: () => void;
  }): Node {
    const pane = this.createPane;
    if (!pane) return new Node();
    const btn = createButton({
      text: opts.text,
      width: opts.width,
      height: opts.height ?? 48,
      color: opts.color,
      textColor: opts.textColor,
      fontSize: opts.fontSize,
      disabled: opts.disabled,
      parent: pane.footer,
      onClick: opts.onClick,
    });
    btn.setPosition(opts.x, 0);
    pane.footerButtons.push(btn);
    return btn;
  }

  /** 内容填充完毕后测量下探并应用几何。 */
  private finishCreatePage(layout: ShellLayout): void {
    const pane = this.createPane;
    if (!pane) return;
    pane.minBottom = this.measureContentBottom(pane.content);
    this.applyCreatePane(layout);
  }

  /** 创建页热 resize：只重算几何（保留滚动位置与输入节点）。 */
  private applyCreatePane(layout: ShellLayout): void {
    const pane = this.createPane;
    if (!pane) return;
    const geo = computePaneLayout(layout, {
      headerHeight: pane.headerHeight,
      footerHeight: pane.footerHeight,
    });
    const body = computeScrollBody(geo.bodyHeight, pane.minBottom);
    const delta = body.shift - pane.shift;
    if (delta !== 0) {
      for (const child of pane.content.children) {
        child.setPosition(child.position.x, child.position.y + delta, child.position.z);
      }
      pane.shift = body.shift;
    }
    pane.content.getComponent(UITransform)!.setContentSize(new Size(DESIGN_WIDTH, body.contentHeight));
    pane.content.setPosition(0, body.contentY);
    pane.scrollRoot.getComponent(UITransform)!.setContentSize(new Size(DESIGN_WIDTH, geo.bodyHeight));
    pane.scrollRoot.setPosition(0, geo.bodyCenterY);
    pane.viewNode.getComponent(UITransform)!.setContentSize(new Size(DESIGN_WIDTH, geo.bodyHeight));

    if (pane.header) {
      pane.header.setPosition(layout.footerShiftX, geo.bodyTopY + pane.headerHeight / 2);
      pane.header.getComponent(UITransform)!.setContentSize(new Size(layout.contentWidth, pane.headerHeight));
    }

    pane.footer.setPosition(layout.footerShiftX, geo.footerBgY);
    pane.footer.getComponent(UITransform)!.setContentSize(new Size(layout.contentWidth, geo.footerTotal));
    const g = pane.footerBg;
    g.clear();
    g.fillColor = Color.WHITE;
    g.rect(-layout.contentWidth / 2, -geo.footerTotal / 2, layout.contentWidth, geo.footerTotal);
    g.fill();
    for (const btn of pane.footerButtons) {
      btn.setPosition(btn.position.x, layout.bottomInset / 2, btn.position.z);
    }
  }

  /** 整块可点的选择卡：标题 + 可选说明，长文本换行不缩字。 */
  private createChoiceCard(
    parent: Node,
    opts: {
      y: number;
      height: number;
      width?: number;
      selected: boolean;
      title: string;
      titleSize?: number;
      caption?: string;
      onTap: () => void;
    },
  ): Node {
    const width = opts.width ?? 343;
    const card = createRect({
      width,
      height: opts.height,
      color: opts.selected ? new Color().fromHEX('#EAF1FB') : Color.WHITE,
      radius: 8,
      parent,
    });
    card.setPosition(0, opts.y);
    card.addComponent(BlockInputEvents);
    card.on(Node.EventType.TOUCH_END, opts.onTap);
    createLabel({
      text: opts.title,
      fontSize: opts.titleSize ?? 15,
      bold: opts.selected,
      color: opts.selected ? THEME.primary : THEME.text,
      width: width - 24,
      align: 'left',
      parent: card,
    }).setPosition(0, opts.caption ? 9 : 0);
    if (opts.caption) {
      createLabel({
        text: opts.caption,
        fontSize: 12,
        color: THEME.textWeak,
        width: width - 24,
        lineHeight: 18,
        align: 'left',
        parent: card,
      }).setPosition(0, -15);
    }
    return card;
  }

  /** 提交中禁用页脚全部按钮（连点不再发命令）。 */
  private setCreateFooterBusy(busy: boolean): void {
    const pane = this.createPane;
    if (!pane) return;
    for (const btn of pane.footerButtons) {
      const button = btn.getComponent(Button);
      if (button) button.enabled = !busy;
      const opacity = btn.getComponent(UIOpacity) ?? btn.addComponent(UIOpacity);
      opacity.opacity = busy ? 150 : 255;
    }
  }

  private showCeoNameError(message: string): void {
    const label = this.ceoErrorLabel?.getComponent(Label);
    if (label) label.string = message;
    else this.toast(message);
  }

  /** 随机 CEO 姓名：批次号递增，确定性派生，不消耗市场 RNG。 */
  private rollCeoName(advance: boolean): void {
    if (advance) this.ceoNameNonce += 1;
    this.customCeoName = generateCeoName(this.state().runId, this.ceoNameNonce);
    this.render();
  }

  // ---------------------------------------------------------------- S01 创建公司

  /**
   * 重新抽取候选公司名。
   * @param advance true=用户点「换一批」，递增批次号换出新名字；
   *                false=切换行业等场景，沿用当前批次。
   */
  private rollNames(advance = false): void {
    if (advance) this.nameNonce += 1;
    const rolled = this.facade.rollCompanyNames(this.selectedIndustry, 3, this.nameNonce);
    this.randomCompanyNames = Array.from(rolled).map((n) => String(n));
    this.selectedNameIndex = 0;
  }

  /** 当前将使用的公司名（自定义优先由 selectedNameIndex=-1 表示）。 */
  private chosenCompanyName(): string {
    if (this.selectedNameIndex < 0) return this.customCompanyName;
    return this.randomCompanyNames[this.selectedNameIndex] ?? '';
  }

  private renderCreateCompany(): void {
    const layout = this.shellLayout();
    const { content } = this.mountCreatePage(layout, { footerHeight: 72 });

    createLabel({ text: '《我是CEO》', fontSize: 24, bold: true, color: THEME.primary, parent: content }).setPosition(0, 372);
    createLabel({
      text: CREATE_COPY.stepCompany,
      fontSize: TEXT_TOKENS.caption.fontSize,
      color: THEME.textWeak,
      parent: content,
    }).setPosition(0, 342);

    // 行业组：标题 + 说明 + 三个选项（选项间 8）
    createLabel({ text: '主营行业', fontSize: 16, bold: true, width: 343, align: 'left', parent: content }).setPosition(0, 308);
    createLabel({
      text: CREATE_COPY.industryHint,
      fontSize: 12,
      color: THEME.textWeak,
      width: 343,
      lineHeight: 18,
      align: 'left',
      parent: content,
    }).setPosition(0, 282);
    (Object.keys(INDUSTRY_LABELS) as IndustryId[]).forEach((id, i) => {
      this.createChoiceCard(content, {
        y: 228 - i * 68,
        height: 60,
        selected: this.selectedIndustry === id,
        title: INDUSTRY_LABELS[id],
        caption: INDUSTRY_PRESENTATION[id].blurb,
        onTap: () => {
          this.selectedIndustry = id;
          this.rollNames();
          this.render();
        },
      });
    });

    // 名称组
    createLabel({ text: '公司名称', fontSize: 16, bold: true, width: 343, align: 'left', parent: content }).setPosition(0, 26);
    createLabel({
      text: CREATE_COPY.companyNameHint,
      fontSize: 12,
      color: THEME.textWeak,
      width: 343,
      lineHeight: 18,
      align: 'left',
      parent: content,
    }).setPosition(0, -2);
    this.randomCompanyNames.forEach((name, i) => {
      this.createChoiceCard(content, {
        y: -48 - i * 58,
        height: 50,
        selected: this.selectedNameIndex === i,
        title: name,
        onTap: () => {
          this.selectedNameIndex = i;
          this.render();
        },
      });
    });

    const hasCustom = this.customCompanyName.length >= 2;
    const customY = -48 - this.randomCompanyNames.length * 58;
    if (hasCustom) {
      this.createChoiceCard(content, {
        y: customY,
        height: 50,
        selected: this.selectedNameIndex < 0,
        title: `自定义：${this.customCompanyName}`,
        onTap: () => {
          this.selectedNameIndex = -1;
          this.render();
        },
      });
    }
    const actionY = hasCustom ? customY - 58 : customY;
    createButton({
      text: '换一批',
      width: 158,
      height: 44,
      color: Color.WHITE,
      textColor: THEME.primary,
      fontSize: 13,
      parent: content,
      onClick: () => {
        this.rollNames(true);
        this.render();
      },
    }).setPosition(-83, actionY);
    createButton({
      text: hasCustom ? '改名' : '自定义名称',
      width: 158,
      height: 44,
      color: Color.WHITE,
      textColor: THEME.primary,
      fontSize: 13,
      parent: content,
      onClick: () => this.openCustomNameDialog(),
    }).setPosition(83, actionY);

    const chosenName = this.chosenCompanyName();
    this.addCreateFooterButton({
      text: '下一步：创建 CEO',
      width: 327,
      height: 50,
      x: 0,
      disabled: Array.from(chosenName).length < 2,
      onClick: () => {
        this.createStep = 'CEO';
        this.render();
      },
    });
    this.finishCreatePage(layout);
  }

  /** 自定义公司名输入弹窗（Cocos EditBox，真机会唤起系统键盘）。 */
  private openCustomNameDialog(): void {
    // R25：通用输入弹窗——标签/字数/内联校验，卡片固定在上半区避让键盘
    const layout = this.shellLayout();
    openInputDialog({
      overlay: this.modalOverlay(),
      viewportHeight: layout.viewportHeight,
      title: '自定义公司名称',
      label: '公司名称',
      hint: '2–20 个字，创建后不可修改',
      initialValue: this.customCompanyName,
      minLength: 2,
      maxLength: 20,
      placeholder: '例如：向上生长科技',
      submitText: '使用这个名字',
      validate: (raw) => {
        const result = validateCompanyName(raw);
        return result.ok ? null : COMPANY_NAME_ERROR_TEXT[result.reason];
      },
      onSubmit: (value, dialog) => {
        this.customCompanyName = value;
        this.selectedNameIndex = -1;
        dialog.succeed();
        this.render();
      },
    });
  }

  // ---------------------------------------------------------------- S02 CEO

  private renderCreateCeo(): void {
    const layout = this.shellLayout();
    const { content } = this.mountCreatePage(layout, { footerHeight: 72 });
    if (!this.customCeoName) {
      this.customCeoName = generateCeoName(this.state().runId, this.ceoNameNonce);
    }

    createLabel({ text: '《我是CEO》', fontSize: 24, bold: true, color: THEME.primary, parent: content }).setPosition(0, 372);
    createLabel({
      text: CREATE_COPY.stepCeo,
      fontSize: 12,
      color: THEME.textWeak,
      parent: content,
    }).setPosition(0, 342);

    // CEO 姓名：真实 EditBox（键盘可输入） + 随机按钮
    createLabel({ text: 'CEO 姓名', fontSize: 16, bold: true, width: 343, align: 'left', parent: content }).setPosition(0, 308);
    createLabel({
      text: CREATE_COPY.ceoNameHint,
      fontSize: 12,
      color: THEME.textWeak,
      width: 343,
      lineHeight: 18,
      align: 'left',
      parent: content,
    }).setPosition(0, 282);
    createRect({ width: 224, height: 48, color: THEME.bg, radius: 8, parent: content }).setPosition(-52, 238);
    const ceoInput = new Node('CeoNameInput');
    ceoInput.parent = content;
    ceoInput.setPosition(-52, 238);
    ceoInput.addComponent(UITransform).setContentSize(new Size(208, 40));
    const edit = ceoInput.addComponent(EditBox);
    edit.placeholder = '输入 CEO 姓名';
    edit.maxLength = CEO_NAME_MAX;
    edit.inputMode = EditBox.InputMode.SINGLE_LINE;
    edit.string = this.customCeoName;
    // EditBox 默认白字在浅色背景上不可见；锚点改 (0,1) 防止文字甩出输入框
    const paintInput = (): void => {
      const placeholder = edit.placeholderLabel as Label | null;
      if (placeholder) {
        placeholder.color = THEME.textWeak;
        placeholder.fontSize = 14;
        placeholder.node.getComponent(UITransform)?.setAnchorPoint(0, 1);
      }
      const text = edit.textLabel as Label | null;
      if (text) {
        text.color = THEME.text;
        text.fontSize = 14;
        text.node.getComponent(UITransform)?.setAnchorPoint(0, 1);
      }
    };
    paintInput();
    edit.node.on(EditBox.EventType.TEXT_CHANGED, () => {
      // 手填即写入字段：上一步/下一步/重载模板都从这里恢复
      this.customCeoName = edit.string ?? '';
      const errorLabel = this.ceoErrorLabel?.getComponent(Label);
      if (errorLabel) errorLabel.string = '';
    });
    edit.node.on(EditBox.EventType.EDITING_DID_ENDED, paintInput);
    createButton({
      text: '随机姓名',
      width: 96,
      height: 44,
      fontSize: 13,
      color: Color.WHITE,
      textColor: THEME.primary,
      parent: content,
      onClick: () => this.rollCeoName(true),
    }).setPosition(116, 238);

    // 姓名校验错误（内联，不覆盖输入内容）
    this.ceoErrorLabel = createLabel({
      text: '',
      fontSize: 12,
      color: THEME.danger,
      width: 343,
      align: 'left',
      parent: content,
    });
    this.ceoErrorLabel.setPosition(0, 198);

    // 性格：标题与说明分行，整卡可点
    createLabel({ text: '选择性格（决定年度成长方向）', fontSize: 16, bold: true, width: 343, align: 'left', parent: content }).setPosition(0, 150);
    (Object.keys(TRAIT_LABELS) as CeoTrait[]).forEach((trait, i) => {
      const meta = TRAIT_LABELS[trait];
      const selected = this.selectedTrait === trait;
      const card = createRect({
        width: 343,
        height: 72,
        color: selected ? new Color().fromHEX('#EAF1FB') : Color.WHITE,
        radius: 8,
        parent: content,
      });
      card.setPosition(0, 94 - i * 82);
      card.addComponent(BlockInputEvents);
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
      }).setPosition(-115, 16);
      createLabel({
        text: meta.desc,
        fontSize: 12,
        color: THEME.textWeak,
        align: 'left',
        width: 300,
        lineHeight: 18,
        parent: card,
      }).setPosition(-1, -12);
    });

    // 初始能力：三项分列
    createLabel({ text: '初始能力', fontSize: 16, bold: true, width: 343, align: 'left', parent: content }).setPosition(0, -142);
    const abilities: Array<[string, number]> = [
      ['商业', 50],
      ['管理', 50],
      ['财务', 50],
    ];
    abilities.forEach(([name, value], i) => {
      const card = createRect({ width: 108, height: 64, color: Color.WHITE, radius: 8, parent: content });
      card.setPosition(-115 + i * 115, -196);
      createLabel({ text: name, fontSize: 12, color: THEME.textWeak, parent: card }).setPosition(0, 14);
      createLabel({ text: String(value), fontSize: 20, bold: true, color: THEME.primary, parent: card }).setPosition(0, -10);
    });
    createLabel({
      text: CREATE_COPY.abilityHint,
      fontSize: 12,
      color: THEME.textWeak,
      width: 343,
      lineHeight: 18,
      align: 'left',
      parent: content,
    }).setPosition(0, -244);

    this.addCreateFooterButton({
      text: '上一步',
      width: 158,
      height: 48,
      x: -85,
      color: Color.WHITE,
      textColor: THEME.text,
      onClick: () => {
        this.createStep = 'COMPANY';
        this.render();
      },
    });
    this.addCreateFooterButton({
      text: '下一步：招聘员工',
      width: 158,
      height: 48,
      x: 85,
      onClick: () => void this.submitCreateCompany(),
    });
    this.finishCreatePage(layout);
  }

  /**
   * R27：创建公司只从 CEO 页「下一步」发出一次。
   * 连点由 CreateSubmitGuard + 页脚禁用拦截；明确失败复用同一 commandId 重试（领域幂等）。
   */
  private async submitCreateCompany(): Promise<void> {
    if (this.createGuard.busy || this.createGuard.done) return;
    const name = this.chosenCompanyName();
    const companyCheck = validateCompanyName(name);
    if (!companyCheck.ok) {
      this.toast(COMPANY_NAME_ERROR_TEXT[companyCheck.reason]);
      return;
    }
    const nameError = ceoNameError(this.customCeoName);
    if (nameError) {
      this.showCeoNameError(nameError);
      return;
    }

    const commandId = this.createCommandId ?? nextCommandId('create');
    this.createCommandId = commandId;
    if (!this.createGuard.begin(commandId)) return;
    const originRunId = this.state().runId;
    this.setCreateFooterBusy(true);
    const result = await this.facade.createCompany(
      {
        companyName: companyCheck.name,
        industry: this.selectedIndustry,
        ceoName: this.customCeoName,
        ceoTrait: this.selectedTrait,
      },
      { commandId, expectedRunId: originRunId },
    );
    this.setCreateFooterBusy(false);
    if (!result.ok) {
      if (result.code === 'RUN_CHANGED' || result.code === 'NOT_READY') {
        // 公司已由本轮其他路径创建：结束本意图，按真实 phase 重渲染
        this.createGuard.abort();
        this.createCommandId = null;
        this.toast(result.displayMessage);
        this.render();
        return;
      }
      this.createGuard.fail();
      this.toast(result.displayMessage);
      return;
    }
    this.createGuard.succeed();
    this.createCommandId = null;
    this.render();
  }

  // ---------------------------------------------------------------- S03 首聘

  private renderInitialHiring(): void {
    const layout = this.shellLayout();
    const s = this.state();
    const view = initialHireView(s.onboarding.initialHiresCompleted, 2);
    const { content } = this.mountCreatePage(layout, { headerHeight: 64, footerHeight: 76 });

    // 固定页头：进度与现金始终可见（滚动候选时不丢失）
    const header = this.createPane?.header;
    if (header) {
      createLabel({
        text: CREATE_COPY.stepHiring,
        fontSize: 16,
        bold: true,
        width: 180,
        align: 'left',
        parent: header,
      }).setPosition(-82, 12);
      createLabel({
        text: `现金 ${moneyText(s.company?.cashYuan ?? 0)}`,
        fontSize: 14,
        bold: true,
        width: 160,
        align: 'right',
        parent: header,
      }).setPosition(92, 12);
      createLabel({
        text: `${view.progressLabel} · ${view.hintLabel}`,
        fontSize: 12,
        color: THEME.textWeak,
        width: 343,
        align: 'left',
        parent: header,
      }).setPosition(0, -14);
    }

    createLabel({
      text: CREATE_COPY.hireFeeHint,
      fontSize: 12,
      color: THEME.textWeak,
      width: 343,
      lineHeight: 18,
      align: 'left',
      parent: content,
    }).setPosition(0, 386);

    const deptId = s.departments[0]?.deptId;
    if (!deptId) {
      this.toast('部门数据异常');
      this.finishCreatePage(layout);
      return;
    }
    const offer = this.facade.getOffer(deptId);
    this.pendingOffer = offer;

    // 已录用候选不再出现在可选列表；2/2 后不再允许继续录用（phase 已转看板）
    const hiredIds = new Set(s.employees.map((e) => e.candidateId));
    const available = offer.candidates.filter((c) => !hiredIds.has(c.candidateId));
    if (view.done) {
      createLabel({
        text: '两名员工已到岗',
        fontSize: 18,
        bold: true,
        color: THEME.primary,
        parent: content,
      }).setPosition(0, 300);
      createLabel({
        text: s.employees.map((e) => e.name).join('、'),
        fontSize: 15,
        width: 343,
        parent: content,
      }).setPosition(0, 264);
      createLabel({
        text: '点击下方「进入公司」开始经营',
        fontSize: 14,
        color: THEME.textWeak,
        width: 343,
        parent: content,
      }).setPosition(0, 220);
      this.addCreateFooterButton({
        text: view.continueLabel,
        width: 327,
        height: 50,
        x: 0,
        onClick: () => void this.startClock(),
      });
      this.finishCreatePage(layout);
      return;
    }

    available.forEach((c, idx) => {
      // 费用一律取领域层 previewHire（含 HR 折扣与余额判断），UI 不猜公式
      const preview = this.facade.previewHire({
        offerId: offer.offerId,
        candidateId: c.candidateId,
        departmentId: deptId,
      });
      const fee = preview.ok ? preview.payload.feeYuan : Number.NaN;
      const affordable = preview.ok ? preview.payload.affordable : false;
      const salary = preview.ok ? preview.payload.salaryMonthlyYuan : c.salaryMonthlyYuan;
      const rows = candidateRows({ ...c, salaryMonthlyYuan: salary }, fee, affordable);

      const card = createRect({ width: 343, height: 160, color: Color.WHITE, radius: 8, parent: content });
      card.setPosition(0, 326 - idx * 170);
      createLabel({
        text: rows.nameLine,
        fontSize: 15,
        bold: true,
        width: 311,
        align: 'left',
        parent: card,
      }).setPosition(0, 60);
      createLabel({
        text: rows.abilityLine,
        fontSize: 12,
        color: THEME.textWeak,
        width: 311,
        align: 'left',
        parent: card,
      }).setPosition(0, 34);
      createLabel({
        text: rows.salaryLine,
        fontSize: 14,
        width: 311,
        align: 'left',
        parent: card,
      }).setPosition(0, 12);
      createLabel({
        text: rows.feeLine,
        fontSize: 14,
        color: preview.ok ? THEME.primary : THEME.textWeak,
        width: 311,
        align: 'left',
        parent: card,
      }).setPosition(0, -12);
      createButton({
        text: rows.hireLabel,
        width: 311,
        height: 44,
        fontSize: 14,
        disabled: !rows.hireEnabled,
        parent: card,
        onClick: () => this.openInitialHireConfirm(c.candidateId),
      }).setPosition(0, -50);
    });

    this.addCreateFooterButton({
      text: view.continueLabel,
      width: 327,
      height: 50,
      x: 0,
      disabled: !view.done,
      onClick: () => void this.startClock(),
    });
    this.finishCreatePage(layout);
  }

  private openInitialHireConfirm(candidateId: string): void {
    const s = this.state();
    const deptId = s.departments[0]?.deptId;
    const offer = this.pendingOffer;
    if (!deptId || !offer) return;
    this.openHireConfirm(candidateId, deptId, { initial: true, offer });
  }

  /**
   * R26：录用收费确认（preview → confirm → submitting → committed）。
   * 费用由领域层 previewHire 给出（含 HR 折扣），UI 不猜测公式；
   * 取消零变更；同一意图固定一个 commandId，提交忙碌防重，重试幂等。
   */
  private openHireConfirm(
    candidateId: string,
    deptId: string,
    opts: { initial: boolean; offer: CandidateOffer; couponId?: string },
  ): void {
    const previewInput = { offerId: opts.offer.offerId, candidateId, departmentId: deptId, ...(opts.couponId ? { couponId: opts.couponId } : {}) };
    const pv = this.facade.previewHire(previewInput);
    if (!pv.ok) {
      this.toast(pv.displayMessage);
      if (pv.code === 'OFFER_EXPIRED' && !opts.initial) this.openHireForDept(deptId);
      return;
    }
    const p = pv.payload;
    const input = { ...previewInput, expectedRevision: pv.revision };
    // 一次开框固定一个意图：commandId 与发起 runId 都在闭包里，重试复用同一个
    const commandId = nextCommandId('hire');
    const originRunId = this.state().runId;
    openConfirmDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '确认录用？',
      message:
        `候选人：${p.candidateName}\n月薪：${moneyText(p.salaryMonthlyYuan)}\n` +
        `一次性招聘费：${moneyText(p.feeYuan)}（确认即支付）\n` +
        (opts.couponId ? '招聘券只免本次招聘费；月薪仍正常支付。\n' : '') +
        `当前现金：${moneyText(p.cashBeforeYuan)}\n支付后现金：${moneyText(p.cashAfterYuan)}\n` +
        (p.firstHire ? '首聘当月到岗' : '次月到岗'),
      width: 312,
      confirmText: p.feeYuan === 0 ? '使用招聘券并录用' : `确认支付 ${moneyText(p.feeYuan)}`,
      busyText: '录用中…',
      confirmEnabled: p.affordable,
      onConfirm: async (dialog) => {
        const r = await this.facade.hireEmployee(input, { commandId, expectedRunId: originRunId });
        if (!r.ok) {
          if (r.code === 'OFFER_EXPIRED' || r.code === 'RUN_CHANGED' || r.code === 'CONFIRMATION_EXPIRED') {
            dialog.succeed();
            this.toast(r.displayMessage);
            if (r.code === 'OFFER_EXPIRED' && !opts.initial) this.openHireForDept(deptId);
            else if (r.code === 'CONFIRMATION_EXPIRED' && opts.initial) this.render();
            else if (r.code === 'CONFIRMATION_EXPIRED') this.openHireForDept(deptId);
            return;
          }
          // 明确失败：内联显示原因，允许同一 commandId 重试
          dialog.fail(r.displayMessage);
          return;
        }
        dialog.succeed();
        this.toast(opts.initial
          ? `已录用，支付招聘费 ${moneyText(r.payload.feePaidYuan)}`
          : `已录用，支付招聘费 ${moneyText(r.payload.feePaidYuan)}，次月到岗`);
        if (!opts.initial) audioManager.recruit();
        if (opts.initial && this.state().onboarding.initialHiresCompleted >= 2) {
          this.awaitingEnterCompany = true;
        }
        if (this.state().runId === originRunId) this.render();
      },
      onCancel: () => {
        if (!opts.initial && this.state().runId === originRunId) this.renderHireDialog(opts.offer, deptId);
      },
    });
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
    this.awaitingEnterCompany = false;
    this.render();
  }

  // ---------------------------------------------------------------- 四 Tab 主壳

  private renderMainShell(): void {
    const panel = this.fullPanel();
    const layout = this.shellLayout();

    // R24：Body = 头尾之间剩余高度 + ScrollView；内容容器按 authored 坐标（812 中心原点）
    // 交给各 Tab，渲染后按实际下探扩展内容高并顶部对齐，长列表（部门/员工）不再被底栏遮挡。
    const scrollRoot = new Node('BodyScroll');
    scrollRoot.parent = panel;
    scrollRoot.addComponent(UITransform).setContentSize(new Size(DESIGN_WIDTH, layout.bodyHeight));
    scrollRoot.setPosition(0, layout.bodyCenterY);
    // 挡住滚动区自身的空白处触摸，避免落到下层
    scrollRoot.addComponent(BlockInputEvents);
    const scrollView = scrollRoot.addComponent(ScrollView);
    scrollView.horizontal = false;
    scrollView.vertical = true;

    const viewNode = new Node('BodyView');
    viewNode.parent = scrollRoot;
    viewNode.addComponent(UITransform).setContentSize(new Size(DESIGN_WIDTH, layout.bodyHeight));
    const mask = viewNode.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_RECT;

    const content = new Node('BodyContent');
    content.parent = viewNode;
    content.addComponent(UITransform).setContentSize(new Size(DESIGN_WIDTH, DESIGN_HEIGHT));
    scrollView.content = content;

    if (this.activeTab === 'COMPANY') this.renderCompanyTab(content);
    else if (this.activeTab === 'DEPARTMENT') this.renderDepartmentTab(content);
    else if (this.activeTab === 'TALENT') this.renderTalentTab(content);
    else this.renderRankTab(content);

    const footer = this.renderBottomTabs(panel, layout);

    this.shell = {
      scrollRoot,
      viewNode,
      content,
      scrollView,
      footer: footer.root,
      footerBg: footer.bg,
      footerButtons: footer.buttons,
      minBottom: this.measureContentBottom(content),
      shift: 0,
    };
    this.applyShellLayout(layout, null);
    // R30：人才页按滚动位置复用卡片池
    if (this.activeTab === 'TALENT') {
      scrollView.node.on(ScrollView.EventType.SCROLLING, this.updateTalentWindow, this);
      this.updateTalentWindow();
    }
  }

  /** R24：内容容器直接子节点的最低下探（authored 坐标）。 */
  private measureContentBottom(content: Node): number {
    let minBottom = 0;
    for (const child of content.children) {
      const tr = child.getComponent(UITransform);
      if (!tr) continue;
      minBottom = Math.min(minBottom, child.position.y - tr.height / 2);
    }
    return minBottom;
  }

  /**
   * R24：应用壳几何。preserveOffset 非空时为热 resize：只改几何并恢复滚动位置；
   * 为 null 时是首次排版：内容顶部对齐可视顶。
   */
  private applyShellLayout(layout: ShellLayout, preserveOffset: Vec2 | null): void {
    const shell = this.shell;
    if (!shell) return;

    // 内容高：至少一屏设计高与当前可视高，且覆盖 Tab 内容实际下探（顶锚 812/2 基准）
    const geo = computeScrollBody(layout.bodyHeight, shell.minBottom);
    const delta = geo.shift - shell.shift;
    if (delta !== 0) {
      for (const child of shell.content.children) {
        child.setPosition(child.position.x, child.position.y + delta, child.position.z);
      }
      shell.shift = geo.shift;
    }
    shell.content.getComponent(UITransform)!.setContentSize(new Size(DESIGN_WIDTH, geo.contentHeight));

    // Body 可视区
    shell.scrollRoot.getComponent(UITransform)!.setContentSize(new Size(DESIGN_WIDTH, layout.bodyHeight));
    shell.scrollRoot.setPosition(0, layout.bodyCenterY);
    shell.viewNode.getComponent(UITransform)!.setContentSize(new Size(DESIGN_WIDTH, layout.bodyHeight));
    shell.content.setPosition(0, geo.contentY);

    // Footer：锚定可视区底部，底部 inset 抬升按钮行，背景含 inset
    shell.footer.setPosition(layout.footerShiftX, layout.footerBgY);
    shell.footer.getComponent(UITransform)!.setContentSize(new Size(layout.contentWidth, layout.footerTotal));
    const g = shell.footerBg;
    g.clear();
    g.fillColor = Color.WHITE;
    g.rect(-layout.contentWidth / 2, -layout.footerTotal / 2, layout.contentWidth, layout.footerTotal);
    g.fill();
    for (const btn of shell.footerButtons) {
      btn.setPosition(btn.position.x, layout.bottomInset / 2, btn.position.z);
    }

    if (preserveOffset) {
      shell.scrollView.scrollToOffset(new Vec2(preserveOffset.x, preserveOffset.y), 0);
    }
    // R30：窗口尺寸变化后重算人才页可视窗口
    if (this.activeTab === 'TALENT') this.updateTalentWindow();
  }

  private renderCompanyTab(parent: Node): void {
    const s = this.state();
    const company = s.company;
    const vm = this.facade.getCompanyOverview();
    if (!company || !vm) return;

    // R28：顶部栏 = 单行公司名（超长裁切，点按查看完整资料）+ 独立设置热区
    createRect({ width: 375, height: 88, color: THEME.primary, radius: 0, parent: parent }).setPosition(0, 356);
    const nameNode = createLabel({
      text: company.name,
      fontSize: 16,
      bold: true,
      color: Color.WHITE,
      width: 238,
      align: 'left',
      parent: parent,
    });
    nameNode.setPosition(-38, 372);
    const nameLabel = nameNode.getComponent(Label);
    if (nameLabel) nameLabel.overflow = Label.Overflow.CLAMP;
    createLabel({
      text: `${INDUSTRY_LABELS[company.industry]} · 创业第 ${s.gameYear} 年 · 第 ${s.gameMonth} 月`,
      fontSize: 11,
      color: new Color(220, 230, 245),
      parent: parent,
    }).setPosition(-38, 348);
    // 透明整块热区：长名不压设置，点按公司名查看完整档案
    createButton({
      text: '',
      width: 252,
      height: 60,
      fontSize: 12,
      color: new Color(255, 255, 255, 0),
      parent: parent,
      onClick: () => this.renderCompanyDetail(),
    }).setPosition(-38, 364);
    createButton({
      text: '设置',
      width: 56,
      height: 40,
      fontSize: 12,
      color: new Color(255, 255, 255, 40),
      parent: parent,
      onClick: () => this.renderSettings(),
    }).setPosition(145, 364);

    // R28：现金主指标；营收/利润为已结算累计附指标（口径写在标题里，不把预计当实际）
    const cashCard = createRect({ width: 343, height: 86, color: Color.WHITE, radius: 8, parent: parent });
    cashCard.setPosition(0, 258);
    createLabel({ text: '当前可用现金', fontSize: 12, color: THEME.textWeak, parent: cashCard }).setPosition(0, 26);
    createLabel({
      text: moneyText(vm.cashYuan),
      fontSize: 26,
      bold: true,
      color: vm.cashYuan < 0 ? THEME.danger : THEME.text,
      width: 320,
      parent: cashCard,
    }).setPosition(0, -6);
    createLabel({
      text: '可立即用于招聘、扩产与发薪',
      fontSize: 11,
      color: THEME.textWeak,
      parent: cashCard,
    }).setPosition(0, -32);

    const profitColor = vm.ytdProfitYuan < 0 ? THEME.danger : THEME.profit;
    const secondary: Array<[string, number, Color]> = [
      ['本年累计收入（已结算）', vm.ytdRevenueYuan, THEME.text],
      ['本年累计利润（已结算）', vm.ytdProfitYuan, profitColor],
    ];
    secondary.forEach(([title, value, color], i) => {
      const card = createRect({ width: 167, height: 62, color: Color.WHITE, radius: 8, parent: parent });
      card.setPosition(i === 0 ? -87 : 87, 186);
      createLabel({ text: title, fontSize: 11, color: THEME.textWeak, width: 155, parent: card }).setPosition(0, 15);
      createLabel({
        text: value < 0 ? `-${moneyText(Math.abs(value))}` : moneyText(value),
        fontSize: 15,
        bold: true,
        color,
        width: 155,
        parent: card,
      }).setPosition(0, -10);
    });

    // 时间控制单独成区：暂停/1×/2×/5× 就地更新，不重建整页
    this.renderTimeControl(parent, 126);

    // CEO 与团队
    const ceoCard = createRect({ width: 343, height: 56, color: Color.WHITE, radius: 8, parent: parent });
    ceoCard.setPosition(0, 62);
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

    // 业务资产 / 产能 / 需求 / 报告入口
    const actionCard = createRect({ width: 343, height: 124, color: Color.WHITE, radius: 8, parent: parent });
    actionCard.setPosition(0, -22);
    createLabel({
      text: '业务资产与产能',
      fontSize: 13,
      bold: true,
      align: 'left',
      width: 320,
      parent: actionCard,
    }).setPosition(-9, 48);
    createLabel({
      text: `业务资产 ${moneyText(vm.businessAssetBookYuan)} · 产能加成 +${(vm.capacityCoeffBps - 10_000) / 100}%（上限 +30%）`,
      fontSize: 12,
      align: 'left',
      width: 320,
      parent: actionCard,
    }).setPosition(-9, 26);
    createLabel({
      text: `当月产能 ${moneyText(vm.monthlyCapacityYuan)} · 当月需求 ${moneyText(vm.monthlyPotentialOrderYuan)}`,
      fontSize: 11,
      color: THEME.textWeak,
      align: 'left',
      width: 320,
      parent: actionCard,
    }).setPosition(-9, 6);
    createLabel({
      text: vm.idleRisk
        ? '需求不足：产能已高于当月需求，继续扩产可能闲置'
        : '需求可覆盖当前产能，扩产前可再评估',
      fontSize: 11,
      color: vm.idleRisk ? THEME.danger : THEME.textWeak,
      align: 'left',
      width: 320,
      parent: actionCard,
    }).setPosition(-9, -14);
    createButton({
      text: '扩大产能（1万起）',
      width: 158,
      height: 44,
      fontSize: 13,
      color: THEME.secondary,
      parent: actionCard,
      onClick: () => this.renderInvestDialog(),
    }).setPosition(-83, -44);
    createButton({
      text: '年度报告',
      width: 158,
      height: 44,
      fontSize: 13,
      color: Color.WHITE,
      textColor: THEME.primary,
      parent: actionCard,
      onClick: () => this.renderAnnualReport(),
    }).setPosition(83, -44);

    // 盈利目标与现金风险（口径来自领域 assessRisk）
    const goalCard = createRect({ width: 343, height: 76, color: Color.WHITE, radius: 8, parent: parent });
    goalCard.setPosition(0, -126);
    createLabel({
      text: vm.target3YearsAchieved
        ? '已达成连续 3 年盈利目标，可继续自由经营'
        : `连续盈利目标：${vm.consecutiveProfitableYears}/3 年`,
      fontSize: 13,
      bold: true,
      color: vm.target3YearsAchieved ? THEME.profit : THEME.text,
      width: 320,
      parent: goalCard,
    }).setPosition(0, 18);
    createLabel({
      text: vm.risk.level === 'WARNING'
        ? `现金预警：当前现金低于未来 6 个月刚性费用 ${moneyText(vm.risk.sixMonthNeed)}`
        : `现金可覆盖未来 6 个月刚性费用 ${moneyText(vm.risk.sixMonthNeed)}`,
      fontSize: 11,
      color: vm.risk.level === 'WARNING' ? THEME.danger : THEME.textWeak,
      width: 320,
      lineHeight: 16,
      parent: goalCard,
    }).setPosition(0, -8);

    // 新手引导 TUT-04/05：看板预览态（暂停）讲解三指标，确认后开始经营
    if (s.phase === 'TUTORIAL_DASHBOARD') {
      this.renderStartOperatingBubble();
    }
  }

  /** R28：公司完整档案（长名不被顶部栏裁切影响，完整名称在此查看）。 */
  private renderCompanyDetail(): void {
    const s = this.state();
    const company = s.company;
    const vm = this.facade.getCompanyOverview();
    if (!company || !vm) return;
    const handle = openScrollableDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '公司档案',
      width: 336,
      desiredBodyHeight: 360,
    });
    const body = handle.body;
    const innerWidth = 336 - 40;
    createLabel({
      text: company.name,
      fontSize: 16,
      bold: true,
      width: innerWidth,
      align: 'left',
      parent: body,
    });
    createLabel({
      text: `${INDUSTRY_LABELS[company.industry]} · 创业于第 ${company.foundedYear} 年 · 当前第 ${s.gameYear} 年第 ${s.gameMonth} 月`,
      fontSize: 12,
      color: THEME.textWeak,
      width: innerWidth,
      lineHeight: 20,
      align: 'left',
      parent: body,
    });
    const totalAssets = vm.cashYuan + vm.businessAssetBookYuan;
    const rows: Array<[string, string]> = [
      ['当前可用现金', moneyText(vm.cashYuan)],
      ['业务资产账面', moneyText(vm.businessAssetBookYuan)],
      ['总资产（现金+资产）', moneyText(totalAssets)],
      ['初始资本 / 实收资本', `${moneyText(company.initialCapitalYuan)} / ${moneyText(company.paidInCapitalYuan)}`],
      ['本月产能 / 本月需求', `${moneyText(vm.monthlyCapacityYuan)} / ${moneyText(vm.monthlyPotentialOrderYuan)}`],
      ['团队规模', `${s.employees.length} 名员工 · ${s.departments.length} 个部门`],
      ['CEO', `${s.ceo?.name ?? ''}（商业 ${s.ceo?.businessSkill} / 管理 ${s.ceo?.managementSkill} / 财务 ${s.ceo?.financeSkill}）`],
    ];
    for (const [label, value] of rows) {
      const row = new Node('DetailRow');
      row.parent = body;
      row.addComponent(UITransform).setContentSize(new Size(innerWidth, 30));
      createLabel({
        text: label,
        fontSize: 12,
        color: THEME.textWeak,
        align: 'left',
        width: 132,
        parent: row,
      }).setPosition(-75, 0);
      createLabel({
        text: value,
        fontSize: 12,
        align: 'right',
        width: 158,
        parent: row,
      }).setPosition(71, 0);
    }
    createLabel({
      text: '提示：顶部栏只显示单行公司名，完整名称以本页为准。',
      fontSize: 11,
      color: THEME.textWeak,
      width: innerWidth,
      parent: body,
    });
    createButton({
      text: '关闭',
      width: 240,
      height: 46,
      parent: handle.footer,
      onClick: () => handle.close(),
    }).setPosition(0, 0);
  }

  /** TUT-04 三指标 + TUT-05 开始经营合并引导：确认即启动时钟；可跳过教学（TC-055）。 */
  private renderStartOperatingBubble(): void {
    const overlay = this.modalOverlay(true);
    createRect({
      width: 308,
      height: 292,
      color: new Color(39, 50, 68, 245),
      radius: 12,
      parent: overlay,
    }).setPosition(0, 0);
    createLabel({ text: '新手提示', fontSize: 15, bold: true, color: Color.WHITE, parent: overlay }).setPosition(
      0,
      112,
    );
    createLabel({
      text: '营收是卖出去多少；利润才是扣掉成本后赚的钱。\n\n公司会自动经营，你可以暂停或加速时间。',
      fontSize: 14,
      color: Color.WHITE,
      width: 264,
      lineHeight: 22,
      parent: overlay,
    }).setPosition(0, 38);
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
    }).setPosition(0, -64);
    // TC-055：可跳过教学浮层，但首聘 2 人的约束由领域层强制（不跳过必要业务）
    createButton({
      text: '跳过教学',
      width: 168,
      height: 42,
      fontSize: 13,
      color: new Color(238, 241, 247),
      textColor: THEME.text,
      parent: overlay,
      onClick: () => {
        overlay.destroy();
        void this.skipTutorial();
      },
    }).setPosition(0, -118);
  }

  /** 跳过教学浮层：进入经营但保持暂停，由玩家自行按开始（TC-055）。 */
  private async skipTutorial(): Promise<void> {
    const s = this.state();
    const result = await this.facade.skipTutorial({
      commandId: nextCommandId('skip-tut'),
      expectedRunId: s.runId,
    });
    if (!result.ok) {
      this.toast(result.displayMessage);
      return;
    }
    this.toast('已跳过教学，可在「时间」栏手动开始经营');
    this.render();
  }

  private renderTimeControl(parent: Node, centerY: number): void {
    const s = this.state();
    const wrap = createRect({ width: 343, height: 56, color: Color.WHITE, radius: 8, parent });
    wrap.setPosition(0, centerY);
    createLabel({ text: '时间', fontSize: 12, color: THEME.textWeak, parent: wrap }).setPosition(-140, 0);
    const speeds: Array<[string, GameSpeed]> = [
      ['暂停', 0],
      ['1×', 1],
      ['2×', 2],
      ['5×', 5],
    ];
    this.speedButtons = [];
    speeds.forEach(([label, speed], i) => {
      const active = s.speed === speed;
      const node = createButton({
        text: label,
        width: 52,
        height: 44,
        fontSize: 13,
        color: active ? THEME.primary : new Color(238, 241, 247),
        textColor: active ? Color.WHITE : THEME.textWeak,
        parent: wrap,
        onClick: () => void this.onSetSpeed(speed),
      });
      node.setPosition(-66 + i * 60, 0);
      this.speedButtons.push({ node, speed });
    });
  }

  /** R28：倍速切换成功后只就地重绘按钮，不重建整页（滚动位置与弹窗都保留）。 */
  private async onSetSpeed(speed: GameSpeed): Promise<void> {
    const s = this.state();
    if (s.speed === speed) {
      this.toast(this.speedLabel(speed));
      return;
    }
    const r = await this.facade.setSpeed(speed, { commandId: nextCommandId('speed'), expectedRunId: s.runId });
    if (!r.ok) {
      this.toast(r.displayMessage);
      return;
    }
    audioManager.speedChange();
    for (const btn of this.speedButtons) {
      this.paintSpeedButton(btn.node, btn.speed === speed);
    }
    this.toast(`时间已切换：${this.speedLabel(speed)}`);
  }

  private speedLabel(speed: GameSpeed): string {
    return speed === 0 ? '暂停' : `${speed}×`;
  }

  private paintSpeedButton(node: Node, active: boolean): void {
    const tr = node.getComponent(UITransform);
    const g = node.getComponent(Graphics);
    if (tr && g) {
      g.clear();
      g.fillColor = active ? THEME.primary : new Color(238, 241, 247);
      g.roundRect(-tr.width / 2, -tr.height / 2, tr.width, tr.height, 8);
      g.fill();
    }
    const label = node.getComponentInChildren(Label);
    if (label) label.color = active ? Color.WHITE : THEME.textWeak;
  }

  // ---------------------------------------------------------------- 部门页

  /**
   * R29：部门页。数据全部来自 GameFacade.getDepartmentOverview（纯计算），
   * 卡片只做排版；历史归因不可核时明确写“当月估算”，不冒充已实现收益。
   */
  private renderDepartmentTab(parent: Node): void {
    const s = this.state();
    const vm = this.facade.getDepartmentOverview();
    if (!vm) return;
    createLabel({ text: '部门', fontSize: 22, bold: true, color: THEME.text, parent: parent }).setPosition(0, 344);

    // 经营方针：按钮与说明分组，说明在上、按钮在下
    createRect({ width: 343, height: 92, color: Color.WHITE, radius: 8, parent: parent }).setPosition(0, 282);
    createLabel({
      text: `自动经营方针：${POLICY_META[s.policy].name}（${POLICY_META[s.policy].desc}）`,
      fontSize: 12,
      color: THEME.textWeak,
      width: 320,
      parent: parent,
    }).setPosition(0, 312);
    (['GROWTH', 'STEADY', 'PROFIT'] as Policy[]).forEach((p, i) => {
      createButton({
        text: POLICY_META[p].name,
        width: 88,
        height: 44,
        fontSize: 13,
        color: s.policy === p ? THEME.primary : THEME.divider,
        textColor: s.policy === p ? Color.WHITE : THEME.text,
        parent: parent,
        onClick: () => void this.onSetPolicy(p),
      }).setPosition(-100 + i * 100, 268);
    });

    // 自动预算入口：门槛/安全线/可支配余量（真实查询）
    createRect({ width: 343, height: 56, color: Color.WHITE, radius: 8, parent: parent }).setPosition(0, 200);
    createLabel({
      text: `自动预算｜${POLICY_META[vm.autoBudget.policy].name}：ROI≥${(vm.autoBudget.roiThresholdBps / 10_000).toFixed(1)}`
        + `｜保留 ${vm.autoBudget.cashReserveMonths} 个月刚性费用｜可支配 ${compactMoney(vm.autoBudget.spendableYuan)}`,
      fontSize: 12,
      color: vm.autoBudget.spendableYuan > 0 ? THEME.textWeak : THEME.warning,
      width: 232,
      lineHeight: 17,
      parent: parent,
    }).setPosition(-48, 200);
    createButton({
      text: '预览',
      width: 76,
      height: 44,
      fontSize: 13,
      parent: parent,
      onClick: () => this.openAutoBudgetDialog(),
    }).setPosition(118, 200);

    // 归因说明：历史账本无逐部门归因，数字只代表当月估算
    createLabel({
      text: '贡献为「按当前团队 + 当月预计收入」的估算；月账只存净费用、未按部门留存归因，故不展示历史“已实现收益”。',
      fontSize: 12,
      color: THEME.textWeak,
      width: 343,
      lineHeight: 17,
      parent: parent,
    }).setPosition(0, 150);

    // 已建部门卡片（主营 + 支持部门）
    let y = 40;
    const ordered = [
      ...vm.departments.filter((d) => d.type === 'BUSINESS'),
      ...vm.departments.filter((d) => d.type !== 'BUSINESS'),
    ];
    for (const deptVm of ordered) {
      this.renderDeptCard(parent, s, deptVm, y);
      y -= 166;
    }
    for (const u of vm.uncreated) {
      this.renderUncreatedDept(parent, u, y);
      y -= 100;
    }
  }

  private renderDeptCard(parent: Node, s: GameState, deptVm: DepartmentVM, y: number): void {
    const isBiz = deptVm.type === 'BUSINESS';
    const name = isBiz ? '主营业务部' : SUPPORT_DEPT_META[deptVm.type as SupportDeptType].name;
    const effectText = isBiz
      ? `收入覆盖 ${percentText(deptVm.effectBps)}（收入/产能）`
      : deptVm.headcount === 0
        ? '尚未配置人员：无部门效益'
        : `系数 ${percentText(deptVm.effectBps)}｜${VALUE_KIND_TEXT[deptVm.valueKind]}`;
    const valueText = isBiz
      ? `当月主营毛利 ${compactMoney(deptVm.estimatedMonthlyValueYuan)}`
      : `估算${VALUE_KIND_TEXT[deptVm.valueKind]} ${compactMoney(deptVm.estimatedMonthlyValueYuan)}`;

    createRect({ width: 343, height: 156, color: Color.WHITE, radius: 8, parent: parent }).setPosition(0, y);
    createLabel({ text: name, fontSize: 15, bold: true, width: 214, align: 'left', parent: parent }).setPosition(-54, y + 54);
    createLabel({
      text: deptVm.staffingMode === 'AUTO' ? '自动编制' : '手动锁定',
      fontSize: 12,
      color: deptVm.staffingMode === 'AUTO' ? THEME.secondary : THEME.textWeak,
      width: 74,
      align: 'right',
      parent: parent,
    }).setPosition(124, y + 54);
    createLabel({
      text: `在岗 ${deptVm.headcount} 人｜月薪合计 ${compactMoney(deptVm.monthlyPayrollYuan)}`,
      fontSize: 12,
      color: deptVm.headcount === 0 && !isBiz ? THEME.warning : THEME.text,
      width: 311,
      align: 'left',
      parent: parent,
    }).setPosition(-16, y + 30);
    createLabel({
      text: effectText,
      fontSize: 12,
      color: deptVm.headcount === 0 && !isBiz ? THEME.warning : THEME.textWeak,
      width: 311,
      align: 'left',
      parent: parent,
    }).setPosition(-16, y + 6);
    createLabel({
      text: `${valueText}｜净贡献 ${compactMoney(deptVm.estimatedNetContributionYuan)}`,
      fontSize: 12,
      color: deptVm.estimatedNetContributionYuan >= 0 ? THEME.profit : THEME.danger,
      width: 311,
      align: 'left',
      parent: parent,
    }).setPosition(-16, y - 18);

    // 操作行：编制 / 招聘 / 详情（间距独立，不越卡）
    const dept = s.departments.find((d) => d.deptId === deptVm.deptId);
    if (!dept) return;
    createButton({
      text: deptVm.staffingMode === 'AUTO' ? '编制 自动' : '编制 手动',
      width: 94,
      height: 44,
      fontSize: 12,
      color: deptVm.staffingMode === 'AUTO' ? THEME.secondary : THEME.divider,
      textColor: deptVm.staffingMode === 'AUTO' ? Color.WHITE : THEME.text,
      parent: parent,
      onClick: () => void this.onToggleStaffing(dept),
    }).setPosition(-105, y - 52);
    createButton({
      text: '招聘',
      width: 76,
      height: 44,
      fontSize: 12,
      parent: parent,
      onClick: () => this.openHireForDept(deptVm.deptId),
    }).setPosition(-8, y - 52);
    createButton({
      text: '详情',
      width: 76,
      height: 44,
      fontSize: 12,
      color: Color.WHITE,
      textColor: THEME.text,
      parent: parent,
      onClick: () => this.openDeptDetail(deptVm.deptId),
    }).setPosition(76, y - 52);
  }

  private renderUncreatedDept(parent: Node, u: UncreatedDeptVM, y: number): void {
    const meta = SUPPORT_DEPT_META[u.type];
    createRect({ width: 343, height: 92, color: Color.WHITE, radius: 8, parent: parent }).setPosition(0, y);
    createLabel({ text: meta.name, fontSize: 14, bold: true, width: 200, align: 'left', parent: parent }).setPosition(-60, y + 28);
    createLabel({
      text: `${meta.desc}｜设立费 ${moneyText(u.feeYuan)}｜建后余额 ${compactMoney(u.cashAfterYuan)}`,
      fontSize: 12,
      color: u.affordable ? THEME.textWeak : THEME.danger,
      width: 214,
      align: 'left',
      parent: parent,
    }).setPosition(-53, y + 4);
    createLabel({
      text: u.affordable ? '默认手动编制，0 员工无部门效益' : '现金不足，无法设立',
      fontSize: 12,
      color: u.affordable ? THEME.textWeak : THEME.danger,
      width: 214,
      align: 'left',
      parent: parent,
    }).setPosition(-53, y - 20);
    createButton({
      text: u.affordable ? '创建' : '余额不足',
      width: 80,
      height: 44,
      fontSize: 12,
      parent: parent,
      disabled: !u.affordable,
      onClick: () => this.confirmCreateDept(u.type),
    }).setPosition(110, y);
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
    else {
      this.render();
      this.toast(next === 'AUTO' ? '已切为自动编制：仅在 ROI 达标且现金安全时自动招人' : '已切为手动锁定：自动决策不再增删本部门人员');
    }
  }

  /** 自动预算预览：门槛、安全线、本年自动招聘进度与硬性约束（只读）。 */
  private openAutoBudgetDialog(): void {
    const vm = this.facade.getDepartmentOverview();
    if (!vm) return;
    const b = vm.autoBudget;
    const handle = openScrollableDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '自动经营预算预览',
      width: 320,
      desiredBodyHeight: 320,
    });
    const body = handle.body;
    const innerWidth = 288;
    const rows: Array<[string, string]> = [
      ['当前方针', `${POLICY_META[b.policy].name}（${POLICY_META[b.policy].desc}）`],
      ['自动招聘门槛', `预计 12 个月贡献 ≥ 12 个月工资+招聘费 × ${(b.roiThresholdBps / 10_000).toFixed(2)}`],
      ['现金安全线', `需保留 ${b.cashReserveMonths} 个月刚性费用 ${moneyText(b.reserveRequiredYuan)}`],
      ['当前现金', moneyText(b.cashYuan)],
      ['可支配余量', `${moneyText(b.spendableYuan)}${b.spendableYuan <= 0 ? '（低于安全线，自动招聘将被冻结）' : ''}`],
      ['AUTO 编制部门', `${b.autoDeptCount} 个（手动锁定部门不参与自动招聘）`],
      ['本年自动招聘', `${b.autoHiresThisYear} / ${b.maxAutoHiresPerYear} 人（每月最多 ${b.maxAutoHiresPerMonth} 人）`],
    ];
    for (const [k, v] of rows) {
      createLabel({
        text: `${k}：${v}`,
        fontSize: 12,
        color: THEME.text,
        width: innerWidth,
        lineHeight: 17,
        align: 'left',
        parent: body,
      });
    }
    createLabel({
      text: '硬性约束：系统不会自动裁员、不会自动建部门、不会自动扩产；自动录用仅发生在 AUTO 编制部门，且受 ROI 与现金安全线双重限制。',
      fontSize: 12,
      color: THEME.textWeak,
      width: innerWidth,
      lineHeight: 17,
      align: 'left',
      parent: body,
    });
    createButton({
      text: '关闭',
      width: 200,
      height: 46,
      fontSize: 14,
      color: Color.WHITE,
      textColor: THEME.text,
      parent: handle.footer,
      onClick: () => handle.close(),
    }).setPosition(0, 0);
  }

  /** 部门详情：效益口径、成本来源、历史归因限制、建议人数与编制模式。 */
  private openDeptDetail(deptId: string): void {
    const s = this.state();
    const vm = this.facade.getDepartmentOverview();
    const dept = s.departments.find((d) => d.deptId === deptId);
    const dv = vm?.departments.find((d) => d.deptId === deptId);
    if (!dept || !dv || !vm) return;
    const isBiz = dv.type === 'BUSINESS';
    const name = isBiz ? '主营业务部' : SUPPORT_DEPT_META[dv.type as SupportDeptType].name;
    const handle = openScrollableDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: `${name} · 详情`,
      width: 320,
      desiredBodyHeight: 430,
    });
    const body = handle.body;
    const innerWidth = 288;
    const addLine = (text: string, color = THEME.text, bold = false): void => {
      createLabel({
        text,
        fontSize: 12,
        bold,
        color,
        width: innerWidth,
        lineHeight: 17,
        align: 'left',
        parent: body,
      });
    };

    addLine(
      isBiz
        ? `职责：交付主营产能。当月产能 ${moneyText(vm.monthlyCapacityYuan)}，当月需求 ${moneyText(vm.monthlyPotentialOrderYuan)}，预计收入 ${moneyText(vm.projectedRevenueYuan)}。`
        : `职责：${SUPPORT_DEPT_META[dv.type as SupportDeptType].desc}。${dv.headcount === 0 ? '当前 0 人，效益严格为 0。' : ''}`,
      THEME.textWeak,
    );
    addLine(`在岗：${dv.headcount} 人｜月薪合计 ${moneyText(dv.monthlyPayrollYuan)}`);
    addLine(
      isBiz
        ? `收入覆盖率：${percentText(dv.effectBps)}（预计收入 / 当月产能）`
        : `部门系数：${percentText(dv.effectBps)}（${DEPT_EFFECT_TEXT[dv.type as SupportDeptType]}）`,
    );
    addLine(`当月估算效益：${moneyText(dv.estimatedMonthlyValueYuan)}（${VALUE_KIND_TEXT[dv.valueKind]}）`, THEME.profit);
    addLine(`部门月薪成本：${moneyText(dv.monthlyPayrollYuan)}；估算净贡献：${moneyText(dv.estimatedNetContributionYuan)}`,
      dv.estimatedNetContributionYuan >= 0 ? THEME.profit : THEME.danger);
    if (!isBiz) {
      addLine(`设立费：${moneyText(vm.setupFeeYuan)}（${dv.setupPaid ? '确认建部时已一次性支付' : '尚未支付'}）`, THEME.textWeak);
    }
    addLine(
      '归因限制：月账只保存净费用，未按部门留存“历史节省”；所以本页数字均为当月估算，不代表历史已实现收益，也不会重复计入利润。',
      THEME.textWeak,
    );
    addLine(
      `编制模式：${dept.staffingMode === 'AUTO' ? '自动（自动招聘受 ROI/安全线约束）' : '手动锁定（自动决策不增删人员）'}。切换编制不产生费用，也永不自动裁员。`,
      THEME.textWeak,
    );

    // 建议人数：仅记录目标，减少目标不裁员、不退费
    const targetRow = new Node('TargetRow');
    targetRow.parent = body;
    targetRow.addComponent(UITransform).setContentSize(new Size(innerWidth, 44));
    createLabel({
      text: `建议编制人数：${dv.targetCount} 人（仅建议，不自动裁员）`,
      fontSize: 12,
      width: 170,
      align: 'left',
      parent: targetRow,
    }).setPosition(-55, 0);
    createButton({
      text: '－',
      width: 44,
      height: 44,
      fontSize: 14,
      color: THEME.divider,
      textColor: THEME.text,
      parent: targetRow,
      onClick: () => void this.changeTarget(deptId, -1, handle),
    }).setPosition(70, 0);
    createButton({
      text: '＋',
      width: 44,
      height: 44,
      fontSize: 14,
      parent: targetRow,
      onClick: () => void this.changeTarget(deptId, 1, handle),
    }).setPosition(118, 0);

    createButton({
      text: dept.staffingMode === 'AUTO' ? '切为手动锁定' : '切为自动编制',
      width: 136,
      height: 46,
      fontSize: 12,
      color: THEME.divider,
      textColor: THEME.text,
      parent: handle.footer,
      onClick: () => {
        void this.onToggleStaffing(dept).then(() => {
          if (!handle.closed) handle.close();
        });
      },
    }).setPosition(-72, 0);
    createButton({
      text: '关闭',
      width: 136,
      height: 46,
      fontSize: 14,
      parent: handle.footer,
      onClick: () => handle.close(),
    }).setPosition(72, 0);
  }

  private async changeTarget(deptId: string, delta: number, handle: DialogHandle): Promise<void> {
    const vm = this.facade.getDepartmentOverview();
    const dv = vm?.departments.find((d) => d.deptId === deptId);
    if (!dv) return;
    const target = Math.max(0, Math.min(50, dv.targetCount + delta));
    if (target === dv.targetCount) return;
    const s = this.state();
    const r = await this.facade.setTargetCount(deptId, target, {
      commandId: nextCommandId('target'),
      expectedRunId: s.runId,
    });
    if (!r.ok) {
      this.toast(r.displayMessage);
      return;
    }
    if (!handle.closed) handle.close();
    this.openDeptDetail(deptId);
  }

  private confirmCreateDept(type: SupportDeptType): void {
    const p = this.facade.previewCreateDepartment(type);
    if (p.alreadyExists) {
      this.toast(`${SUPPORT_DEPT_META[type].name}已经创建`);
      this.render();
      return;
    }
    const cash = this.state().company?.cashYuan ?? 0;
    const commandId = nextCommandId('dept');
    const originRunId = this.state().runId;
    openConfirmDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: `创建${SUPPORT_DEPT_META[type].name}？`,
      message:
        `${SUPPORT_DEPT_META[type].desc}\n` +
        `设立费：${moneyText(p.feeYuan)}（确认即扣现金）\n` +
        `现金：${moneyText(cash)} → ${moneyText(p.cashAfterYuan)}\n` +
        `创建后默认手动编制，不自动招人；0 员工无部门效益。`,
      width: 320,
      confirmText: `支付 ${moneyText(p.feeYuan)} 创建`,
      busyText: '创建中…',
      confirmEnabled: p.cashAfterYuan >= 0,
      onConfirm: async (dialog) => {
        const r = await this.facade.createDepartment(type, { commandId, expectedRunId: originRunId });
        if (!r.ok) {
          if (r.code === 'RUN_CHANGED') {
            dialog.succeed();
            this.toast(r.displayMessage);
            return;
          }
          dialog.fail(r.displayMessage);
          return;
        }
        dialog.succeed();
        audioManager.createDepartment();
        if (this.state().runId === originRunId) {
          this.render();
          this.toast(`已创建${SUPPORT_DEPT_META[type].name}，支付 ${moneyText(r.payload.feePaidYuan)}`);
        }
      },
    });
  }

  // ---------------------------------------------------------------- 人才页

  private deptLabel(type: DeptType): string {
    return type === 'BUSINESS' ? '主营业务部' : SUPPORT_DEPT_META[type].name;
  }

  private renderTalentTab(parent: Node): void {
    this.talentPool = null;
    const ov = this.facade.getTalentOverview(this.talentFilterKey);
    if (!ov) return;
    createLabel({ text: '员工', fontSize: 22, bold: true, color: THEME.text, parent: parent }).setPosition(0, 344);
    createLabel({
      text:
        `在职 ${ov.headcount} 人｜月薪合计 ${moneyText(ov.monthlyPayrollYuan)}` +
        (this.talentFilterKey === 'ALL' ? '' : `（全公司 ${ov.allHeadcount} 人｜${moneyText(ov.allMonthlyPayrollYuan)}）`),
      fontSize: 12,
      color: THEME.textWeak,
      width: 343,
      parent: parent,
    }).setPosition(0, 316);

    // 部门筛选：最多 6 个部门 + 全部（每行 4 个，热区 44）
    ov.filters.forEach((f, i) => {
      const label = f.deptType === null ? '全部' : this.deptLabel(f.deptType).replace('部', '');
      createButton({
        text: `${label} ${f.headcount}`,
        width: 80,
        fontSize: 12,
        color: f.key === this.talentFilterKey ? THEME.primary : THEME.secondary,
        parent: parent,
        onClick: () => {
          this.talentFilterKey = f.key;
          this.render();
        },
      }).setPosition(-126 + (i % 4) * 84, 286 - Math.floor(i / 4) * 48);
    });

    const cardHeight = 108;
    const step = 116;
    // Keep the first card below every filter row, with the same 8-unit gap
    // used between controls. The filter grid is authored at y=286 in 48-unit
    // row steps and each button has a 44-unit hit target.
    const filterRows = Math.ceil(ov.filters.length / 4);
    const filterBottom = 286 - Math.max(0, filterRows - 1) * 48 - 22;
    const listTop = filterBottom - 8 - cardHeight / 2;
    if (ov.rows.length === 0) {
      createLabel({
        text: this.talentFilterKey === 'ALL' ? '暂无在职员工' : '该部门暂无员工',
        fontSize: 14,
        color: THEME.textWeak,
        width: 343,
        parent: parent,
      }).setPosition(0, listTop - 20);
    }

    // 复用卡片池：只渲染可视窗口内约 12 张卡，滚动时更新内容与位置
    const cards: Array<{ node: Node; name: Node; meta: Node; pay: Node; state: Node; index: number }> = [];
    for (let i = 0; i < 12; i += 1) {
      const card = createRect({ width: 343, height: cardHeight, color: Color.WHITE, radius: 8, parent });
      card.active = false;
      const name = createLabel({ text: '', fontSize: 15, bold: true, width: 210, align: 'left', parent: card });
      name.setPosition(-55, 32);
      const meta = createLabel({ text: '', fontSize: 12, color: THEME.textWeak, width: 210, align: 'left', parent: card });
      meta.setPosition(-55, 12);
      const pay = createLabel({ text: '', fontSize: 12, color: THEME.primary, width: 210, align: 'left', parent: card });
      pay.setPosition(-55, -8);
      const state = createLabel({ text: '', fontSize: 12, color: THEME.textWeak, width: 210, align: 'left', parent: card });
      state.setPosition(-55, -30);
      const entry = { node: card, name, meta, pay, state, index: -1 };
      cards.push(entry);
      createButton({
        text: '详情',
        width: 56,
        fontSize: 12,
        parent: card,
        onClick: () => {
          const row = this.talentPool?.rows[entry.index];
          if (row) this.openEmployeeDetail(row.employeeId);
        },
      }).setPosition(132, 0);
    }
    // 占位撑高：让内容高覆盖整份列表，滚动条可到最后一位员工
    const spacer = new Node('TalentSpacer');
    spacer.parent = parent;
    spacer.addComponent(UITransform).setContentSize(new Size(343, 1));
    // Extra tail room lets the last card scroll above the fixed footer with a
    // full hit target, including on compact 360x640 screens.
    spacer.setPosition(0, listTop - Math.max(0, ov.rows.length - 1) * step - cardHeight / 2 - 40);

    this.talentPool = { rows: ov.rows, listTop, step, cards };
    this.updateTalentWindow();
  }

  /** R30：按滚动位置复用卡片（不销毁重建、不串员工）。 */
  private updateTalentWindow(): void {
    const shell = this.shell;
    const pool = this.talentPool;
    if (!shell || !pool || this.activeTab !== 'TALENT') return;
    const contentTr = shell.content.getComponent(UITransform);
    const viewTr = shell.viewNode.getComponent(UITransform);
    if (!contentTr || !viewTr) return;
    const offset = shell.scrollView.getScrollOffset().y;
    const authoredTop = contentTr.height / 2 - offset - viewTr.height / 2 - shell.shift;
    const maxFirst = Math.max(0, pool.rows.length - pool.cards.length);
    const first = Math.min(
      maxFirst,
      Math.max(0, Math.floor((pool.listTop - authoredTop) / pool.step) - 1),
    );
    for (let k = 0; k < pool.cards.length; k += 1) {
      const card = pool.cards[k]!;
      const index = first + k;
      const row = pool.rows[index];
      card.index = index;
      card.node.active = !!row;
      if (!row) continue;
      card.node.setPosition(0, pool.listTop - index * pool.step + shell.shift);
      card.name.getComponent(Label)!.string = `${row.name}（${this.deptLabel(row.deptType).replace('部', '')}）`;
      card.meta.getComponent(Label)!.string = `能力 ${row.skill}｜潜力 ${row.potential}｜协作 ${row.teamwork}`;
      card.pay.getComponent(Label)!.string = `月薪 ${moneyText(row.salaryMonthlyYuan)}｜入职 ${row.tenureMonths} 个月`;
      if (row.status === 'PENDING_DISMISSAL') {
        card.state.getComponent(Label)!.string = '次月离岗';
        card.state.getComponent(Label)!.color = THEME.danger;
      } else if (row.pendingDeptId) {
        const dept = this.state().departments.find((d) => d.deptId === row.pendingDeptId);
        // Keep the fixed-height virtual row readable. The detail view retains
        // the full current-month payroll explanation.
        card.state.getComponent(Label)!.string = `下月调岗→${dept ? this.deptLabel(dept.type).replace('部', '') : '—'}`;
        card.state.getComponent(Label)!.color = THEME.warning;
      } else {
        card.state.getComponent(Label)!.string = '在职';
        card.state.getComponent(Label)!.color = THEME.textWeak;
      }
    }
  }

  private openEmployeeDetail(employeeId: string): void {
    const s = this.state();
    const emp = s.employees.find((e) => e.employeeId === employeeId);
    if (!emp) return;
    const dept = s.departments.find((d) => d.deptId === emp.departmentId);
    const deptName = dept ? this.deptLabel(dept.type) : '—';
    const monthIndex = (s.gameYear - 1) * 12 + (s.gameMonth - 1);
    const tenureMonths = Math.max(1, monthIndex - emp.hiredAtMonthIndex + 1);
    const hiredYear = Math.floor(emp.hiredAtMonthIndex / 12) + 1;
    const hiredMonth = (emp.hiredAtMonthIndex % 12) + 1;
    const pendingDept = emp.pendingDepartmentId
      ? s.departments.find((d) => d.deptId === emp.pendingDepartmentId)
      : null;

    const handle = openScrollableDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '员工详情',
      subtitle: emp.name,
      width: 330,
      desiredBodyHeight: 420,
    });
    const body = handle.body;
    const line = (text: string, color = THEME.text, bold = false, size = 13) => {
      createLabel({ text, fontSize: size, bold, color, width: 292, lineHeight: 22, align: 'left', parent: body });
    };
    line(`${deptName}｜月薪 ${moneyText(emp.salaryMonthlyYuan)}`, THEME.text, true, 15);
    line(`能力 ${emp.skill}｜潜力 ${emp.potential}｜协作 ${emp.teamwork}`);
    line(`入职 ${tenureMonths} 个月（第 ${hiredYear} 年 ${hiredMonth} 月入职）`);
    line(
      emp.status === 'PENDING_DISMISSAL'
        ? '状态：次月离岗（补偿已支付，本月仍计薪/计产能）'
        : pendingDept
          ? `状态：调岗下月生效 → ${this.deptLabel(pendingDept.type)}（当月仍按原部门计薪）`
          : '状态：在职',
      emp.status === 'PENDING_DISMISSAL' ? THEME.danger : pendingDept ? THEME.warning : THEME.textWeak,
    );
    line('调岗：下月生效，无招聘费/赔偿；当月不重复计工资与产能。', THEME.textWeak);
    line('裁员：仅玩家主动触发；补偿月数按在职年数计算，次月起停薪停产能，系统永不自动裁员。', THEME.textWeak);
    createButton({
      text: '调岗',
      width: 96,
      fontSize: 14,
      color: THEME.secondary,
      parent: handle.footer,
      onClick: () => {
        handle.close();
        const current = this.state().employees.find((e) => e.employeeId === employeeId);
        if (!current || current.status !== 'ACTIVE') {
          this.toast('该员工已进入离岗流程，不能调岗');
          return;
        }
        this.openTransfer(employeeId);
      },
    }).setPosition(-100, 0);
    createButton({
      text: '裁员',
      width: 96,
      fontSize: 14,
      color: THEME.danger,
      parent: handle.footer,
      onClick: () => {
        handle.close();
        const current = this.state().employees.find((e) => e.employeeId === employeeId);
        if (!current || current.status !== 'ACTIVE') {
          this.toast('该员工已进入离岗流程，不能重复裁员');
          return;
        }
        this.openLayoffConfirm(employeeId);
      },
    }).setPosition(0, 0);
    createButton({
      text: '关闭',
      width: 76,
      fontSize: 13,
      color: Color.WHITE,
      textColor: THEME.text,
      parent: handle.footer,
      onClick: () => handle.close(),
    }).setPosition(100, 0);
  }

  private openTransfer(employeeId: string): void {
    const s = this.state();
    const emp = s.employees.find((e) => e.employeeId === employeeId);
    if (!emp) return;
    const targets = this.facade.getTransferTargets(employeeId) ?? [];
    const handle = openScrollableDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '调岗目标',
      subtitle: `${emp.name}：下月生效，当月仍按原部门计薪`,
      width: 330,
      desiredBodyHeight: 380,
    });
    if (targets.length === 0) {
      createLabel({
        text: '没有可调往的部门。先到部门页建立支持部门，再回到这里调岗。',
        fontSize: 13,
        color: THEME.textWeak,
        width: 292,
        lineHeight: 22,
        align: 'left',
        parent: handle.body,
      });
    }
    for (const target of targets) {
      const impact = this.facade.getTransferImpact(employeeId, target.deptId);
      if (!impact) continue;
      createButton({
        text: `调入 ${this.deptLabel(target.type)}（${impact.toHeadcountBefore}→${impact.toHeadcountAfter} 人）`,
        width: 292,
        fontSize: 13,
        color: THEME.secondary,
        parent: handle.body,
        onClick: () => {
          handle.close();
          this.openTransferConfirm(employeeId, target.deptId);
        },
      });
    }
    createButton({
      text: '取消',
      width: 120,
      fontSize: 13,
      color: Color.WHITE,
      textColor: THEME.text,
      parent: handle.footer,
      onClick: () => handle.close(),
    }).setPosition(0, 0);
  }

  private openTransferConfirm(employeeId: string, toDeptId: string): void {
    const impact = this.facade.getTransferImpact(employeeId, toDeptId);
    if (!impact) {
      this.toast('该员工状态已变化，请重新打开详情');
      return;
    }
    const commandId = nextCommandId('transfer');
    const originRunId = this.state().runId;
    const capacityLine =
      impact.businessCapacityLossYuan === null
        ? ''
        : impact.businessCapacityLossYuan > 0
          ? `主营产能：次月起 -${moneyText(impact.businessCapacityLossYuan)}/月\n`
          : '主营产能：次月起不减少（产能仍受需求上限约束）\n';
    openConfirmDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '确认调岗？',
      message:
        `员工：${impact.name}（月薪 ${moneyText(impact.salaryMonthlyYuan)}）\n` +
        `原部门人数：${impact.fromHeadcountBefore} → ${impact.fromHeadcountAfter}\n` +
        `目标部门人数：${impact.toHeadcountBefore} → ${impact.toHeadcountAfter}\n` +
        `工资总额：${moneyText(impact.payrollBeforeYuan)}（同一员工只计一次）\n` +
        `生效：第 ${impact.effectiveGameYear} 年 ${impact.effectiveGameMonth} 月\n` +
        capacityLine,
      width: 312,
      desiredBodyHeight: 220,
      confirmText: '确认调岗（下月生效）',
      busyText: '处理中…',
      onConfirm: async (dialog) => {
        const r = await this.facade.transferEmployee(employeeId, toDeptId, {
          commandId,
          expectedRunId: originRunId,
        });
        if (!r.ok) {
          dialog.fail(r.displayMessage);
          return;
        }
        dialog.succeed();
        this.toast('已安排调岗，下月生效');
        if (this.state().runId === originRunId) this.render();
      },
    });
  }

  private openLayoffConfirm(employeeId: string): void {
    const pv = this.facade.previewLayoff(employeeId, Date.now());
    // token 与 commandId 在开框时固定：连点只产生一次补偿，超时须重新查看金额
    const token = this.facade.createLayoffToken(pv, Date.now());
    const commandId = nextCommandId('layoff');
    const originRunId = this.state().runId;
    const capacityLoss = this.facade.getLayoffCapacityLoss(employeeId) ?? 0;
    const insufficient = pv.cashAfterYuan < 0;
    openConfirmDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '确认裁员？',
      danger: true,
      message:
        `员工：${pv.name}\n任职：${pv.tenureYears} 年（${pv.tenureMonths} 个月）\n` +
        `月薪：${moneyText(pv.salaryMonthlyYuan)}\n补偿月数：${pv.severanceMonths} 个月\n\n` +
        `补偿金额：${moneyText(pv.severanceYuan)}（确认即支付）\n` +
        `当月主营产能：${capacityLoss > 0 ? `-${moneyText(capacityLoss)}/月` : '不涉及（非主营员工）'}\n` +
        `次年约节约工资：${moneyText(pv.nextYearSalarySavingYuan)}\n` +
        `裁后现金：${moneyText(pv.cashAfterYuan)}` +
        (insufficient ? '\n现金不足以支付补偿，请先回笼资金。' : ''),
      width: 312,
      desiredBodyHeight: 220,
      confirmEnabled: !insufficient,
      confirmText: `确认支付补偿 ${moneyText(pv.severanceYuan)}`,
      busyText: '处理中…',
      onConfirm: async (dialog) => {
        const r = await this.facade.confirmLayoff(token, { commandId, expectedRunId: originRunId });
        if (!r.ok) {
          if (r.code === 'CONFIRMATION_EXPIRED' || r.code === 'RUN_CHANGED') {
            dialog.succeed();
            this.toast(r.displayMessage);
            return;
          }
          dialog.fail(r.displayMessage);
          return;
        }
        dialog.succeed();
        this.toast(`已支付补偿 ${moneyText(r.payload.severancePaidYuan)}，次月离岗`);
        audioManager.layoff();
        if (this.state().runId === originRunId) this.render();
      },
    });
  }

  private openHireForDept(deptId: string): void {
    const offer = this.facade.getOffer(deptId);
    this.pendingOffer = offer;
    this.renderHireDialog(offer, deptId);
  }

  private renderHireDialog(offer: CandidateOffer, deptId: string): void {
    const s = this.state();
    const storedCouponId = s.adRewards?.couponIds[0];
    const couponId = isAdCouponAvailable(s, storedCouponId) ? storedCouponId : undefined;
    const overlay = this.modalOverlay();
    createRect({ width: 340, height: 470, color: Color.WHITE, radius: 12, parent: overlay }).setPosition(0, 0);
    createLabel({ text: '招聘候选人', fontSize: 18, bold: true, parent: overlay }).setPosition(0, 206);
    createLabel({ text: '招聘费=1个月月薪（HR已生效可折扣），次月到岗', fontSize: 10, color: THEME.textWeak, width: 300, parent: overlay }).setPosition(0, 186);

    offer.candidates.forEach((c, idx) => {
      const cardY = 150 - idx * 108;
      // R26：费用与可负担性一律取领域层 preview（含 HR 折扣），UI 不猜公式
      const pv = this.facade.previewHire({ offerId: offer.offerId, candidateId: c.candidateId, departmentId: deptId, ...(couponId ? { couponId } : {}) });
      const feeText = pv.ok ? moneyText(pv.payload.feeYuan) : moneyText(c.salaryMonthlyYuan);
      const affordable = pv.ok ? pv.payload.affordable : s.company!.cashYuan >= c.salaryMonthlyYuan;
      createRect({ width: 308, height: 98, color: THEME.bg, radius: 8, parent: overlay }).setPosition(0, cardY);
      const arch = c.archetype === 'A' ? '即战力' : c.archetype === 'B' ? '潜力股' : '经济型';
      createLabel({ text: `${c.name}（${arch}）`, fontSize: 14, bold: true, width: 180, align: 'left', parent: overlay }).setPosition(-56, cardY + 32);
      createLabel({ text: `能力 ${c.skill} 潜力 ${c.potential} 协作 ${c.teamwork}`, fontSize: 11, color: THEME.textWeak, width: 200, align: 'left', parent: overlay }).setPosition(-46, cardY + 12);
      createLabel({ text: `月薪 ${moneyText(c.salaryMonthlyYuan)}｜招聘费 ${feeText}${couponId ? '（券）' : ''}`, fontSize: 11, color: THEME.primary, width: 200, align: 'left', parent: overlay }).setPosition(-46, cardY - 8);
      createButton({
        text: '录用',
        width: 60,
        height: 38,
        fontSize: 13,
        parent: overlay,
        disabled: !affordable,
        onClick: () => {
          overlay.destroy();
          this.openHireConfirm(c.candidateId, deptId, { initial: false, offer, ...(couponId ? { couponId } : {}) });
        },
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
    if (this.adCoordinator && !couponId && this.facade.canRequestRewardedAd()) {
      createButton({
        text: '自愿看视频领免招聘费券',
        width: 224,
        height: 36,
        fontSize: 12,
        parent: overlay,
        onClick: () => { overlay.destroy(); void this.requestAdCoupon().then(() => this.renderHireDialog(this.pendingOffer ?? offer, deptId)); },
      }).setPosition(0, -158);
    }
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
    }).setPosition(-58, 315);
    createButton({
      text: '年限榜',
      width: 100,
      height: 38,
      fontSize: 14,
      color: this.rankMode === 'years' ? THEME.primary : THEME.divider,
      textColor: this.rankMode === 'years' ? Color.WHITE : THEME.text,
      parent,
      onClick: () => { this.rankMode = 'years'; this.render(); },
    }).setPosition(58, 315);

    if (this.leaderboardConfig?.enabled && this.leaderboardConsent) {
      createButton({ text: 'TapTap公开榜', width: 138, height: 36, fontSize: 12, parent,
        onClick: () => {
          const id = this.rankMode === 'assets' ? this.leaderboardConfig?.assetsBoardId : this.leaderboardConfig?.yearsBoardId;
          if (!id) { this.toast('真实榜单尚未配置'); return; }
          void new TapLeaderboardProvider().open(id).then((r) => { if (r.kind !== 'ok') this.toast('TapTap榜单暂不可用'); });
        } }).setPosition(0, 275);
    }

    const rows = this.rankMode === 'assets'
      ? this.facade.assetsLeaderboard()
      : this.facade.yearsLeaderboard();

    createLabel({
      text: '本地模拟企业，非真实联网排名',
      fontSize: 12,
      color: THEME.textWeak,
      parent,
    }).setPosition(0, 245);
    const playerRank = rows.findIndex((r) => r.isPlayer) + 1;
    const player = rows.find((r) => r.isPlayer);
    createLabel({
      text: player
        ? `我方 第 ${playerRank}/${rows.length} 名｜资产 ${moneyText(player.assetsYuan)}｜经营 ${player.yearsOperated} 年`
        : '创建公司后显示我方名次',
      fontSize: 12,
      color: player ? THEME.primary : THEME.textWeak,
      width: 245,
      parent,
    }).setPosition(-48, 220);
    if (player && playerRank > 0) {
      createButton({
        text: '定位我方',
        width: 92,
        fontSize: 12,
        parent,
        onClick: () => this.shell?.scrollView.scrollToOffset(new Vec2(0, Math.max(0, (playerRank - 1) * 52 - 120)), 0.25),
      }).setPosition(132, 192);
    }

    // Render the complete local table; the enclosing PageShell scrolls long lists.
    rows.forEach((row, i) => {
      const y = 150 - i * 52;
      createRect({
        width: 343,
        height: 46,
        color: row.isPlayer ? new Color(224, 236, 255) : Color.WHITE,
        radius: 6,
        parent,
      }).setPosition(0, y);
      createLabel({ text: `${i + 1}`, fontSize: 14, bold: true, width: 26, color: i < 3 ? THEME.warning : THEME.textWeak, parent }).setPosition(-153, y);
      createLabel({
        text: row.isPlayer ? `${row.name}（你）` : row.name,
        fontSize: 12,
        bold: row.isPlayer,
        width: 128,
        align: 'left',
        color: row.isPlayer ? THEME.primary : THEME.text,
        parent,
      }).setPosition(-43, y);
      const metric = this.rankMode === 'assets'
        ? moneyText(row.assetsYuan)
        : `${row.yearsOperated} 年`;
      createLabel({ text: metric, fontSize: 12, width: 80, align: 'right', color: THEME.text, parent }).setPosition(54, y);
      createButton({
        text: '详情',
        width: 44,
        fontSize: 12,
        parent,
        onClick: () => {
          const dialog = openScrollableDialog({
            overlay: this.modalOverlay(),
            viewportHeight: this.shellLayout().viewportHeight,
            title: row.isPlayer ? '我方排行详情' : '模拟企业排行详情',
            subtitle: `第 ${i + 1} 名`,
            width: 316,
            desiredBodyHeight: 220,
          });
          createLabel({ text: `企业：${row.name}`, fontSize: 14, color: THEME.text, width: 276, parent: dialog.body });
          createLabel({ text: `总资产：${moneyText(row.assetsYuan)}（现金 + 未折旧业务资产）`, fontSize: 13, color: THEME.text, width: 276, parent: dialog.body });
          createLabel({ text: `经营年限：${row.yearsOperated} 年`, fontSize: 13, color: THEME.text, width: 276, parent: dialog.body });
          createButton({ text: '关闭', width: 240, height: 46, parent: dialog.footer, onClick: () => dialog.close() }).setPosition(0, 0);
        },
      }).setPosition(140, y);
    });
  }

  /** R24：底部 Tab 锚定可视区底部（含底部 inset 抬升）；返回壳引用供几何重算。 */
  private renderBottomTabs(
    parent: Node,
    layout: ShellLayout,
  ): { root: Node; bg: Graphics; buttons: Node[] } {
    const tabs: Array<[TabId, string]> = [
      ['COMPANY', '公司'],
      ['DEPARTMENT', '部门'],
      ['TALENT', '人才'],
      ['RANK', '排行'],
    ];
    const footer = new Node('Footer');
    footer.parent = parent;
    footer.addComponent(UITransform).setContentSize(new Size(layout.contentWidth, layout.footerTotal));
    footer.setPosition(layout.footerShiftX, layout.footerBgY);
    // T04：挡住被滚动裁切内容的残余热区（拖动/点击底栏不再触到正文按钮）
    footer.addComponent(BlockInputEvents);

    const bgNode = new Node('FooterBg');
    bgNode.parent = footer;
    bgNode.addComponent(UITransform).setContentSize(new Size(layout.contentWidth, layout.footerTotal));
    const bg = bgNode.addComponent(Graphics);
    bg.fillColor = Color.WHITE;
    bg.rect(-layout.contentWidth / 2, -layout.footerTotal / 2, layout.contentWidth, layout.footerTotal);
    bg.fill();

    const buttons: Node[] = [];
    tabs.forEach(([id, label], i) => {
      const active = this.activeTab === id;
      const x = -141 + i * 94;
      const btn = createButton({
        text: label,
        width: 80,
        height: 56,
        fontSize: 13,
        color: new Color(0, 0, 0, 0),
        textColor: active ? THEME.primary : THEME.textWeak,
        parent: footer,
        onClick: () => {
          this.activeTab = id;
          this.render();
        },
      });
      btn.setPosition(x, layout.bottomInset / 2);
      buttons.push(btn);
    });
    return { root: footer, bg, buttons };
  }

  // ---------------------------------------------------------------- 扩产与年报

  /** R28：扩产预览全部走 GameFacade.previewInvest（真实现金/资产/产能/需求），不在此处自算。 */
  private renderInvestDialog(): void {
    const s = this.state();
    const handle = openScrollableDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '扩大主营业务产能',
      width: 336,
      desiredBodyHeight: 420,
    });
    const body = handle.body;
    const innerWidth = 336 - 40;
    createLabel({
      text: `可用现金 ${moneyText(s.company?.cashYuan ?? 0)}`,
      fontSize: 13,
      color: THEME.textWeak,
      width: innerWidth,
      align: 'left',
      parent: body,
    });
    createLabel({
      text: '每投入 1 万元，交付产能 +1.5%（封顶 +30%）。现金即时转为业务资产，不计当月利润，次年起按 10% 折旧。',
      fontSize: 11,
      color: THEME.textWeak,
      width: innerWidth,
      lineHeight: 16,
      align: 'left',
      parent: body,
    });

    const steps = [10_000, 50_000, 100_000];
    for (const amount of steps) {
      const pv = this.facade.previewInvest(amount);
      const p = pv.ok ? pv.payload : null;
      const row = createButton({
        text: '',
        width: innerWidth,
        height: 104,
        color: p?.valid ? new Color(246, 249, 253) : new Color(238, 241, 247),
        disabled: !p?.valid,
        parent: body,
        onClick: () => this.openInvestConfirm(amount),
      });
      createLabel({
        text: `投入 ${moneyText(amount)}`,
        fontSize: 14,
        bold: true,
        align: 'left',
        width: 150,
        parent: row,
      }).setPosition(-76, 32);
      if (p) {
        createLabel({
          text: `产能加成 +${(p.capacityCoeffBeforeBps - 10_000) / 100}% → +${(p.capacityCoeffAfterBps - 10_000) / 100}%`,
          fontSize: 11,
          color: THEME.textWeak,
          align: 'right',
          width: 148,
          parent: row,
        }).setPosition(74, 32);
        createLabel({
          text: `现金 ${moneyText(p.cashAfter)} · 业务资产 ${moneyText(p.assetBookAfter)}`,
          fontSize: 11,
          align: 'left',
          width: 290,
          parent: row,
        }).setPosition(0, 8);
        createLabel({
          text: `月产能 ${moneyText(p.monthlyCapacityBeforeYuan)} → ${moneyText(p.monthlyCapacityAfterYuan)} · 月需求 ${moneyText(p.monthlyPotentialOrderYuan)}`,
          fontSize: 11,
          color: THEME.textWeak,
          align: 'left',
          width: 290,
          parent: row,
        }).setPosition(0, -12);
        createLabel({
          text: p.valid
            ? p.idleRiskAfter
              ? '需求不足：投资后产能超过当月需求，可能闲置'
              : '需求可覆盖：投资后产能仍在当月需求以内'
            : p.reason === 'INSUFFICIENT_CASH'
              ? '现金不足，无法投资'
              : '当前不可投资',
          fontSize: 11,
          color: p.valid && !p.idleRiskAfter ? THEME.profit : THEME.danger,
          align: 'left',
          width: 290,
          parent: row,
        }).setPosition(0, -32);
      } else {
        createLabel({
          text: pv.ok ? '暂不可投资' : pv.displayMessage,
          fontSize: 11,
          color: THEME.danger,
          align: 'left',
          width: 290,
          parent: row,
        }).setPosition(0, -8);
      }
    }

    createButton({
      text: '取消',
      width: 240,
      height: 46,
      color: Color.WHITE,
      textColor: THEME.textWeak,
      fontSize: 14,
      parent: handle.footer,
      onClick: () => handle.close(),
    }).setPosition(0, 0);
  }

  /** 扩产二次确认：取消不扣款；确认只扣一次（一个 commandId）。 */
  private openInvestConfirm(amount: number): void {
    const pv = this.facade.previewInvest(amount);
    if (!pv.ok || !pv.payload.valid) {
      this.toast(pv.ok ? '当前不可投资' : pv.displayMessage);
      return;
    }
    const p = pv.payload;
    const commandId = nextCommandId('invest');
    const originRunId = this.state().runId;
    openConfirmDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '确认扩大产能？',
      message:
        `投入金额：${moneyText(amount)}\n` +
        `现金：${moneyText(p.cashAfter + amount)} → ${moneyText(p.cashAfter)}\n` +
        `业务资产：${moneyText(p.assetBookAfter - amount)} → ${moneyText(p.assetBookAfter)}\n` +
        `总资产当时不变（现金转为业务资产）\n` +
        `产能加成：+${(p.capacityCoeffBeforeBps - 10_000) / 100}% → +${(p.capacityCoeffAfterBps - 10_000) / 100}%\n` +
        (p.idleRiskAfter ? '注意：投资后产能超过当月需求，可能闲置。' : '投资后产能仍在当月需求以内。'),
      width: 320,
      confirmText: `确认投入 ${moneyText(amount)}`,
      busyText: '投资中…',
      confirmEnabled: p.valid,
      onConfirm: async (dialog) => {
        const r = await this.facade.invest(amount, { commandId, expectedRunId: originRunId });
        if (!r.ok) {
          if (r.code === 'RUN_CHANGED') {
            dialog.succeed();
            this.toast(r.displayMessage);
            return;
          }
          dialog.fail(r.displayMessage);
          return;
        }
        dialog.succeed();
        this.toast(`已投入 ${moneyText(amount)}，业务资产 ${moneyText(r.payload.assetBookAfter)}`);
        if (this.state().runId === originRunId) this.render();
      },
    });
  }

  private renderAnnualReport(): void {
    const s = this.state();
    const years = s.annualReports.map((r) => r.year).sort((a, b) => b - a);
    const latestYear = years[0];
    const selectedYear = this.annualReportYear !== null && years.includes(this.annualReportYear)
      ? this.annualReportYear
      : latestYear;
    const report: AnnualReport | null =
      selectedYear !== undefined ? this.facade.getAnnualReport(selectedYear) : null;
    this.annualReportYear = selectedYear ?? null;
    // R25：标题与底部固定，账目行放可滚动正文（小屏也能看全所有科目）
    const handle = openScrollableDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: report ? `第 ${report.year} 年财务报告` : '年度财务报告',
      width: 324,
      desiredBodyHeight: 430,
    });
    const body = handle.body;
    const innerWidth = 324 - 40;

    if (report) {
      const index = years.indexOf(report.year);
      const navRow = new Node('AnnualReportYearSelector');
      navRow.parent = body;
      navRow.addComponent(UITransform).setContentSize(new Size(innerWidth, 46));
      createButton({
        text: '较新年度',
        width: 116,
        fontSize: 12,
        disabled: index <= 0,
        parent: navRow,
        onClick: () => {
          if (index <= 0) return;
          handle.close();
          this.annualReportYear = years[index - 1] ?? report.year;
          this.renderAnnualReport();
        },
      }).setPosition(-82, 0);
      createLabel({ text: `第 ${report.year} 年`, fontSize: 13, bold: true, parent: navRow }).setPosition(0, 0);
      createButton({
        text: '较早年度',
        width: 116,
        fontSize: 12,
        disabled: index >= years.length - 1,
        parent: navRow,
        onClick: () => {
          if (index >= years.length - 1) return;
          handle.close();
          this.annualReportYear = years[index + 1] ?? report.year;
          this.renderAnnualReport();
        },
      }).setPosition(82, 0);
    }

    if (!report) {
      createLabel({
        text: '首个经营年度尚未结束。\n完成 12 个月结算后可在此查看年报。',
        fontSize: 13,
        color: THEME.textWeak,
        width: innerWidth,
        lineHeight: 20,
        parent: body,
      });
      createButton({
        text: '知道了',
        width: 240,
        height: 46,
        parent: handle.footer,
        onClick: () => handle.close(),
      }).setPosition(0, 0);
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
    for (const [label, value, cost] of rows) {
      const row = new Node('AnnualRow');
      row.parent = body;
      row.addComponent(UITransform).setContentSize(new Size(innerWidth, 26));
      createLabel({ text: label, fontSize: 12, align: 'left', color: THEME.textWeak, width: 150, parent: row })
        .setPosition(-58, 0);
      createLabel({
        text: value === 0 ? '¥0' : moneyText(value),
        fontSize: 12,
        align: 'right',
        color: cost && value !== 0 ? THEME.danger : THEME.text,
        width: 150,
        parent: row,
      }).setPosition(58, 0);
    }

    const profitColor = report.profitYuan < 0 ? THEME.danger : THEME.profit;
    const profitCard = createRect({
      width: innerWidth,
      height: 76,
      color: new Color(238, 244, 252),
      radius: 8,
      parent: body,
    });
    createLabel({ text: '本年净利润', fontSize: 12, color: THEME.textWeak, parent: profitCard }).setPosition(0, 18);
    createLabel({
      text: `${report.profitYuan < 0 ? '-' : ''}${moneyText(Math.abs(report.profitYuan))}`,
      fontSize: 22,
      bold: true,
      color: profitColor,
      parent: profitCard,
    }).setPosition(0, -12);

    createLabel({
      text: `期初现金 ${moneyText(report.cashOpenYuan)} → 期末 ${moneyText(report.cashCloseYuan)}\n总资产 ${moneyText(report.assetCloseYuan)}｜期末员工 ${report.headcountClose} 人`,
      fontSize: 12,
      color: THEME.textWeak,
      width: innerWidth,
      lineHeight: 18,
      parent: body,
    });

    const bridge = report.cashBridge;
    if (!bridge) {
      createLabel({
        text: '历史现金流明细未记录；仅保留期初/期末余额，不能从当前存档反推旧年投资或救助。',
        fontSize: 12,
        color: THEME.warning,
        width: innerWidth,
        lineHeight: 18,
        parent: body,
      });
    } else {
      const bridgeRows: Array<[string, number]> = [
        ['已记录月账净现金流', bridge.monthlyLedgerNetCashDeltaYuan],
        ['资本投资现金流', bridge.investmentCashFlowYuan],
        ['救助资本注入', bridge.rescueCapitalYuan],
        ['其他未归因现金流', bridge.unattributedCashFlowYuan],
      ];
      createLabel({ text: '现金桥（收入与现金支出均按实际发生记账）', fontSize: 12, bold: true, color: THEME.text, width: innerWidth, parent: body });
      bridgeRows.forEach(([label, value]) => {
        createLabel({
          text: `${label}：${value < 0 ? '-' : ''}${moneyText(Math.abs(value))}`,
          fontSize: 12,
          color: value < 0 ? THEME.danger : THEME.text,
          width: innerWidth,
          parent: body,
        });
      });
      createLabel({
        text: bridge.attributionComplete
          ? `现金桥差额：${moneyText(report.cashCloseYuan - report.cashOpenYuan - bridge.monthlyLedgerNetCashDeltaYuan - bridge.investmentCashFlowYuan - bridge.rescueCapitalYuan - bridge.unattributedCashFlowYuan)}（${bridge.balanced ? '平衡' : '不平衡'}）`
          : '部分归因：本年含升级前记录，未归因流量保留为差额；不把差额解释为投资。',
        fontSize: 12,
        color: bridge.attributionComplete && bridge.balanced ? THEME.profit : THEME.warning,
        width: innerWidth,
        lineHeight: 18,
        parent: body,
      });
    }

    createButton({
      text: '关闭',
      width: 240,
      height: 46,
      parent: handle.footer,
      onClick: () => handle.close(),
    }).setPosition(0, 0);
  }

  // ---------------------------------------------------------------- D04/D05 设置与关闭公司

  private renderSettings(): void {
    const overlay = this.modalOverlay();
    const audio = audioManager.getSettings();
    createRect({ width: 320, height: 560, color: Color.WHITE, radius: 12, parent: overlay }).setPosition(0, 0);
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
    const updateAudioSetting = (patch: Parameters<typeof audioManager.updateSettings>[0], sound: 'tap' | 'none'): void => {
      if (!audioManager.updateSettings(patch)) {
        this.toast('声音设置保存失败，已恢复原设置');
        this.rebuildSettings(overlay);
        return;
      }
      if (sound === 'tap') audioManager.uiTap();
      this.rebuildSettings(overlay);
    };
    toggle(100, '总开关（关闭后全静音）', audio.masterEnabled, () => {
      const a = audioManager.getSettings();
      updateAudioSetting({ masterEnabled: !a.masterEnabled }, 'tap');
    });
    toggle(56, '背景音乐', audio.musicEnabled, () => {
      const a = audioManager.getSettings();
      updateAudioSetting({ musicEnabled: !a.musicEnabled }, 'tap');
    });
    toggle(12, '操作音效/提示', audio.sfxEnabled, () => {
      const a = audioManager.getSettings();
      updateAudioSetting({ sfxEnabled: !a.sfxEnabled }, a.sfxEnabled ? 'none' : 'tap');
    });

    toggle(-30, '公开榜单同步（平台公开展示）', this.leaderboardConsent, () => {
      const next = !this.leaderboardConsent;
      if (next && !this.leaderboardConfig?.enabled) { this.toast('真实榜单配置尚未就绪'); return; }
      void this.platform?.set('ceo/leaderboard/consent/v1', next).then(() => {
        this.leaderboardConsent = next;
        this.rebuildSettings(overlay);
      }).catch(() => this.toast('榜单偏好保存失败'));
    });
    createLabel({ text: this.cloudStatusText, fontSize: 12, color: THEME.textWeak, width: 280, align: 'center', parent: overlay }).setPosition(0, -70);

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
    }).setPosition(0, -112);

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
    }).setPosition(0, -154);

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
    }).setPosition(0, -198);

    createButton({
      text: '取消',
      width: 240,
      height: 40,
      color: THEME.textWeak,
      parent: overlay,
      onClick: () => overlay.destroy(),
    }).setPosition(0, -242);
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
    // 关司预览 token 在开框时固定；确认按钮只有一次意图，连点不重复清档
    const preview = this.facade.beginCloseCompany(Date.now());
    const { confirmationToken, expiresAtMs, oldRunId } = preview;
    openConfirmDialog({
      overlay: this.modalOverlay(),
      viewportHeight: this.shellLayout().viewportHeight,
      title: '关闭公司并重来？',
      danger: true,
      message:
        `将永久清除本局：\n公司：${s.company?.name ?? ''}\n员工：${s.employees.length} 人\n现金：${moneyText(s.company?.cashYuan ?? 0)}\n已完成年度：${s.annualReports.length}\n\n` +
        '此操作不可撤销，但不会注销你的平台账号。',
      width: 320,
      desiredBodyHeight: 190,
      confirmText: '永久清除本局',
      busyText: '正在清除…',
      onConfirm: async (dialog) => {
        const result = await this.facade.confirmCloseCompany(
          { confirmationToken, expiresAtMs, oldRunId },
          Date.now(),
        );
        if (!result.ok) {
          if (result.code === 'CONFIRMATION_EXPIRED' || result.code === 'RUN_CHANGED') {
            // 预览已失效：关闭并让玩家重新看到最新摘要后再确认，绝不在旧凭据上重试
            dialog.succeed();
            this.toast(result.displayMessage);
            if (result.code === 'CONFIRMATION_EXPIRED' && this.state().runId === oldRunId) {
              this.renderCloseConfirm();
            }
            return;
          }
          dialog.fail(result.displayMessage);
          return;
        }
        dialog.succeed();
        this.resetCreateStateAfterClose();
        this.toast('公司已关闭，开始新的创业');
        this.render();
      },
    });
  }

  /** 关司成功后清空创建向导临时选择（平台账号与合规记录不受影响）。 */
  private resetCreateStateAfterClose(): void {
    this.customCompanyName = '';
    this.customCeoName = '';
    this.randomCompanyNames = [];
    this.selectedNameIndex = 0;
    this.nameNonce = 0;
    this.createStep = 'COMPANY';
    this.awaitingEnterCompany = false;
    this.activeTab = 'COMPANY';
  }

  // ---------------------------------------------------------------- 引导与通用控件

  private fullPanel(): Node {
    const panel = createRect({
      name: 'FullPanel',
      width: DESIGN_WIDTH,
      height: DESIGN_HEIGHT,
      color: new Color(0, 0, 0, 0),
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
    // R24：遮罩覆盖整个可视高度（高屏 >812 时上下不露正文），并吞噬触摸——
    // 弹窗打开时正文滚动与底层按钮不响应（T05），点遮罩不穿透（T02）。
    const viewport = Math.max(DESIGN_HEIGHT, this.shellLayout().viewportHeight);
    overlay.addComponent(UITransform).setContentSize(new Size(DESIGN_WIDTH, viewport));
    overlay.addComponent(BlockInputEvents);
    if (!transparent) {
      const g = overlay.addComponent(Graphics);
      g.fillColor = new Color(0, 0, 0, 130);
      g.rect(-DESIGN_WIDTH / 2, -viewport / 2, DESIGN_WIDTH, viewport);
      g.fill();
    }
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
