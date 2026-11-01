import {
  Color,
  Component,
  Graphics,
  Node,
  profiler,
  Size,
  UITransform,
  Widget,
} from 'cc';
import { GameFacade } from '../../core/application/GameFacade';
import type { CandidateOffer, GameState, GameSpeed, IndustryId, CeoTrait, AnnualReport } from '../../core/domain/types';
import { CocosPlatform } from '../platform/CocosPlatform';
import { loadEconomyConfig } from '../platform/loadConfig';
import {
  createButton,
  createLabel,
  createRect,
  moneyText,
  stretchToParent,
} from './UiFactory';
import { THEME, DESIGN_WIDTH, DESIGN_HEIGHT } from './theme';

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
  private root!: Node;
  private toastNode: Node | null = null;
  private selectedIndustry: IndustryId = 'TRADE';
  private selectedTrait: CeoTrait = 'BOLD';
  private customCompanyName = '';
  private customCeoName = '';
  private randomCompanyNames: string[] = [];
  private selectedNameIndex = 0;
  private activeTab: TabId = 'COMPANY';
  private pendingOffer: CandidateOffer | null = null;

  async start(): Promise<void> {
    // 关闭屏幕左下角调试统计面板（发布包不应显示）
    profiler.hideStats();
    const platform = new CocosPlatform();
    const cfg = await loadEconomyConfig();
    this.facade = await GameFacade.bootstrap(platform, cfg);
    this.buildRoot();
    this.render();

    // 在线经营时钟：按真实帧时间推进（仅 RUNNING 且 speed>0 时月结）
    this.schedule(this.clockTick, 0.2);

    // 前后台生命周期
    platform.onHide(() => this.toast('已自动保存'));
  }

  private clockTick(): void {
    if (!this.facade) return;
    const s = this.facade.getState();
    if (s.phase !== 'RUNNING' || s.speed === 0) return;
    void this.facade
      .advanceRealTime(200, s.runId)
      .then((r) => {
        if (r.ok && (r.payload.monthsAdvanced > 0 || r.payload.yearsClosed.length > 0)) {
          this.render();
        }
      })
      .catch(() => undefined);
  }

  private buildRoot(): void {
    const canvas = this.node;
    this.root = new Node('AppRoot');
    this.root.parent = canvas;
    this.root.addComponent(UITransform).setContentSize(new Size(DESIGN_WIDTH, DESIGN_HEIGHT));
    const widget = this.root.addComponent(Widget);
    widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
    widget.top = widget.bottom = widget.left = widget.right = 0;
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
    }
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
    body.setPosition(0, 30);

    if (this.activeTab === 'COMPANY') this.renderCompanyTab(body);
    else if (this.activeTab === 'DEPARTMENT') this.renderPlaceholderTab(body, '部门', '部门创建与人员配置将在 M2 开放');
    else if (this.activeTab === 'TALENT') this.renderPlaceholderTab(body, '人才', '运营期招聘与裁员将在 M2 开放');
    else this.renderPlaceholderTab(body, '排行', '本地模拟排行榜将在 M3 开放');

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
    this.render();
  }


  private renderPlaceholderTab(parent: Node, title: string, desc: string): void {
    createLabel({ text: title, fontSize: 22, bold: true, color: THEME.primary, parent: parent }).setPosition(0, 200);
    createRect({ width: 320, height: 160, color: Color.WHITE, radius: 8, parent: parent }).setPosition(0, 40);
    createLabel({ text: desc, fontSize: 14, color: THEME.textWeak, width: 280, lineHeight: 22, parent: parent }).setPosition(
      0,
      40,
    );
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
    createRect({ width: 310, height: 300, color: Color.WHITE, radius: 12, parent: overlay }).setPosition(0, 0);
    createLabel({ text: '设置', fontSize: 18, bold: true, parent: overlay }).setPosition(0, 110);
    createLabel({
      text: '《我是CEO》 MVP M0\n本地单机存档，不联网、无广告、无内购',
      fontSize: 12,
      color: THEME.textWeak,
      width: 260,
      lineHeight: 18,
      parent: overlay,
    }).setPosition(0, 50);

    createButton({
      text: '重新查看操作指引',
      width: 240,
      height: 44,
      color: Color.WHITE,
      textColor: THEME.primary,
      parent: overlay,
      onClick: () => {
        overlay.destroy();
        this.toast('首年结束后将在 M3 提供完整指引重播');
      },
    }).setPosition(0, -20);

    createButton({
      text: '关闭公司并重新创业',
      width: 240,
      height: 44,
      color: Color.WHITE,
      textColor: THEME.danger,
      parent: overlay,
      onClick: () => {
        overlay.destroy();
        this.renderCloseConfirm();
      },
    }).setPosition(0, -74);

    createButton({
      text: '取消',
      width: 240,
      height: 40,
      color: THEME.textWeak,
      parent: overlay,
      onClick: () => overlay.destroy(),
    }).setPosition(0, -124);
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
