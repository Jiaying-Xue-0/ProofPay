# ProofPay - Web3 发票生成器

ProofPay 是一个基于 Web3 的发票生成器，允许用户为区块链上的交易生成专业的发票和收据。

## 功能特点

- 🔗 支持以太坊网络
- 📄 生成专业的发票和收据
- 💾 本地保存历史记录
- 🔍 交易历史查询和筛选
- 📱 响应式设计，支持移动端
- 🏷️ 交易标签管理

## 技术栈

- Next.js 14
- TypeScript
- RainbowKit & Wagmi
- Etherscan API
- TailwindCSS
- Headless UI

## 开始使用

1. 克隆仓库：

```bash
git clone https://github.com/Jiaying-Xue-0/ProoPay.git
cd ProoPay
```

2. 安装依赖：

```bash
npm install
```

3. 配置环境变量：

创建 `.env.local` 文件并添加以下配置：

```env
NEXT_PUBLIC_ETHERSCAN_API_KEY=your_etherscan_api_key
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_wallet_connect_project_id
```

4. 启动开发服务器：

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## 使用说明

1. 连接钱包：点击右上角的"Connect Wallet"按钮连接你的 Web3 钱包
2. 查看交易：连接成功后自动显示最近 30 天的交易记录
3. 生成文档：
   - 点击交易记录可以选择生成发票或收据
   - 填写必要信息（客户名称、描述等）
   - 可以添加标签和备注
   - 生成 PDF 文档
4. 历史记录：可以查看之前生成的所有文档

## 开发计划

- [ ] 支持更多区块链网络（Solana、Polygon 等）
- [ ] 自定义发票模板
- [ ] 批量生成功能
- [ ] 导出财务报表
- [ ] 多语言支持

## 贡献指南

欢迎提交 Pull Request 和 Issue！

## 许可证

MIT License
