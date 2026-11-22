import React from "react";
import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EditorErrorBoundary } from "./EditorErrorBoundary";

it("keeps the editor normally and offers recovery after a render error", () => {
  const boundary = new EditorErrorBoundary({children:<div>Editor</div>});
  expect(renderToStaticMarkup(boundary.render())).toBe("<div>Editor</div>");
  boundary.state = EditorErrorBoundary.getDerivedStateFromError();
  const fallback = renderToStaticMarkup(boundary.render());
  for (const text of ['role="alert"',"Zkusit znovu",'href="/boj/mapy"',"místní koncept"]) expect(fallback).toContain(text);
  expect(fallback).not.toContain("<div>Editor</div>");
});
