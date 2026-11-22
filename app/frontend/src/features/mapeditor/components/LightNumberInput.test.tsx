import React from "react";
import {expect,it,vi} from "vitest";
import {LightNumberInput} from "./LightInspector";
const state=vi.hoisted(()=>({draft:"60"}));
vi.mock("react",async()=>({...await vi.importActual<typeof import("react")>("react"),useState:()=>[state.draft,(v:string)=>{state.draft=v;}],useEffect:()=>{}}));
it("keeps partial and empty numeric drafts local, and clamps only on blur or Enter",()=>{
 const onCommit=vi.fn();
 const input=(value=60,min=10,max=180)=>{
  const label=LightNumberInput({label:"Šířka",value,min,max,onCommit});
  return (label.props.children[1] as React.ReactElement<any>).props;
 };
 input().onChange({target:{value:"4"}});expect(state.draft).toBe("4");expect(onCommit).not.toHaveBeenCalled();
 input().onChange({target:{value:"45"}});input().onBlur();expect(onCommit).toHaveBeenLastCalledWith(45);
 state.draft="4";input().onBlur();expect(onCommit).toHaveBeenLastCalledWith(10);
 state.draft="999";input().onBlur();expect(onCommit).toHaveBeenLastCalledWith(180);
 onCommit.mockClear();state.draft="";input().onBlur();expect(state.draft).toBe("60");expect(onCommit).not.toHaveBeenCalled();
 state.draft="bad";input().onBlur();expect(state.draft).toBe("60");
 state.draft=".5";input(1,.25,3).onBlur();expect(onCommit).toHaveBeenLastCalledWith(.5);
 const blur=vi.fn(),preventDefault=vi.fn();input().onKeyDown({key:"Enter",preventDefault,currentTarget:{blur}});expect(blur).toHaveBeenCalledOnce();expect(preventDefault).toHaveBeenCalledOnce();
});
