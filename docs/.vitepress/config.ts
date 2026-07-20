import { withMermaid } from "vitepress-plugin-mermaid"
import { defineConfig } from "vitepress"

export default withMermaid(
  defineConfig({
    lang: "zh-CN",

    title: "Rolebox",
    description: "AI agent orchestration framework with dispatch, state machines, and multi-agent collaboration",

    themeConfig: {
      logo: false,

      search: {
        provider: "local",
      },

      nav: [
        { text: "首页", link: "/" },
        { text: "快速开始", link: "/01-Overview/quick-start" },
        { text: "指南", link: "/02-Guide/create-a-role" },
        { text: "参考", link: "/03-Reference/role-yaml" },
        { text: "CLI", link: "/03-Reference/cli" },
      ],

      sidebar: [
        {
          text: "架构总览",
          collapsed: false,
          items: [
            { text: "架构概览", link: "/01-Overview/architecture-overview" },
            { text: "处理管道", link: "/01-Overview/processing-pipeline" },
            { text: "服务架构", link: "/01-Overview/service-architecture" },
            { text: "目录结构", link: "/01-Overview/directory-structure" },
            { text: "快速开始", link: "/01-Overview/quick-start" },
          ],
        },
        {
          text: "开发者指南",
          collapsed: false,
          items: [
            { text: "创建角色", link: "/02-Guide/create-a-role" },
            { text: "子代理", link: "/02-Guide/subagents" },
            { text: "协作图", link: "/02-Guide/collaboration-graph" },
            { text: "函数系统", link: "/02-Guide/functions" },
            { text: "编写函数", link: "/02-Guide/writing-functions" },
            { text: "技能系统", link: "/02-Guide/skills" },
            { text: "编写技能", link: "/02-Guide/authoring-skills" },
            { text: "引用文档", link: "/02-Guide/references" },
            { text: "自定义 Hook", link: "/02-Guide/custom-hooks" },
            { text: "示例展示", link: "/02-Guide/examples" },
          ],
        },
        {
          text: "配置参考",
          collapsed: false,
          items: [
            { text: "role.yaml 参考", link: "/03-Reference/role-yaml" },
            { text: "调度配置", link: "/03-Reference/dispatch-config" },
            { text: "Hook 机制", link: "/03-Reference/hooks" },
            { text: "扩展机制", link: "/03-Reference/extensions" },
            { text: "注册中心", link: "/03-Reference/registry" },
            { text: "CLI 参考", link: "/03-Reference/cli" },
            { text: "工具目录", link: "/03-Reference/tool-catalog" },
            { text: "插件接口", link: "/03-Reference/plugin-interface" },
            { text: "错误处理", link: "/03-Reference/error-handling" },
            { text: "恢复系统", link: "/03-Reference/recovery-system" },
            { text: "已知限制", link: "/03-Reference/limitations" },
          ],
        },
        {
          text: "高级主题",
          collapsed: false,
          items: [
            {
              text: "内部系统",
              collapsed: true,
              items: [
                { text: "记忆系统", link: "/04-Advanced/memory-system" },
                { text: "通知系统", link: "/04-Advanced/notification-system" },
                { text: "会话工具", link: "/04-Advanced/session-tools" },
                { text: "信号系统", link: "/04-Advanced/signal-system" },
                { text: "循环系统", link: "/04-Advanced/loop-system" },
                { text: "哈希行编辑", link: "/04-Advanced/hashline-editing" },
                { text: "兼容性", link: "/04-Advanced/compatibility" },
              ],
            },
            {
              text: "设计决策（历史记录）",
              collapsed: true,
              items: [
                { text: "记忆策略", link: "/04-Advanced/design-decisions/memory-strategy" },
                { text: "会话工具策略", link: "/04-Advanced/design-decisions/session-tools-strategy" },
              ],
            },
            { text: "工作流模式", link: "/04-Advanced/workflow-patterns" },
            { text: "终止条件", link: "/04-Advanced/termination-conditions" },
            { text: "运行时行为", link: "/04-Advanced/runtime-behavior" },
          ],
        },
        {
          text: "贡献指南",
          collapsed: false,
          items: [
            { text: "开发环境搭建", link: "/05-Contributing/development-setup" },
            { text: "架构概览", link: "/05-Contributing/architecture-overview" },
            { text: "贡献指南", link: "/05-Contributing/contributing" },
          ],
        },
      ],

      socialLinks: [
        { icon: "github", link: "https://github.com/mgdream/rolebox" },
      ],

      footer: {
        message: "基于 MIT 许可协议发布",
        copyright: "Copyright © 2024-present Rolebox",
      },
    },
  }),
)
