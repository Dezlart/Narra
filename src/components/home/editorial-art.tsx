import type { DemoArtwork } from "./demo-content";

/** Original geometric artwork, rendered as SVG; no external image dependency. */
export function EditorialArt({ variant, className }: { variant: DemoArtwork | "feature"; className?: string }) {
  return (
    <svg viewBox="0 0 600 460" fill="none" className={className} aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">
      {variant === "feature" && <>
        <path fill="#dce6d9" d="M0 0h600v460H0z" />
        <path d="M0 370h600M0 400h600M0 430h600M80 340v120M190 340v120M300 340v120M410 340v120M520 340v120" stroke="#a8b9a7" />
        <circle cx="437" cy="108" r="49" fill="#ed794f" />
        <path d="M133 357V185a117 117 0 0 1 234 0v172H133Z" fill="#2c493b" />
        <path d="M162 357V185a88 88 0 0 1 176 0v172H162Z" fill="#73937c" />
        <path d="M191 357V185a59 59 0 0 1 118 0v172H191Z" fill="#b2c8aa" />
        <path d="M220 357V185a30 30 0 0 1 60 0v172H220Z" fill="#f3f0d9" />
        <path d="m280 286 145 42-175 90-116-61h146v-71Z" fill="#20382d" opacity=".16" />
        <path d="m355 285 75-38 76 38-76 39-75-39Z" fill="#f6efe0" />
        <path d="m355 285 75 39v77l-75-39v-77Z" fill="#e29b71" />
        <path d="m430 324 76-39v77l-76 39v-77Z" fill="#bf5837" />
        <circle cx="104" cy="83" r="5" fill="#2c493b" />
        <path d="M89 83H60m44 15v28m0-58V40m15 43h28" stroke="#2c493b" />
        <path d="M526 189h23m-11-11v23" stroke="#2c493b" strokeWidth="2" />
        <text x="37" y="430" fill="#405747" fontSize="12" letterSpacing="3" fontFamily="monospace">A DIFFERENT PERSPECTIVE</text>
      </>}
      {variant === "orbit" && <>
        <path fill="#dbe4ec" d="M0 0h600v460H0z" />
        <circle cx="300" cy="230" r="139" stroke="#91a5b5" />
        <circle cx="300" cy="230" r="101" stroke="#91a5b5" />
        <ellipse cx="300" cy="230" rx="218" ry="65" transform="rotate(-27 300 230)" stroke="#3f5870" strokeWidth="2" />
        <circle cx="300" cy="230" r="60" fill="#34566a" />
        <circle cx="473" cy="128" r="21" fill="#d06f4c" />
        <circle cx="121" cy="329" r="9" fill="#faf5e7" />
        <path d="M56 65h24m-12-12v24" stroke="#3f5870" />
      </>}
      {variant === "type" && <>
        <path fill="#e8dded" d="M0 0h600v460H0z" />
        <path d="M0 366h600M106 0v460M498 0v460" stroke="#c3afce" />
        <text x="100" y="338" fontSize="300" fontFamily="Georgia, serif" fill="#533f63">Aa</text>
        <circle cx="490" cy="105" r="35" fill="#d48c57" />
        <path d="m474 105 11 11 20-22" stroke="#f8f0e6" strokeWidth="3" />
      </>}
      {variant === "architecture" && <>
        <path fill="#e9dcc3" d="M0 0h600v460H0z" />
        <circle cx="438" cy="109" r="51" fill="#d77650" />
        <path d="M75 379V133h183v246H75Z" fill="#647462" />
        <path d="m258 133 100 54v192H258V133Z" fill="#405746" />
        <path d="M113 379V213a54 54 0 0 1 108 0v166H113Z" fill="#e9dcc3" />
        <path d="M308 379V260h45v-39h45v-40h45v198H308Z" fill="#b97853" />
        <path d="m443 181 64 37v161h-64V181Z" fill="#965637" />
        <path d="M30 380h540" stroke="#887b61" />
      </>}
    </svg>
  );
}
