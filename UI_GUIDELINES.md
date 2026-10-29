# 统一 UI 开发规范

适用于 `noIdea_Front` 新页面和现有页面的 UI 修改。后续开发必须先读本文，再复用公共实现。目标是让页面的按钮、表单、弹窗、间距和主题保持一致，避免每个功能重新设计一套控件。

当前待办、工作日报、用户管理、聊天、签名板、流程图、地图、晚餐转盘、颜色变量测试和剧集检索已接入公共样式。普通列表参考待办页，表格参考用户管理，满高工作区参考聊天和流程图；不能把旧的局部覆盖复制成新的默认样式。用户明确的设计要求优先；业务例外只影响对应业务区域。

## 视觉方向：克制现代

- 浅色采用柔和灰白底与接近不透明的白色表面；深色采用石墨灰。主色集中用于主要按钮、选中状态、重点提示和焦点，不给整页铺主色。
- 页面标题26px、600字重，正文14px，辅助信息12px。统计数字使用正文色，避免与主操作争夺注意力。
- 面板14px圆角、控件8px圆角、弹窗16px圆角。使用细边框和轻阴影区分层级，阴影取自 `--app-shadow-panel` / `--app-shadow-overlay`。
- 输入框使用 `--app-control-bg` 的柔和填充；聚焦时显示主色细边和浅色焦点圈。保留32px小按钮与18px无边框图标。
- 状态筛选使用浅灰分组底、浮起的选中项和少量主题色文字；卡片悬停只轻微抬升。列表和编辑按钮默认可见。
- 首页和子页复用同一套边框、表面、阴影与字号，登录注册使用公共认证布局。原有主题色、背景图片及自定义色卡继续生效；全局水印使用次要文字色，保持辨识并降低干扰。

## 1. 样式来源与职责

| 来源                                           | 负责内容                                                         | 新页面的做法                                  |
| ---------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------- |
| `src/assets/styles/global-theme.css`           | 主题、语义颜色、尺寸变量、按钮、图标按钮、移动端基础字号         | 使用变量，禁止再次写一套深浅色或控件尺寸      |
| `src/assets/styles/overlays.css`               | Dialog、MessageBox、下拉浮层、颜色选择、Popover 的通用外观与滚动 | 使用 Element Plus，页面不覆盖弹窗整体几何尺寸 |
| `src/assets/styles/app-ui.css`                 | 页面容器、标题、面板、工具栏、筛选、空状态、表单、日期浮层       | 直接挂公共类名                                |
| `src/components/navigation/PageBackButton.vue` | 统一返回图标、点击区域、提示、无障碍名称                         | 所有子功能页面复用该组件                      |
| `src/utils/ui.ts`                              | 日期浮层防溢出的公共配置                                         | 引用 `datePickerPopperOptions`                |
| `src/utils/theme.ts` / `App.vue`               | 应用已保存主题、背景、水印、中文组件配置                         | 页面继承，不独立修改全局主题                  |
| 页面 `<style scoped>`                          | 业务行布局、画布、图形、局部响应式排列                           | 只补充公共样式没有表达的业务部分              |

加载顺序已在 `src/main.ts` 设置：基础样式 → `global-theme.css` → `overlays.css` → `app-ui.css`。普通页面无需重复 import 公共 CSS。Element Plus 组件沿用项目的自动导入配置；若显式导入组件，需要确认对应组件样式已经加载。

`admin-dialog.css` 只保留账号摘要、密码规则等业务内容，通用 Dialog、标签和控件尺寸由公共样式负责。`logout-confirm.css` 是已有业务兼容样式，不能整份复制到新页面。共享规范需要变化时，修改对应公共来源，并同步本文，避免用更高优先级的局部选择器反复补丁。

## 2. 尺寸、字体和颜色

