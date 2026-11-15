/**
 * Rico's date, drawn in the same flat cartoon style as Rico (ink #10141a outlines, flat
 * colour with one shade tone, almond eyes with heavy upper lids). Long brown hair with a side
 * part, warm smile, gold cross necklace, black top. viewBox 0 0 400 520: head and shoulders.
 */
const INK = "#10141a";
const SKIN = "#f0c7a5";
const SHADE = "#d9a582";
const HAIR = "#4a2a1a";
const HAIR_HI = "#7a4a2e";

export function GirlFace() {
  return (
    <svg viewBox="0 0 400 520" className="block h-auto w-full overflow-visible" aria-hidden>
      {/* back hair: long, falling past the shoulders */}
      <path
        d="M70 210 C 52 120 110 40 200 38 C 292 36 350 110 334 214 C 342 290 356 360 346 470 L 262 470 C 270 380 272 300 262 250 L 140 250 C 128 300 130 380 138 470 L 54 470 C 44 360 60 290 70 210 Z"
        fill={HAIR}
        stroke={INK}
        strokeWidth="9"
        strokeLinejoin="round"
      />
      {/* neck + shoulders */}
      <path d="M170 300 L 168 352 L 232 352 L 230 300 Z" fill={SHADE} stroke={INK} strokeWidth="8" strokeLinejoin="round" />
      <path
        d="M96 520 C 96 440 128 380 176 360 C 190 368 210 368 224 360 C 272 380 304 440 304 520 Z"
        fill={SKIN}
        stroke={INK}
        strokeWidth="8"
        strokeLinejoin="round"
      />
      {/* black top with thin straps */}
      <path d="M118 520 C 120 470 136 438 160 428 L 240 428 C 264 438 280 470 282 520 Z" fill="#17171c" stroke={INK} strokeWidth="8" strokeLinejoin="round" />
      <path d="M150 432 L 158 372 M250 432 L 242 372" stroke="#17171c" strokeWidth="6" strokeLinecap="round" />
      {/* gold chains + cross */}
      <path d="M170 360 C 182 402 218 402 230 360" fill="none" stroke="#e9c46a" strokeWidth="4" />
      <path d="M164 362 C 178 430 222 430 236 362" fill="none" stroke="#e9c46a" strokeWidth="3.5" />
      <path d="M200 420 v 40 M186 432 h 28" stroke="#e9c46a" strokeWidth="8" strokeLinecap="round" />
      <path d="M200 420 v 40 M186 432 h 28" stroke="#b8902f" strokeWidth="2" strokeLinecap="round" />
      {/* face */}
      <path
        d="M110 190 C 106 120 150 92 200 92 C 252 92 294 120 290 190 C 288 250 268 300 236 322 C 220 334 210 338 200 338 C 190 338 178 334 164 322 C 132 300 112 250 110 190 Z"
        fill={SKIN}
        stroke={INK}
        strokeWidth="9"
        strokeLinejoin="round"
      />
      <path d="M262 150 C 288 200 282 268 240 314 C 270 280 284 220 262 150 Z" fill={SHADE} opacity=".8" />
      {/* ears with small gold hoops */}
      <path d="M112 200 C 92 192 88 230 110 246" fill={SKIN} stroke={INK} strokeWidth="7" strokeLinecap="round" />
      <circle cx="108" cy="256" r="8" fill="none" stroke="#e9c46a" strokeWidth="4" />
      {/* side-parted bangs sweeping across */}
      <path
        d="M104 196 C 96 120 150 70 214 72 C 270 74 304 116 300 176 C 286 140 262 124 236 120 C 220 150 182 168 150 170 C 168 156 178 140 182 122 C 150 134 126 160 120 210 Z"
        fill={HAIR}
        stroke={INK}
        strokeWidth="9"
        strokeLinejoin="round"
      />
      <path d="M150 98 C 180 84 220 82 250 92" fill="none" stroke={HAIR_HI} strokeWidth="7" strokeLinecap="round" />
      <path d="M78 260 C 74 320 80 380 92 440" fill="none" stroke={HAIR_HI} strokeWidth="6" strokeLinecap="round" />
      <path d="M322 250 C 330 320 330 380 322 440" fill="none" stroke={HAIR_HI} strokeWidth="6" strokeLinecap="round" />
      {/* brows: thin, softly arched */}
      <path d="M140 186 C 152 176 172 174 186 180" fill="none" stroke={HAIR} strokeWidth="7" strokeLinecap="round" />
      <path d="M216 180 C 230 174 250 176 262 186" fill="none" stroke={HAIR} strokeWidth="7" strokeLinecap="round" />
      {/* eyes: almond, lashes, smiling lower lids */}
      <g stroke={INK} strokeWidth="6" strokeLinejoin="round">
        <path d="M140 214 C 150 198 178 196 190 212 C 178 224 152 226 140 214 Z" fill="#fbf6ec" />
        <path d="M212 212 C 224 196 252 198 262 214 C 250 226 224 224 212 212 Z" fill="#fbf6ec" />
      </g>
      <circle cx="166" cy="212" r="10" fill="#3a2214" />
      <circle cx="236" cy="212" r="10" fill="#3a2214" />
      <circle cx="169" cy="208" r="3.5" fill="#fff" />
      <circle cx="239" cy="208" r="3.5" fill="#fff" />
      <path d="M136 210 C 150 194 178 192 194 208 M138 204 l -8 -6 M208 208 C 224 192 252 194 266 210 M264 204 l 8 -6" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
      {/* nose + blush */}
      <path d="M200 226 C 198 244 194 252 192 258 C 198 262 206 262 210 258" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="142" cy="250" rx="16" ry="9" fill="#ef8f8f" opacity=".45" />
      <ellipse cx="258" cy="250" rx="16" ry="9" fill="#ef8f8f" opacity=".45" />
      {/* smile */}
      <path d="M170 282 C 186 300 216 300 232 282 C 216 290 186 290 170 282 Z" fill="#c75b6b" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
    </svg>
  );
}
