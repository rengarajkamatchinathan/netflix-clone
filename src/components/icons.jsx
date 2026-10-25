// Single consistent icon set (24x24, currentColor).
const I = ({ children, size = 24, fill = 'none', sw = 2, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
)

export const Play = p => <I fill="currentColor" sw={0} {...p}><path d="M6 3.5v17a.5.5 0 0 0 .76.43l14-8.5a.5.5 0 0 0 0-.86l-14-8.5A.5.5 0 0 0 6 3.5z" /></I>
export const Pause = p => <I fill="currentColor" sw={0} {...p}><rect x="5" y="3" width="5" height="18" rx="1" /><rect x="14" y="3" width="5" height="18" rx="1" /></I>
export const Plus = p => <I {...p}><path d="M12 4v16M4 12h16" /></I>
export const Check = p => <I {...p}><path d="M4 12.5 9.5 18 20 6" /></I>
export const ThumbUp = p => <I sw={1.8} {...p}><path d="M7 10v11H3V10h4zM7 10l4-7c1.5 0 2.5 1 2.5 2.5V9h5.5a2 2 0 0 1 2 2.3l-1.3 7.7A2 2 0 0 1 17.7 21H7" /></I>
export const ChevronDown = p => <I {...p}><path d="m5 9 7 7 7-7" /></I>
export const ChevronLeft = p => <I {...p}><path d="m15 4-8 8 8 8" /></I>
export const ChevronRight = p => <I {...p}><path d="m9 4 8 8-8 8" /></I>
export const Info = p => <I {...p}><circle cx="12" cy="12" r="9.5" /><path d="M12 11v6M12 7.5v.01" /></I>
export const Search = p => <I {...p}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.8-4.8" /></I>
export const Bell = p => <I sw={1.8} {...p}><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2zM10 21h4" /></I>
export const Close = p => <I {...p}><path d="M5 5l14 14M19 5 5 19" /></I>
export const Pencil = p => <I sw={1.8} {...p}><path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4" /></I>
export const Back = p => <I {...p}><path d="M20 12H4m7-7-7 7 7 7" /></I>
export const Replay = p => <I {...p}><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" /></I>
export const Volume = p => <I sw={1.8} {...p}><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></I>
export const Mute = p => <I sw={1.8} {...p}><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="m16 9 6 6m0-6-6 6" /></I>
export const Rewind10 = p => <I sw={1.7} {...p}><path d="M5 12a7.5 7.5 0 1 0 2.2-5.3M4 3v4h4" /><text x="12.2" y="15.5" fontSize="7" textAnchor="middle" fill="currentColor" stroke="none" fontWeight="700">10</text></I>
export const Forward10 = p => <I sw={1.7} {...p}><path d="M19 12a7.5 7.5 0 1 1-2.2-5.3M20 3v4h-4" /><text x="11.8" y="15.5" fontSize="7" textAnchor="middle" fill="currentColor" stroke="none" fontWeight="700">10</text></I>
export const NextEp = p => <I fill="currentColor" sw={0} {...p}><path d="M4 4.5v15l11-7.5zM17 4h3v16h-3z" /></I>
export const Episodes = p => <I sw={1.8} {...p}><rect x="3" y="8" width="14" height="12" rx="1" /><path d="M7 4h14v12" /></I>
export const Subtitles = p => <I sw={1.8} {...p}><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M6 13h4M12 13h6M6 16h8" /></I>
export const Speed = p => <I sw={1.8} {...p}><path d="M4.5 17a8.5 8.5 0 1 1 15 0" /><path d="m12 13 4-4" /></I>
export const Fullscreen = p => <I {...p}><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" /></I>
export const ExitFullscreen = p => <I {...p}><path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" /></I>
export const Flag = p => <I sw={1.8} {...p}><path d="M5 21V4h11l-2 4 2 4H5" /></I>
export const Tv = p => <I sw={1.6} {...p}><rect x="2.5" y="5" width="19" height="13" rx="2" /><path d="M8 21h8" /></I>
export const Download = p => <I sw={1.6} {...p}><path d="M12 3v12m-5-5 5 5 5-5M4 20h16" /></I>
export const Telescope = p => <I sw={1.6} {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4M8 11h6M11 8v6" /></I>
export const Smile = p => <I sw={1.6} {...p}><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5v.01M15 9.5v.01" /></I>
export const User = p => <I sw={1.6} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></I>
export const HelpCircle = p => <I sw={1.6} {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5v.7M12 17v.01" /></I>
