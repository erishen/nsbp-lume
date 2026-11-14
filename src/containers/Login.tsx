import React, { Fragment, useState } from "react";
import Header from "@components/Header";
import Layout from "@components/Layout";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";

// 登录页(放在 /signin —— /login 是 Lume 引擎 AgentHTTPD 会话门禁保留路径,
// relay 不转发, 直接访问会 404; /signin 不在保留列表, SSR 正常)。
// 原版 nsbp 的登录页是脚手架演示(<p>login</p> + 测试盒), 这里重做成登录卡片。
// 无真实鉴权后端: 提交仅做本地校验 + 演示成功提示; 如需接入, 可在 node SSR
// 后端或 Lume DSL 加 /api/login 校验后再打通。
const Login = ({ query }: { query?: Record<string, string> }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOk(false);
    if (!username.trim()) {
      setError("请输入用户名");
      return;
    }
    if (!password) {
      setError("请输入密码");
      return;
    }
    // 占位登录: 原版登录页无真实鉴权后端(演示页)。
    setError("");
    setOk(true);
  };

  return (
    <Fragment>
      <Helmet>
        <title>登录 · nsbp-lume</title>
        <meta name="description" content="登录 nsbp-lume" />
      </Helmet>
      <Header />
      <Layout query={query}>
        <div className="login-wrapper">
          <form className="login-card" onSubmit={handleSubmit}>
            <div className="login-logo">nsbp-lume</div>
            <h1 className="login-title">欢迎回来</h1>
            <p className="login-sub">登录以继续访问</p>

            {error && <div className="login-msg login-error">{error}</div>}
            {ok && (
              <div className="login-msg login-ok">
                ✓ 登录成功（演示页，未接入真实鉴权）
              </div>
            )}

            <div className="login-field">
              <label htmlFor="login-user">用户名</label>
              <input
                id="login-user"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                autoComplete="username"
              />
            </div>
            <div className="login-field">
              <label htmlFor="login-pass">密码</label>
              <input
                id="login-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                autoComplete="current-password"
              />
            </div>

            <div className="login-options">
              <label>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                记住我
              </label>
              <a
                className="login-forgot"
                href="#"
                onClick={(e) => e.preventDefault()}
              >
                忘记密码？
              </a>
            </div>

            <button className="login-submit" type="submit">
              登 录
            </button>

            <p className="login-foot">
              还没有账号？<Link to="/">返回首页</Link>
            </p>
          </form>
        </div>
      </Layout>
    </Fragment>
  );
};

export default Login;
