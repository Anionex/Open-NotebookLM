# Supabase 注册OTP配置（详细步骤）

## 当前问题
注册时收到的是验证链接（magic link），而不是6位OTP验证码。

## 关键点
Supabase的 `signUp()` 方法发送的是 **Confirm signup** 邮件，不是 Magic Link 邮件。

## 配置步骤

### 1. 访问邮件模板设置
https://supabase.com/dashboard/project/jioxcrqwohxlnjduzuws/auth/templates

### 2. 修改 "Confirm signup" 模板（重要！）
**不是** Magic Link 模板，是 **Confirm signup** 模板！

点击 "Confirm signup" 模板，修改为：

```html
<h2>确认您的注册</h2>
<p>请输入以下验证码完成注册：</p>
<h1 style="font-size: 32px; font-weight: bold; margin: 20px 0;">{{ .Token }}</h1>
<p>此验证码将在1小时后过期。</p>
```

### 3. 保存模板
点击 "Save" 保存模板。

### 4. 测试
1. 注册新账号
2. 检查邮箱
3. 应该收到6位数字验证码，而不是链接

## 如果还是收到链接

检查以下设置：

### A. 确认Email Provider配置
1. 进入 Authentication > Providers > Email
2. 确保启用了 "Enable Email provider"
3. 查看 "Confirm email" 设置

### B. 检查是否有自定义SMTP
如果配置了自定义SMTP，确保模板正确应用。

### C. 清除缓存
1. 退出Supabase控制台
2. 清除浏览器缓存
3. 重新登录并检查模板

## 前端代码说明
前端代码已正确实现：
- `signUp()` - 触发 Confirm signup 邮件
- `verifyOtp(email, token, type: "signup")` - 验证注册OTP
- 之后可以用密码登录
