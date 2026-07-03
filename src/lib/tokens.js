// Design tokens — single source of truth for colours, fonts, and global styles
export const T = {
  black:"#000000",white:"#FFFFFF",green:"#06C167",greenLight:"#E6F9F1",greenDark:"#038C48",
  gray50:"#F6F6F6",gray100:"#EBEBEB",gray200:"#D3D3D3",gray400:"#8C8C8C",gray600:"#545454",gray800:"#282828",
  red:"#E11900",redLight:"#FCEAE8",amber:"#FFC043",amberLight:"#FFF3D9",blue:"#276EF1",blueLight:"#EEF3FE",
};
export const F = "'Manrope', sans-serif";
export const GLOBAL_STYLES = `*{box-sizing:border-box;margin:0;padding:0;} ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-thumb{background:#D3D3D3;} input[type=range]{-webkit-appearance:none;appearance:none;height:4px;background:#EBEBEB;border-radius:2px;outline:none;} input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:20px;height:20px;background:#000;border-radius:50%;cursor:pointer;} input[type=number]::-webkit-inner-spin-button{opacity:1;} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.7}}`;
