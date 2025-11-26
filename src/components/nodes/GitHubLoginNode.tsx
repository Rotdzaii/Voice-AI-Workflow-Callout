import React from 'react';
import api from '../../services/api';

export default function GitHubLoginNode() {
  function startGitHub() {
    const url = api.oauth.githubStart();
    const web_nonce = Math.random().toString(36).slice(2);
    const w = window.open(`${url}?web_nonce=${encodeURIComponent(web_nonce)}`, 'github_oauth', 'width=500,height=700');
    const onMsg = (e: MessageEvent) => {
      const d: any = e.data || {};
      if (d && d.type === 'oauth' && d.provider === 'github') {
        if (d.ok) {
          try { localStorage.setItem('token', d.token); } catch {}
        }
        window.removeEventListener('message', onMsg);
        w?.close();
      }
    };
    window.addEventListener('message', onMsg);
  }

  return (
    <div className="wb-card-sm wb-col wb-gap-8">
      <div className="wb-title">GitHub Login</div>
      <button className="wb-btn" onClick={startGitHub}>Login with GitHub</button>
    </div>
  );
}