| 项目                 | 标准                                                                                           | 来源                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 页面可用高度         | `--app-height`，跟随可视视口                                                                   | 已有 `useViewportHeight`                               |
| 页面内边距           | 桌面横向 `clamp(20px, 3vw, 40px)`、纵向 `clamp(24px, 3vw, 36px)`；手机 `16px 14px`，兼顾安全区 | `--app-page-gutter-x/y`；`--app-page-padding` 为组合值 |
| 普通内容最大宽度     | 1360px，居中                                                                                   | `--app-content-width`                                  |
| 页面标题             | 桌面26px；手机22px，600字重                                                                    | `--app-page-title-size`                                |
| 正文                 | 14px                                                                                           | `--app-font-body-size`                                 |
| 普通按钮、状态筛选   | 13px；弹窗按钮沿用公共14px                                                                     | `--app-font-control-size` / `overlays.css`             |
| 普通输入、选择器     | 桌面沿用组件默认14px；手机可编辑输入16px                                                       | Element Plus / `global-theme.css`                      |
| 说明、数量、次要信息 | 12px，不在手机上另缩成10px/11px                                                                | `--app-font-caption-size`                              |
| 数据概览数字         | 桌面32px；手机28px，仅用于统计值                                                               | `.app-stat-value`                                      |
| 普通按钮和图标点击区 | 32px高；纯图标按钮32px方形                                                                     | `--app-button-height`                                  |
| 操作图标             | 18px                                                                                           | `--app-icon-size`                                      |
| 输入/按钮圆角        | 8px                                                                                            | `--app-radius-control`                                 |
| 面板圆角             | 14px                                                                                           | `--app-radius-panel`                                   |
| 编辑表单控件         | 40px高；多行备注按内容增高                                                                     | `--app-form-control-height`                            |
| 表单标签宽度         | 桌面72px；手机64px                                                                             | `--app-form-label-width`                               |
| 标签与控件间隔       | 桌面12px；手机10px                                                                             | `--app-form-column-gap`                                |
| 表单文字             | 桌面14px/22px行高；手机16px/24px行高                                                           | `--app-form-font-size` / `--app-form-line-height`      |

间距优先用 `--app-space-1/2/3/4/5/6/8`，分别为4/8/12/16/20/24/32px。画布坐标、转盘半径、图表数据等业务数值不属于普通控件尺寸，可按业务计算。

颜色必须使用语义变量：

- 正文 `--theme-text`，次要文字 `--theme-muted`；页面 `--theme-page`，面板 `--theme-surface`。
- 主色 `--el-color-primary`，深浅色下的强调文字 `--ui-accent-text`。
- 边框 `--el-border-color` / `--el-border-color-lighter`；悬停填充 `--el-fill-color-light`。
- 成功、警告、错误使用 Element Plus 的 `success`、`warning`、`danger` 变量。
- 不给普通页面写死白底、黑字、蓝色按钮或独立暗色背景。业务图表、地图、轮盘的配色可以不同，但要保证两种主题下可读。

## 3. 页面结构

普通工具、管理和列表页面统一使用以下骨架。返回事件保留首页传入的 `fromCategory`，不要返回固定分类；同页刷新、筛选不能丢失该参数。

```vue
<div class="app-page">
  <div class="app-page__content">
    <header class="app-page__header">
      <PageBackButton @click="goBack" />
      <div class="app-page__heading">
        <h1 class="app-page__title">页面名称</h1>
        <p class="app-page__description">一句简短、面向用户的说明。</p>
      </div>
      <!-- 页面主操作放在右侧 -->
    </header>

    <section class="app-panel" aria-label="内容区域">
      <div class="app-toolbar app-panel__toolbar">
        <nav class="app-tabs" aria-label="内容筛选">
          <button type="button" :aria-pressed="selected">全部</button>
        </nav>
        <div class="app-toolbar__actions"><!-- 搜索、排序和操作 --></div>
      </div>
      <!-- 业务内容 -->
    </section>
  </div>
</div>
```

公共类负责容器、标题、面板和工具栏的几何样式，不能再给 `.xxx-page` 写另一套标题、按钮尺寸或阴影。页面可添加自己的类名用于业务布局与选择器，例如 `class="todo-page app-page"`，但不覆盖公共约定。

地图、流程图、签名画布、转盘等具有不同的工作空间需求，可以使用铺满容器、透明背景或单画布布局，不强行套白色大面板。业务工作区可按需覆盖内容宽度这一布局变量，但需说明原因；公共返回、字体、操作按钮和弹窗仍统一。

聊天、流程图、签名板和转盘使用满高变体，根容器加 `.app-page--workspace`，内容容器加 `.app-page__content--workspace`。公共类负责纵向 flex、剩余高度和容器间距，业务工作区保留 `flex: 1; min-height: 0`。不要另写页面 padding、标题字号或用整个 body 滚动挤压画布。低高度时可隐藏辅助描述，不能缩小操作图标和普通说明字号。

