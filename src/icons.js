const icons={
 layers:'<path d="m3 8 9-5 9 5-9 5-9-5Zm1 5 8 4 8-4M4 17l8 4 8-4"/>',
 export:'<path d="M12 15V3m-5 5 5-5 5 5M5 13v7h14v-7"/>',
 chevron:'<path d="m6 9 6 6 6-6"/>',screen:'<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8"/>',
 sliders:'<path d="M4 6h7m5 0h4M4 12h2m5 0h9M4 18h9m5 0h2"/><circle cx="13.5" cy="6" r="2"/><circle cx="8.5" cy="12" r="2"/><circle cx="15.5" cy="18" r="2"/>',
 reset:'<path d="M4 10a8 8 0 1 1 1.5 7M4 4v6h6"/>',frame:'<path d="M3 9V4h5m8 0h5v5m0 6v5h-5M8 20H3v-5M9 12h6m-3-3v6"/>',
 pause:'<path fill="currentColor" stroke="none" d="M5 4h5v16H5zm9 0h5v16h-5z"/>',play:'<path fill="currentColor" stroke="none" d="m6 3 15 9-15 9z"/>',
 restart:'<path d="M5 5v14m13-14L8 12l10 7z"/>',expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',x:'<path d="m6 6 12 12M6 18 18 6"/>',
 search:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/>',check:'<path d="m4 12 5 5L20 6"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',line:'<path d="m4 19 16-14"/>',
 ring:'<circle cx="12" cy="12" r="8"/>',text:'<path d="M4 7V4h16v3m-8-3v16m-4 0h8"/>',
 path:'<path d="M4 17c1-16 14 7 16-11"/><circle cx="4" cy="17" r="1.6"/><circle cx="20" cy="6" r="1.6"/>',
 move:'<path d="M12 2v20M2 12h20M8 6l4-4 4 4m-8 12 4 4 4-4M6 8l-4 4 4 4m12-8 4 4-4 4"/>'
};
function icon(name){return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">'+icons[name]+'</svg>'}
document.querySelectorAll('[data-icon]').forEach(el=>el.outerHTML=icon(el.dataset.icon));
