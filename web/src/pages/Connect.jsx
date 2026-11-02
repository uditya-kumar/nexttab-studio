import { ArrowUpRight } from "lucide-react";
import ApiKeyForm from "../components/ApiKeyForm.jsx";
import { Key } from "../components/ui.jsx";
import { useAccount } from "../lib/account.jsx";

export default function Connect() {
  const { dashboardUrl } = useAccount();
  return (
    <div className="page connect">
      <div className="connect-card card">
        <div className="connect-demo" aria-hidden="true">
          <div className="demo-comment">
            <span className="avatar sm">FM</span>
            <b>firoz.maverick</b>
            <Key lit>SEND</Key>
          </div>
          <div className="demo-dm">Repo link: github.com/denislupookov/altersend</div>
        </div>
        <div>
          <h1>Run @nexttab from one desk</h1>
          <p className="sub">
            Schedule reels, read reach and audience, answer DMs and comments, and run the keyword automations that send repo
            links
          </p>
        </div>
        <ApiKeyForm />
        {dashboardUrl && (
          <a className="btn ghost sm" href={dashboardUrl} target="_blank" rel="noreferrer" style={{ alignSelf: "flex-start" }}>
            <ArrowUpRight size={14} strokeWidth={1.5} /> Get a key from the dashboard
          </a>
        )}
      </div>
    </div>
  );
}