地图保留全窗口的绝对定位布局，浮动标题和工具栏使用公共尺寸与页面留白变量。签名画布和导出的图片保留白色底，确保笔迹和导出结果一致；这两项是业务表现，不用于复制普通页面主题。

登录与注册使用 `.app-auth-shell`、`.app-auth-card`、`.app-auth-heading` 和 `.app-auth-actions`。认证表单复用 `.app-form`，不再使用随机换色背景或独立的输入高度。首页的侧栏、工作台和书签卡片沿用公共面板圆角与阴影；书签图标是内容标识，可采用36px图标容器，手机32px。

## 4. 按钮、图标与交互

1. 使用 Element Plus 的 `el-button`；主操作用 `type="primary"`，删除等危险操作沿用全局危险样式。
2. 纯图标按钮使用 `.app-icon-button`：无按钮边框、底色和阴影，32px点击区、18px图标；hover 改图标颜色，键盘焦点保留轮廓。
3. 每个图标按钮必须有准确 `aria-label` 和可见的 tooltip，不能只靠图形猜功能；返回使用 `PageBackButton`，不另造不同大小的箭头。
4. 普通操作图标不能在手机上缩成26px按钮、15px图标；表格编辑、删除和翻页保持同一点击区。
5. 编辑、删除等操作默认可见，不能只靠鼠标 hover 才出现。hover 提示是补充说明；手机必须直接可操作。
6. 禁用状态表达真实约束，并能从界面理解原因。新增只保留一个清晰入口，不能出现一个新增按钮禁用、旁边另一个等价入口却可用的情况。
7. 保存中锁定重复提交；失败保留输入和原状态，成功后更新列表与数量。输入法确认候选词时不得误触 Enter 提交。
8. 删除或清空前使用已有 `ElMessageBox.confirm`。按业务范围说明删除内容，不额外制造自定义确认框或异常大的弹窗。

```vue
<el-tooltip content="编辑" :trigger-keys="[]">
  <el-button class="app-icon-button" :icon="Edit" aria-label="编辑事项" @click="edit" />
</el-tooltip>
```

复选标记、图表图例等业务图形不等同于普通操作图标，可保留符合控件含义的视觉尺寸，仍需可点击、可聚焦和明确的状态。

`PageBackButton` 默认提示“返回收藏”；管理页可通过 `label="返回首页"` 修改名称，点击事件仍由页面处理。聊天、管理搜索等保留原生输入的既有业务结构可使用 `.app-input`，原生多行编辑区使用 `.app-textarea`，统一边框、字号和焦点效果，页面只设置业务宽高。普通新增表单仍优先使用 Element Plus。

## 5. 弹窗与表单

- Dialog 沿用公共外观：桌面24px内边距、16px圆角、18px标题；手机和低高度窗口的缩进由 `overlays.css` 自动处理。
- 普通编辑弹窗宽度建议460–520px；小型提示400px；更复杂的表单可按内容选620px。不要用百分比宽度让简单确认框占满桌面。
- 确认框使用 `ElMessageBox`，公共宽度400px。页脚操作靠右，按钮间隔8px，不额外加分隔线。
- label 与控件在同一行，统一标签列和控件列；不能再出现32px标签对40px输入框。单行内容居中，多行备注的第一行与标签对齐。
- 表单复用 `.app-form`、`.app-form-row`。日期、输入、备注和开关的行高、内边距、文字基线都由共享样式处理，不在页面重写。
- 输入与选择器用组件提供的控件，禁止原生 `<select>` 混入 Element Plus 编辑弹窗。手机输入保持16px，标签随共享变量保持一致。
- 开关可以放在 `.app-form-control.app-form-control--between`，说明使用 `.app-form-inline-text`。补充说明保持简短，避免挤压控件。
- 浮层通常被 Teleport 到 body；用专属 `popper-class` 或现有共享类处理，不用失效的局部后代选择器，也不写全局 `body .el-popper` 覆盖所有功能。
- 日期统一加 `popper-class="app-date-popper"` 与共享 `datePickerPopperOptions`，确保手机、低高度和横屏不溢出。共享表单已覆盖日期组件的默认固定宽度，必须保留该约束，避免窄屏右侧被裁切。
- 动态选项编辑可用 `.app-form-row--action` 在控件右侧增加32px图标列，不能缩小删除按钮挤出空间。带数字输入的表单也沿用40px高度与统一文字基线。
- 图片预览使用公共 Dialog。自定义 header 时加 `.app-dialog--custom-header`，头部用 `.app-dialog-header`、`.app-dialog-title`，关闭图标沿用 `.app-icon-button`；不再创建一套遮罩、焦点锁定或弹窗尺寸规则。

