import { Component, Node, UITransform, _decorator, isValid } from 'cc';

const { ccclass } = _decorator;

/**
 * A1：正文不足一屏时，ScrollView 会在重排/边界计算中把 Content 下移，
 * 导致按钮“看得见却点不到”。短内容本就不需要滚动，这里逐帧把顶边贴回可视区；
 * 内容超过一屏后立即让位给 ScrollView 自身的滚动逻辑。
 *
 * 独立脚本：Cocos 限制单个脚本最多注册一个 Component。
 */
@ccclass('CeoShortContentAnchor')
export class ShortContentAnchor extends Component {
  content: Node | null = null;
  viewNode: Node | null = null;

  override lateUpdate(): void {
    const content = this.content;
    const viewNode = this.viewNode;
    if (!content || !viewNode || !isValid(content, true) || !isValid(viewNode, true)) return;
    const viewHeight = viewNode.getComponent(UITransform)?.height ?? 0;
    const contentHeight = content.getComponent(UITransform)?.height ?? 0;
    if (viewHeight <= 0 || contentHeight > viewHeight + 1) return;
    if (Math.abs(content.position.y - viewHeight / 2) > 0.5) content.setPosition(0, viewHeight / 2);
  }
}
