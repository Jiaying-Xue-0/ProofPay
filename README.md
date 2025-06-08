# ProofPay - 区块链支付凭证生成器

ProofPay 是一个基于区块链的支付凭证生成工具，帮助用户将链上交易转换为标准化的电子凭证。

## 在线演示

🚀 访问在线演示：[https://proof-pay.vercel.app/](https://proof-pay.vercel.app/)

## 主要功能

### 1. 多钱包管理
- 支持设置主钱包和子钱包
- 便捷的钱包切换功能
- 钱包验证和管理系统

### 2. 交易记录
- 自动获取最近30天的交易历史
- 支持多种代币交易（原生代币和 ERC20 代币）
- 交易分类显示（收入/支出）
- 实时交易状态查询

### 3. 凭证生成
- 自动提取交易信息
- 支持自定义凭证信息
  - 客户名称和地址
  - 交易描述
  - 标签管理
  - 附加说明
- 专业的 PDF 凭证生成
- 区块链验证信息集成

### 4. 凭证管理
- 历史凭证查询
- 多维度筛选
  - 按类型（收入/支出）
  - 按代币类型
  - 按日期范围
- 凭证预览和下载

### 5. 区块链集成
- 支持多链交易查询
  - 以太坊主网
  - Polygon
  - Optimism
  - Arbitrum
- 区块链浏览器链接集成
- 交易状态实时验证

### 6. 安全特性
- 钱包签名验证
- 交易真实性验证
- 凭证防伪机制

## 技术栈

- 前端框架：React + Next.js
- 区块链交互：ethers.js + wagmi
- 钱包连接：RainbowKit
- UI 框架：Tailwind CSS
- PDF 生成：jsPDF
- 状态管理：Zustand

## 开始使用

1. 克隆仓库
```bash
git clone https://github.com/your-username/proofpay.git
```

2. 安装依赖
```bash
cd proofpay
npm install
```

3. 配置环境变量
```bash
cp .env.example .env.local
# 编辑 .env.local 文件，添加必要的 API 密钥
```

4. 启动开发服务器
```bash
npm run dev
```

## 环境变量配置

必要的环境变量：
- `NEXT_PUBLIC_ETHERSCAN_API_KEY`: Etherscan API 密钥
- `NEXT_PUBLIC_WALLET_CONNECT_ID`: WalletConnect 项目 ID

## 使用流程

1. 连接钱包
2. 选择要处理的交易
3. 填写凭证信息
4. 生成并下载 PDF 凭证
5. 在历史记录中管理凭证

## 贡献指南

欢迎提交 Pull Request 和 Issue。在提交之前，请确保：
- 代码经过测试
- 遵循现有的代码风格
- 更新相关文档

## 许可证

MIT License
