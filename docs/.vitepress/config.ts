import { withMermaid } from "vitepress-plugin-mermaid"
import { defineConfig } from "vitepress"

export default withMermaid(
  defineConfig({
    lang: "zh-CN",
    base: "/rolebox-docs/",

    title: "Rolebox",
    description: "AI agent orchestration framework with dispatch, state machines, and multi-agent collaboration",

    themeConfig: {
      logo: "/logo.svg",

      search: {
        provider: "local",
      },

      nav: [
        { text: "教程", link: "/02-Guide/getting-started" },
        { text: "指南", link: "/02-Guide/create-a-role" },
        { text: "参考", link: "/03-Reference/role-yaml" },
        { text: "内部实现", link: "/01-Overview/architecture-overview" },
        { text: "贡献", link: "/05-Contributing/development-setup" },
      ],

      sidebar: [
        { text: "首页", link: "/" },
        {
          text: "01 教程（Tutorial）",
          collapsed: false,
          items: [
            { text: "教程总览与学习路径", link: "/02-Guide/getting-started" },
            { text: "01 安装并跑通第一个角色", link: "/02-Guide/tutorial/01-install" },
            { text: "02 让角色懂你的项目", link: "/02-Guide/tutorial/02-first-role" },
            { text: "03 用函数改变行为", link: "/02-Guide/tutorial/03-functions" },
            { text: "04 把角色变成团队", link: "/02-Guide/tutorial/04-team" },
            { text: "05 用图引擎编排团队", link: "/02-Guide/tutorial/05-graph" },
            { text: "06 加上审批门与有界循环", link: "/02-Guide/tutorial/06-approval-and-loop" },
            { text: "07 让代理记住你（第二教程）", link: "/02-Guide/tutorial/07-memory" },
            { text: "三步速查（3 步 / 故障排查）", link: "/01-Overview/quick-start" },
          ],
        },
        {
          text: "02 指南（Guides）",
          collapsed: false,
          items: [
            {
              text: "角色",
              collapsed: false,
              items: [
                { text: "创建角色", link: "/02-Guide/create-a-role" },
                { text: "角色目录", link: "/01-Overview/directory-structure" },
                { text: "子代理", link: "/02-Guide/subagents" },
              ],
            },
            {
              text: "能力",
              collapsed: false,
              items: [
                { text: "技能系统", link: "/02-Guide/skills" },
                { text: "编写技能", link: "/02-Guide/authoring-skills" },
                { text: "函数系统", link: "/02-Guide/functions" },
                { text: "引用文档", link: "/02-Guide/references" },
                { text: "自定义 Hook", link: "/02-Guide/custom-hooks" },
              ],
            },
            {
              text: "编排",
              collapsed: false,
              items: [
                { text: "图工作流", link: "/02-Guide/graph-workflows" },
                { text: "工作流模式", link: "/04-Advanced/workflow-patterns" },
              ],
            },
          ],
        },
        {
          text: "03 参考（Reference）",
          collapsed: false,
          items: [
            {
              text: "配置",
              collapsed: true,
              items: [
                { text: "role.yaml 参考", link: "/03-Reference/role-yaml" },
                { text: "调度配置", link: "/03-Reference/dispatch-config" },
                { text: "模型别名", link: "/03-Reference/model-aliases" },
              ],
            },
            {
              text: "命令行与分发",
              collapsed: true,
              items: [
                { text: "CLI 参考", link: "/03-Reference/cli" },
                { text: "注册中心", link: "/03-Reference/registry" },
                { text: "示例目录", link: "/02-Guide/examples" },
              ],
            },
            {
              text: "工具目录",
              collapsed: true,
              items: [
                { text: "工具总索引", link: "/03-Reference/tool-catalog" },
                { text: "LSP 工具", link: "/03-Reference/tools/lsp-tools" },
                { text: "会话与记忆工具", link: "/03-Reference/tools/session-memory-tools" },
                { text: "编排工具", link: "/03-Reference/tools/orchestration-tools" },
                { text: "平台工具", link: "/03-Reference/tools/platform-tools" },
              ],
            },
            {
              text: "图与函数规范",
              collapsed: true,
              items: [
                { text: "图声明参考", link: "/04-Advanced/graph-declaration" },
                { text: "函数规范", link: "/02-Guide/writing-functions" },
              ],
            },
            {
              text: "扩展",
              collapsed: true,
              items: [
                { text: "Hook 机制", link: "/03-Reference/hooks" },
                { text: "扩展机制", link: "/03-Reference/extensions" },
              ],
            },
            {
              text: "运行与排错",
              collapsed: true,
              items: [
                { text: "错误处理", link: "/03-Reference/error-handling" },
                { text: "已知限制", link: "/03-Reference/limitations" },
                { text: "平台与 Harness", link: "/01-Overview/platform-harnesses" },
                { text: "兼容性", link: "/04-Advanced/compatibility" },
              ],
            },
          ],
        },
        {
          text: "04 内部实现（Internals）",
          collapsed: false,
          items: [
            {
              text: "架构",
              collapsed: true,
              items: [
                { text: "架构概览", link: "/01-Overview/architecture-overview" },
                { text: "服务架构", link: "/01-Overview/service-architecture" },
                { text: "处理管道", link: "/01-Overview/processing-pipeline" },
              ],
            },
            {
              text: "图引擎",
              collapsed: true,
              items: [
                { text: "图执行引擎", link: "/04-Advanced/graph-engine" },
                { text: "运行时行为", link: "/04-Advanced/runtime-behavior" },
              ],
            },
            {
              text: "子系统",
              collapsed: true,
              items: [
                { text: "记忆系统", link: "/04-Advanced/memory-system" },
                { text: "会话工具", link: "/04-Advanced/session-tools" },
                { text: "信号系统", link: "/04-Advanced/signal-system" },
                { text: "通知系统", link: "/04-Advanced/notification-system" },
                { text: "循环系统", link: "/04-Advanced/loop-system" },
                { text: "Hashline 编辑", link: "/04-Advanced/hashline-editing" },
                { text: "恢复系统", link: "/03-Reference/recovery-system" },
              ],
            },
            { text: "插件接口", link: "/03-Reference/plugin-interface" },
          ],
        },
        {
          text: "05 贡献（Contributing）",
          collapsed: false,
          items: [
            { text: "开发环境搭建", link: "/05-Contributing/development-setup" },
            { text: "贡献指南", link: "/05-Contributing/contributing" },
          ],
        },
        {
          text: "06 附录（Appendix）",
          collapsed: true,
          items: [
            { text: "术语表", link: "/06-Appendix/glossary" },
            { text: "源码索引", link: "/06-Appendix/source-index" },
            {
              text: "迁移对照",
              link: "/06-Appendix/migration",
              collapsed: true,
              items: [
                { text: "协作图（已移除）", link: "/02-Guide/collaboration-graph" },
                { text: "终止条件（已移除）", link: "/04-Advanced/termination-conditions" },
              ],
            },
            {
              text: "历史设计记录",
              collapsed: true,
              items: [
                { text: "记忆策略", link: "/04-Advanced/design-decisions/memory-strategy" },
                { text: "会话工具策略", link: "/04-Advanced/design-decisions/session-tools-strategy" },
              ],
            },
          ],
        },
      ],

      socialLinks: [
        { icon: "github", link: "https://github.com/EricMoin/rolebox" },
      ],

      footer: {
        message: "文档对应 rolebox v1.9.0",
        copyright: "Copyright © 2024-present Rolebox",
      },
    },
  }),
)
