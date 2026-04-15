# Cpolar 内网穿透配置文档

## 概述

使用 [cpolar](https://www.cpolar.com/) 将本地前端服务（端口 3001）穿透至公网，域名含 `thinkflow` 标识。

---

## 环境信息

| 项目 | 内容 |
|------|------|
| 系统 | Ubuntu x86_64 (Linux 5.15) |
| cpolar 版本 | 3.3.12 |
| 本地服务 | `http://localhost:3001`（前端 frontend_zh） |
| 公网地址 | `https://thinkflow.nas.cpolar.cn` |

---

## 安装步骤

### 1. 一键安装 cpolar

```bash
curl -L https://www.cpolar.com/static/downloads/install-release-cpolar.sh | sudo bash
```

安装完成后二进制位于 `/usr/local/bin/cpolar`。

### 2. 写入 Authtoken

```bash
cpolar authtoken <YOUR_AUTHTOKEN>
```

Token 保存至 `/usr/local/etc/cpolar/cpolar.yml`。

### 3. 配置隧道

编辑 `/usr/local/etc/cpolar/cpolar.yml`：

```yaml
authtoken: <YOUR_AUTHTOKEN>
tunnels:
  thinkflow:
    proto: http
    addr: 3001
    subdomain: thinkflow
```

---

## 启动 / 停止

### 后台启动

```bash
nohup cpolar start thinkflow \
  --log=/var/log/cpolar/access.log \
  > /var/log/cpolar/thinkflow.log 2>&1 &
```

### 查看进程

```bash
ps aux | grep cpolar | grep -v grep
```

### 停止

```bash
kill $(pgrep cpolar)
```

---

## 日志文件

| 文件 | 说明 |
|------|------|
| `/var/log/cpolar/thinkflow.log` | 隧道运行日志（stdout/stderr） |
| `/var/log/cpolar/access.log` | cpolar 内部访问日志 |

实时查看：

```bash
tail -f /var/log/cpolar/thinkflow.log
```

---

## 验证穿透是否成功

日志中出现以下两行即代表穿透成功：

```
level=info msg="Tunnel established at http://thinkflow.nas.cpolar.cn"
level=info msg="Tunnel established at https://thinkflow.nas.cpolar.cn"
```

浏览器访问 `https://thinkflow.nas.cpolar.cn` 即可打开前端页面。

---

## 注意事项

- **免费账号**：每次重启后 subdomain 随机分配，`thinkflow` 子域名**不保证固定**；需升级付费套餐并在控制台"预留域名"后才能固定。
- **非 systemd 环境**：当前机器 PID 1 不是 systemd，无法使用 `systemctl enable cpolar`，需手动后台启动（见上文）。
- **前端需先运行**：cpolar 只做端口转发，本地 `frontend_zh` 服务必须先启动在 3001 端口，否则隧道返回 502。

```bash
# 启动前端
cd /root/user/szl/prj/Open-NotebookLM/frontend_zh
npm run dev -- --port 3001 --host 0.0.0.0
```

---

## 配置文件路径速查

```
/usr/local/bin/cpolar                        # 可执行文件
/usr/local/etc/cpolar/cpolar.yml             # 主配置文件
/var/log/cpolar/thinkflow.log                # 隧道日志
/etc/systemd/system/cpolar.service           # systemd 服务文件（当前环境不可用）
```
