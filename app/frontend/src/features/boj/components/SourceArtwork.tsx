import type {CSSProperties} from "react";
import {assetSrc,assetUrl,type AssetEntry} from "../../mapeditor/assets/manifest";
import type {MapObject} from "../model/mapV2";
import "./sourceStates.css";

export function SourceArtwork({object:o,asset:a,src,svg=false,style,className}:{object:MapObject;asset?:AssetEntry;src?:string;svg?:boolean;style?:CSSProperties;className?:string}) {
  const on=o.zap!==false,base=src || (a?assetUrl(assetSrc(a,o.v)):""),off=a?.srcVyp?assetUrl(a.srcVyp):base;
  const props={className:className || "source-art",style:{...style,opacity:on?1:0},"data-source-art":"on"};
  const offProps={className:"source-art",style:{...style,filter:[style?.filter!=="none"?style?.filter:"",!a?.srcVyp?"brightness(.35) saturate(.25)":""].filter(Boolean).join(" ") || "none",opacity:on?0:1},"data-source-art":"off"};
  const box={x:-o.w*12,y:-o.h*12,width:o.w*24,height:o.h*24,preserveAspectRatio:"xMidYMid meet"};
  return svg?<g data-source-id={o.id} data-source-state={on?"on":"off"}><image {...box} {...props} href={base}/><image {...box} {...offProps} href={off}/></g>
    :<><span className="source-art" style={{opacity:on?1:0}} data-source-art="on"><img className={className} style={style} src={base} alt=""/></span>
      <span className="source-art" style={{opacity:on?0:1}} data-source-art="off"><img style={{...offProps.style,opacity:1}} src={off} alt=""/></span></>;
}