```vue
<el-dialog v-model="visible" title="编辑事项" width="500">
  <form class="app-form" @submit.prevent="save">
    <div class="app-form-row">
      <label for="item-title">事项</label>
      <el-input id="item-title" v-model="draft.title" aria-label="事项内容" />
    </div>
    <div class="app-form-row">
      <label for="item-notes">备注</label>
      <el-input id="item-notes" v-model="draft.notes" type="textarea" :rows="3" />
    </div>
    <div class="app-form-row">
      <label for="item-date">计划日期</label>
      <el-date-picker id="item-date" v-model="draft.date" type="date"
        value-format="YYYY-MM-DD" popper-class="app-date-popper"
        :popper-options="datePickerPopperOptions" aria-label="计划日期" />
    </div>
  </form>
  <template #footer>
    <el-button :disabled="saving" @click="visible = false">取消</el-button>
    <el-button type="primary" :loading="saving" @click="save">保存</el-button>
  </template>
</el-dialog>
```

日期配置从 `@/utils/ui` 导入。需要 Element Plus 表单验证时，也可使用 `el-form class="app-form"` 与 `el-form-item`；`label-width` 设置为 `calc(var(--app-form-label-width) + var(--app-form-column-gap))`，保留共享的标签、输入和多行文本样式。不要把 `el-form-item` 再套成另一套网格。

## 6. 列表、空状态和响应式

- 面板复用 `.app-panel`，筛选复用 `.app-tabs`，搜索布局用 `.app-search`，统计值用 `.app-stat-value`。
- 空状态复用 `.app-empty` 及其 `__icon`、`__title`、`__description` 子类；加载可以使用 `.app-loading-state`、Skeleton 或现有 loading 状态。
- 数据状态必须区分加载、空列表、筛选无结果和请求失败。不能用演示数据掩盖错误；错误提供重试，清空关键词可恢复完整列表。
- 长标题、URL、备注等要能换行或省略；真正需要多行的内容提供完整查看入口。布局的 flex/grid 子项保留 `min-width: 0`，不用缩小所有文字来掩盖溢出。
- 页面、列表、弹窗分别管理自己的滚动；不新增整个 body 的双层滚动。全局由 `global-theme.css` 隐藏原生滚动条与 Element Plus 的自绘滚动条，保留容器原有 `overflow`、滚轮、触摸和键盘滚动；页面不再另写滚动条皮肤，不使用 `overflow: hidden` 代替隐藏滚动条。
- 手机工具栏可换行，搜索和操作不能被挤出屏幕；必要时收起重复的搜索图标，但保留 Enter 提交和明确的输入提示。
- 不覆盖全局主题背景。主题设置保存后才应用，普通页面不能为了局部预览直接调用全局主题修改。

## 7. 开发与交付检查

实施顺序：阅读本文 → 确认已有组件和公共类 → 完成业务结构 → 只写必要局部布局 → 验证 → 说明公共变更和业务例外。

交付前核对：

- 标题、返回、按钮、图标、输入和面板是否使用共享尺寸；是否遗留30px/26px图标按钮或10px/11px普通说明文字。
- 是否复制了其他页面的整套样式；是否重写 `.el-dialog`、按钮高度或自己的主题色。
- 表单的标签、输入文字、多行备注首行、日期和开关是否对齐，所有图标操作是否可发现。
- 是否检查至少320px、390px、1280px及一种低高度横屏；复杂工作区再检查大屏。深浅色、长内容、空状态、错误态都可读、可操作。
- 数据与交互变化补充必要的场景验证；纯文案或低风险样式修改复用现有验证和截图，不新增只复述 CSS 实现的测试。

前端运行 `npm run lint`、`npm run typecheck` 和 `npm run build`。Prettier 检查本次修改的文件，避免顺带格式化整个仓库。公共控件修改还需运行相关已有浏览器场景，例如后端目录的 `npm run test:ui-browser`；待办页可运行 `npm run test:todos-browser`。浏览器场景采用隔离数据库，路径与环境配置见对应功能说明。

规范与源代码不一致时，修正对应的共享实现或文档，不通过页面内的 `!important` 或任意固定尺寸绕开规范。当前不声称静态检查能自动覆盖所有视觉问题，截图检查与共享组件复用仍是必要步骤。
