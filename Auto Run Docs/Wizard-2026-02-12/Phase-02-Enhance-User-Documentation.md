# Phase 02: Enhance User Documentation

This phase adds visual polish and helpful context to the README, making it more engaging and informative for users. This includes adding examples, screenshots/demos, and additional documentation to help users understand what they're building and how to customize it.

## Tasks

- [x] Add visual elements and examples to README.md:
  - Create an "Example Output" section showing what the TUI looks like when running
  - Add ASCII art or text-based example of the agent grid display
  - Include sample output from the demo agents (Echo Agent and Watch Agent)
  - Add a "What You'll See" section describing the status indicators and colors
  <!-- Completed: Added "What You'll See" section after Quick Start with detailed ASCII art grid display, status indicator table, color-coded output guide, agent type/role badge reference, loop status bar explanation, and full demo agent output samples for all three demo agents (Claude Agent, OpenCode Agent, Git Push). All 1298 existing tests pass. -->

- [x] Document the agent configuration system:
  - Add "Understanding Agents" section explaining AgentConfig structure
  - Show example of how to modify demo agents in src/components/App.tsx
  - Explain the different agent roles (coder, auditor, planner, etc.) and statuses
  - Include tips on creating custom agents with different commands
  <!-- Completed: Added comprehensive "Understanding Agents" section to README.md between "The Loop" and "Configuration" sections. Includes: AgentConfig TypeScript interface with all 6 fields documented, Agent Types table mapping types to parsers, Agent Roles table with loop phase mapping and purpose descriptions, Agent Statuses table, demo agent modification example showing how to change roles in demoConfigs, and a full "Creating Custom Agents" subsection with defaultAgents config.json example (3 agents: Claude coder, ESLint auditor, test runner reviewer) plus 5 practical tips on type selection, role matching, shell commands, args usage, and HTTP API agent creation. All 1298 existing tests pass. -->

- [x] Add keyboard shortcuts and controls section:
  - Document the 'q' key to quit the application
  - Explain any other interactive features
  - Add notes about terminal compatibility and requirements
  <!-- Completed: Enhanced the Keyboard Controls section in README.md: fixed Detail View keybindings to match actual code (keys 1/2/3 for filter modes instead of incorrect 'f', added PageUp/PageDown for page scrolling), added Event Log Panel scrolling subsection, added Global section documenting Ctrl+C force quit. Added comprehensive "Terminal Compatibility" section covering raw mode requirements, ANSI escape code support, minimum terminal size recommendations, Unicode rendering needs, and a platform-specific recommended terminals table (macOS, Linux, Windows). All 1298 existing tests pass. -->

- [x] Create a FAQ or Common Issues section:
  - Address potential platform-specific issues (macOS, Linux, Windows)
  - Solutions for common errors (port conflicts, missing dependencies, etc.)
  - Tips for running in different terminal emulators
  - How to stop long-running agents
  <!-- Completed: Replaced the basic Troubleshooting section with a comprehensive "FAQ & Common Issues" section in README.md. Organized into 7 subsections: Installation & Setup (4 issues), Port Conflicts & Networking (3 issues including EADDRINUSE fix commands for macOS/Linux/Windows, env var docs), Agents (6 issues including spawn ENOENT, auto-restart behavior, max agent limit, stopping long-running agents), Terminal & Display (4 issues covering raw mode, layout, colors, Unicode), Platform-Specific Issues (macOS/Linux/Windows with actionable fixes for each), and Configuration (3 issues including config reset). All 1298 existing tests pass. -->
