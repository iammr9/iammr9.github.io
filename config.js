/* ✦ Everything you'd want to change lives here. Save, refresh, done. ✦ */
window.BIO = {
  name: 'iammr9',
  handle: '',                    // a small line under the name, e.g. '@_iammr9' (empty = hidden)
  avatar: 'avatar.jpg',          // a file next to index.html or an https:// image link

  // the line under your name types itself, then rotates through these
  roles: ['huss huss huss', 'building Stellar Launcher'],
  bio: '',                       // a sentence under that line (empty = hidden)

  // small icon tiles. type: discord, tiktok, youtube, instagram, facebook, x, roblox, github, twitch, spotify
  // copy: 'text' copies that text instead of opening a link (handy for a Discord username)
  links: [
    { type: 'discord', label: 'Discord', url: 'https://discord.com/users/561483901940531220' },
    { type: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/@_iammr9' },
    { type: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/@Mr9real' },
    { type: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/kao_chaimongkol/' },
    { type: 'roblox', label: 'Roblox', url: 'https://www.roblox.com/users/3327284095/profile' },
    { type: 'github', label: 'GitHub', url: 'https://github.com/iammr9' },
  ],

  // big buttons under the icons
  buttons: [
    { label: 'Join Stellar', sub: 'Discord · keys, shop and support', url: 'https://discord.gg/nfPXqWgYW', icon: 'discord' },
    { label: 'Download Stellar Launcher', sub: 'free · Windows 10/11', url: 'https://stellar-launcher.stellarstore.workers.dev/download', icon: 'star' },
  ],

  // null = a soft space ambience made live in the browser (no file, no copyright issues)
  // or put your own file next to index.html, e.g. 'music.mp3' (only use music you're allowed to)
  music: null,
  volume: 0.5,
};
