export default function MaintenancePage() {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Under Maintenance — GetLeads</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            min-height: 100vh;
            background: #030712;
            font-family: 'Inter', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          }
          .bg-grid {
            position: fixed; inset: 0; z-index: 0;
            background-image:
              linear-gradient(rgba(16,185,129,0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(16,185,129,0.04) 1px, transparent 1px);
            background-size: 40px 40px;
          }
          .glow {
            position: fixed; border-radius: 50%; filter: blur(100px); pointer-events: none; z-index: 0;
          }
          .glow-1 { width: 500px; height: 500px; background: rgba(16,185,129,0.12); top: -200px; left: -100px; }
          .glow-2 { width: 400px; height: 400px; background: rgba(99,102,241,0.10); bottom: -150px; right: -100px; }
          .card {
            position: relative; z-index: 10;
            background: rgba(9, 13, 22, 0.65);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 24px;
            padding: 3.5rem 3rem;
            max-width: 520px;
            width: 90%;
            text-align: center;
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6);
          }
          .icon-wrap {
            width: 80px; height: 80px; border-radius: 20px; margin: 0 auto 1.75rem;
            background: linear-gradient(135deg, rgba(16,185,129,0.2), rgba(99,102,241,0.2));
            border: 1px solid rgba(16,185,129,0.25);
            display: flex; align-items: center; justify-content: center; font-size: 2.2rem;
            box-shadow: 0 0 30px rgba(16,185,129,0.15);
            animation: pulse 2.5s ease-in-out infinite;
          }
          @keyframes pulse {
            0%, 100% { box-shadow: 0 0 20px rgba(16,185,129,0.15); }
            50% { box-shadow: 0 0 40px rgba(16,185,129,0.35); }
          }
          .logo { display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 2rem; }
          .logo-icon {
            width: 32px; height: 32px; background: linear-gradient(135deg, #10B981, #059669);
            border-radius: 8px; display: flex; align-items: center; justify-content: center;
            font-weight: 800; font-size: 0.85rem; color: #fff; box-shadow: 0 2px 10px rgba(16,185,129,0.3);
          }
          .logo-text { font-size: 1.3rem; font-weight: 700; color: #fff; }
          h1 { font-size: 1.75rem; font-weight: 800; color: #fff; margin-bottom: 0.75rem; letter-spacing: -0.02em; }
          .sub { font-size: 1rem; color: rgba(255,255,255,0.55); line-height: 1.65; margin-bottom: 2rem; }
          .status-row {
            display: flex; align-items: center; justify-content: center; gap: 0.5rem;
            padding: 0.6rem 1.25rem; border-radius: 999px;
            background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.2);
            font-size: 0.85rem; color: #10B981; font-weight: 500; margin-bottom: 2rem;
          }
          .dot { width: 7px; height: 7px; border-radius: 50%; background: #10B981; box-shadow: 0 0 6px #10B981; animation: blink 1.2s ease-in-out infinite; }
          @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
          .divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 1.5rem 0; }
          .footer { font-size: 0.78rem; color: rgba(255,255,255,0.3); }
          .footer a { color: rgba(16,185,129,0.7); text-decoration: none; }
        `}</style>
      </head>
      <body>
        <div className="bg-grid" />
        <div className="glow glow-1" />
        <div className="glow glow-2" />

        <div className="card">
          <div className="logo">
            <div className="logo-icon">GL</div>
            <span className="logo-text">GetLeads</span>
          </div>

          <div className="icon-wrap">🔧</div>

          <h1>Under Scheduled Maintenance</h1>
          <p className="sub">
            We're performing routine upgrades to improve your experience. The platform will be back online shortly. Thank you for your patience!
          </p>

          <div className="status-row">
            <div className="dot" />
            Our team is actively working on the update
          </div>

          <hr className="divider" />
          <p className="footer">
            Questions? Contact us at{" "}
            <a href="mailto:support@getleads.com">support@getleads.com</a>
          </p>
        </div>
      </body>
    </html>
  );
}
