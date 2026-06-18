import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import DiamondMark from "./ui/DiamondMark";
import loginBg from "../../public/login.png";

export default function LoginScreen({ username, password, rememberMe, error, busy, onUsernameChange, onPasswordChange, onRememberMeChange, onSubmit, onContactAdmin, onForgotPassword }) {
  const [showPw, setShowPw] = useState(false);

  return (
    <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden", fontFamily: "'Inter','Segoe UI',sans-serif", background: "#f8faff" }}>
      <img src={loginBg} alt="Test Management System" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />

      <div style={{ position: "relative", zIndex: 2, minHeight: "100vh", display: "flex", justifyContent: "flex-end", alignItems: "center", paddingRight: "8%" }}>
        <div style={{ width: "100%", height: "auto", maxWidth: 520, padding: "80px 42px", borderRadius: 36, background: "rgba(255,255,255,0.32)", border: "1px solid rgba(255,255,255,0.28)", boxShadow: "0 8px 32px rgba(31,38,135,0.12), inset 0 1px 1px rgba(255,255,255,0.18)", position: "absolute", right: "8%", top: "50%", transform: "translateY(-50%)", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <div style={{ width: 78, height: 78, borderRadius: 24, background: "linear-gradient(135deg,#6366f1,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 14px 30px rgba(99,102,241,0.22)" }}><DiamondMark size={34} outer="#ffffff" inner="#4f46e5" stroke={6} /></div>
          </div>

          <div style={{ textAlign: "center", marginBottom: 50 }}>
            <div style={{ fontSize: 34, fontWeight: 750, color: "#0f172a", letterSpacing: "-0.03em", marginBottom: 10 }}>Welcome Back</div>
            <div style={{ fontSize: 15, color: "#64748b", lineHeight: 1.6 }}>Sign in to continue to your account</div>
          </div>

          <form onSubmit={onSubmit} style={{ display: "grid", gap: 22 }}>
            <div>
              <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 700, color: "#334155", letterSpacing: "0.08em", textTransform: "uppercase" }}>Username</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 16, zIndex: 2, pointerEvents: "none" }}>👤</span>
                <input
                  value={username}
                  onChange={e => onUsernameChange(e.target.value)}
                  autoComplete="username"
                  placeholder="Enter your email address"
                  style={{ width: "100%", padding: "15px 18px 15px 48px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.65)", background: "rgba(255,255,255,0.78)", backdropFilter: "blur(10px)", fontSize: 15, color: "#0f172a", outline: "none", boxSizing: "border-box", boxShadow: "0 8px 20px rgba(15,23,42,0.03)", transition: "all 0.18s ease" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 700, color: "#334155", letterSpacing: "0.08em", textTransform: "uppercase" }}>Password</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 16, zIndex: 2, pointerEvents: "none" }}>🔒</span>
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => onPasswordChange(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  style={{ width: "100%", padding: "15px 52px 15px 48px", borderRadius: 16, border: "1px solid rgba(255,255,255,0.65)", background: "rgba(255,255,255,0.78)", backdropFilter: "blur(10px)", fontSize: 15, color: "#0f172a", outline: "none", boxSizing: "border-box", boxShadow: "0 8px 20px rgba(15,23,42,0.03)", transition: "all 0.18s ease" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  title={showPw ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    boxShadow: "none",
                    cursor: "pointer",
                    color: "#94a3b8",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: -2 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#475569", cursor: "pointer" }}>
                <input type="checkbox" checked={rememberMe} onChange={e => onRememberMeChange(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#6366f1" }} />
                Remember me
              </label>
              <span
                onClick={onForgotPassword}
                style={{ color: "#4f46e5", fontWeight: 700, cursor: "pointer", fontSize: 14, textDecoration: "underline" }}
              >
                Forgot password?
              </span>
            </div>

            {error && <div style={{ background: "rgba(255,240,242,0.92)", border: "1px solid rgba(244,63,94,0.12)", color: "#be123c", padding: "12px 14px", borderRadius: 14, fontSize: 13 }}>{error}</div>}

            <button type="submit" disabled={busy} style={{ marginTop: 4, width: "100%", padding: "16px 18px", border: "none", borderRadius: 16, background: "linear-gradient(135deg,#6366f1,#4f46e5)", color: "#fff", fontSize: 17, fontWeight: 800, cursor: "pointer", boxShadow: "0 14px 35px rgba(99,102,241,0.22)", transition: "all 0.18s ease" }}>
              {busy ? "Signing in..." : "→ Login"}
            </button>

            <div style={{ textAlign: "center", marginTop: 4, fontSize: 15, color: "#475569" }}>
              Don't have an account?{" "}
              <span onClick={onContactAdmin} style={{ color: "#4f46e5", fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>Contact Administrator</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}