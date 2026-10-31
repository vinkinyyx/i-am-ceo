# 《我是CEO》UI-01｜启动及平台初始化页

> 页面ID：UI-01 / S00。优先级P0。遵守B00规范。交付包含独立预览PNG，不作为Cocos正式页面贴图。当前为首版视觉草案，后续批次继承同风格。

## 视觉结构（375×812逻辑像素）

| 区域 | 相对位置 | 设计要求 |
|---|---|---|
| 顶部安全区 | 0→safeTop | 适配平台状态栏，不放重要内容 |
| 品牌装饰 | y≈130–390 | 轻卡通的办公楼/成长柱状图组合，图形低复杂度、完整不裁切 |
| 游戏Logo | y≈420 | “我是CEO”，深蓝大字、突出品牌 |
| 核心文案 | y≈479 | “从一家小公司开始，经营你的未来” |
| CTA区域 | y≈566–630 | 无档“开始创业”；有档“继续经营”；主按钮高52、宽≥320 |
| 状态与错误 | y≈650 | 只有初始化时显示读档进度；错误出现重试并保留隐私入口 |
| 底部 | safeBottom上方 | 隐私政策入口、版本信息；不可假冒平台授权组件 |

## 状态定义

1. `Loading`：平台初始化、读本地存档；按钮不可操作，展示“正在载入经营数据…”和非百分比加载提示。
2. `NoSave`：显示主按钮“开始创业”，点击进入S01公司创建。
3. `HasSave`：显示主按钮“继续经营”，点击继续上次正常路由；不得直接复位档案。关闭公司只能从设置进入。
4. `SaveRecovery`：校验失败，显示“存档暂时无法读取”与“重试”，禁止静默创建新档覆盖。
5. `PlatformUnavailable`：按平台适配文档设定的降级路径处理，不能伪造已登录/已保存成功。

## 交互与导航

- 主CTA：无档→S01；有档→对应恢复页面或T01。
- 进入公司创建无需点击额外“同意平台登录”假按钮；平台授权由官方流程处理。
- 隐私政策：打开真实政策页面/合法配置的文档链接；未经配置不做虚假跳转。
- 启动画面只在打开游戏时出现；启动期间不能推进经营时间两次。

## Cocos节点拆分

```text
S00_Boot (Canvas)
  SafeAreaTop
  Backdrop (Sprite / native graphics)
  HeroArtwork (optional Sprite; no text)
  BrandTitle (Label: 我是CEO)
  Tagline (Label)
  LoadingGroup (ProgressIndicator + Label)
  ActionGroup
    MainButton (Button + Label)
    RecoveryButton (Button + Label, error only)
  Footer (PrivacyButton + BuildVersion Label)
  ErrorDialog (shared ConfirmDialog)
```

### 验收

- 首次打开→S01，有档→正确恢复；错误时可重试，不覆盖旧数据。
- 375×812、360×640、428×926安全区内主按钮和隐私链接不裁切。
- 汉字全为动态Label；背景图不包含公司名、时间、金额及按钮文字。
- 无华丽动画，按钮实际触控≥44px，初始化重入不会重复触发经营结算。


> v1.4 正式页面文件：`B01_Onboarding/Screens/UI-01_Launch.png` / `.svg`。如有文字与实际动态数据冲突，以项目需求与代码结算规则为准。
