# Supabase Email OTP 配置指南

## 问题描述
默认情况下，Supabase发送magic link（链接验证），但我们需要发送OTP验证码。

## 配置步骤

### 1. 进入Supabase控制台
访问：https://supabase.com/dashboard/project/jioxcrqwohxlnjduzuws/auth/templates

### 2. 配置Email Auth设置
1. 点击左侧 **Authentication** → **Providers**
2. 找到 **Email** provider
3. 确保启用 **Enable Email provider**
4. **重要**：启用 **Enable Email OTP**（而不是magic link）

### 3. 配置邮件模板
1. 点击 **Authentication** → **Email Templates**
2. 选择 **Confirm signup** 模板
3. 修改模板内容，使用OTP变量：

```html
<h2>Confirm your signup</h2>
<p>Enter this code to complete your registration:</p>
<h1>{{ .Token }}</h1>
<p>This code expires in 24 hours.</p>
```

### 4. 禁用Confirm Email（可选）
如果不想要email confirmation，可以：
1. 进入 **Authentication** → **Settings**
2. 找到 **Email Auth**
3. 禁用 **Enable email confirmations**

但建议保持启用，使用OTP验证。

## 验证流程

### 注册流程
1. 用户输入邮箱和密码
2. 点击注册
3. Supabase发送6位OTP到邮箱
4. 用户输入OTP验证码
5. 验证成功，完成注册

### 登录流程
1. 用户输入邮箱和密码
2. 直接登录（不需要验证码）

## 前端代码说明
前端已经实现了完整的OTP流程：
- `signUpWithEmail()` - 注册并触发OTP发送
- `verifyOtp()` - 验证OTP码
- `resendOtp()` - 重新发送OTP
- `signInWithEmail()` - 密码登录

## 测试
1. 注册新账号
2. 检查邮箱是否收到6位验证码（而不是链接）
3. 输入验证码完成注册
4. 之后可以直接用邮箱+密码登录
