import { _decorator, Component, ResolutionPolicy, view } from 'cc';
import { AppView } from './ui/AppView';

const { ccclass } = _decorator;

/**
 * 场景引导（S00）。
 * 1) 设置竖屏设计分辨率 375×812，按宽度适配（设计 07.1）。
 * 2) 在 Canvas 上挂载 AppView，驱动整个 UI。
 */
@ccclass('Bootstrap')
export class Bootstrap extends Component {
  override onLoad(): void {
    view.setDesignResolutionSize(375, 812, ResolutionPolicy.FIXED_WIDTH);
    if (this.getComponent(AppView)) return;
    this.addComponent(AppView);
  }
}
